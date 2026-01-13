// ============================================
// BIN INVENTORY LABELER APPLICATION
// ============================================

const STORAGE_KEY = "binInventory";
const SETTINGS_KEY = "binInventorySettings";

// State
let currentBinId = null;
let isListening = false;
let recognition = null;
let accumulatedFinalTranscript = ""; // Accumulated final transcript to prevent duplicates
let lastResultIndex = -1; // Track which result indices we've processed
let lastInterimTranscript = "";

// DOM Elements
let binNamespaceInput;
let binNumberInput;
let contentsInput;
let voiceBtn;
let clearVoiceBtn;
let voiceTranscript;
let voiceStatusDot;
let voiceStatusText;
let generateBtn;
let nextBinBtn;
let clearAllBtn;
let labelPreview;
let binsList;
let binCount;
let barcodeUrlInput;
let itemsPerPageInput;
let printBtn;
let downloadPdfBtn;
let exportBinsBtn;
let importBinsBtn;
let importFileInput;
let importModal;
let modalClose;
let modalOverwrite;
let modalMerge;
let modalCancel;
let importStats;
let importModalMessage;
let shareCrateBtn;
let shareModal;
let shareModalClose;
let shareModalDone;
let shareQrContainer;
let shareCrateName;
let importQrModal;
let importQrModalClose;
let importQrAccept;
let importQrCancel;
let importQrStats;
let importQrModalMessage;

// Import state
let pendingImportData = null;
let requestedBinId = null; // Track bin ID requested via hash
let pendingQrImportData = null; // Track crate data from QR import

// ============================================
// INITIALIZATION
// ============================================

function init() {
  // Initialize DOM references
  binNamespaceInput = document.getElementById("binNamespace");
  binNumberInput = document.getElementById("binNumber");
  contentsInput = document.getElementById("contentsInput");
  voiceBtn = document.getElementById("voiceBtn");
  clearVoiceBtn = document.getElementById("clearVoiceBtn");
  voiceTranscript = document.getElementById("voiceTranscript");
  voiceStatusDot = document.getElementById("voiceStatusDot");
  voiceStatusText = document.getElementById("voiceStatusText");
  generateBtn = document.getElementById("generateBtn");
  nextBinBtn = document.getElementById("nextBinBtn");
  clearAllBtn = document.getElementById("clearAllBtn");
  labelPreview = document.getElementById("labelPreview");
  binsList = document.getElementById("binsList");
  binCount = document.getElementById("binCount");
  barcodeUrlInput = document.getElementById("barcodeUrl");
  itemsPerPageInput = document.getElementById("itemsPerPage");
  printBtn = document.getElementById("printBtn");
  downloadPdfBtn = document.getElementById("downloadPdfBtn");
  exportBinsBtn = document.getElementById("exportBinsBtn");
  importBinsBtn = document.getElementById("importBinsBtn");
  importFileInput = document.getElementById("importFileInput");
  importModal = document.getElementById("importModal");
  modalClose = document.getElementById("modalClose");
  modalOverwrite = document.getElementById("modalOverwrite");
  modalMerge = document.getElementById("modalMerge");
  modalCancel = document.getElementById("modalCancel");
  importStats = document.getElementById("importStats");
  importModalMessage = document.getElementById("importModalMessage");

  // Share modal elements
  shareCrateBtn = document.getElementById("shareCrateBtn");
  shareModal = document.getElementById("shareModal");
  shareModalClose = document.getElementById("shareModalClose");
  shareModalDone = document.getElementById("shareModalDone");
  shareQrContainer = document.getElementById("shareQrContainer");
  shareCrateName = document.getElementById("shareCrateName");

  // Import from QR modal elements
  importQrModal = document.getElementById("importQrModal");
  importQrModalClose = document.getElementById("importQrModalClose");
  importQrAccept = document.getElementById("importQrAccept");
  importQrCancel = document.getElementById("importQrCancel");
  importQrStats = document.getElementById("importQrStats");
  importQrModalMessage = document.getElementById("importQrModalMessage");

  loadSettings();
  loadBins();
  setupSpeechRecognition();
  setupEventListeners();

  // Check for shared crate data first (before regular hash check)
  checkForSharedCrate();

  // Check for hash on initial load
  checkHashAndLoadBin();

  // Listen for hash changes
  window.addEventListener("hashchange", () => {
    checkForSharedCrate();
    checkHashAndLoadBin();
  });
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");

  // Detect base URL from current page location
  const detectedBaseUrl = (() => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    // Get directory path (remove filename if present)
    const directory = pathname.substring(0, pathname.lastIndexOf("/") + 1);
    return origin + directory + "crate/";
  })();

  barcodeUrlInput.value = settings.barcodeUrl || detectedBaseUrl;
  itemsPerPageInput.value = settings.itemsPerPage || 10;
}

function saveSettings() {
  const settings = {
    barcodeUrl: barcodeUrlInput.value,
    itemsPerPage: parseInt(itemsPerPageInput.value) || 10,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadBins() {
  const bins = getBins();
  updateBinsList(bins);
}

function getBins() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
}

function saveBin(binId, binData) {
  const bins = getBins();
  bins[binId] = binData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bins));
  updateBinsList(bins);
}

function deleteBin(binId) {
  const bins = getBins();
  delete bins[binId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bins));
  updateBinsList(bins);
}

// ============================================
// SPEECH RECOGNITION
// ============================================

function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    voiceBtn.disabled = true;
    voiceStatusText.textContent =
      "Speech recognition not supported in this browser";
    showToast("Speech recognition not supported. Try Chrome or Edge.", "error");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    voiceBtn.classList.add("listening");
    voiceBtn.textContent = "🛑 Stop Listening";
    voiceStatusDot.classList.add("active");
    voiceStatusText.textContent =
      'Listening... Say items or "next" to separate lines';
  };

  recognition.onend = () => {
    isListening = false;
    voiceBtn.classList.remove("listening");
    voiceBtn.textContent = "🎤 Start Voice Input";
    voiceStatusDot.classList.remove("active");
    voiceStatusText.textContent = "Voice input stopped";

    // Process the accumulated final transcript
    if (accumulatedFinalTranscript.trim()) {
      processVoiceTranscript(accumulatedFinalTranscript.trim());
    }
  };

  recognition.onresult = (event) => {
    let currentInterim = "";

    // Process results - on mobile, we need content-based deduplication
    // because indices can reset or overlap unpredictably
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();

      if (result.isFinal) {
        // Only process this index if we haven't already
        if (i > lastResultIndex && transcript) {
          // Check if this transcript is already contained in our accumulated text
          // This handles mobile browsers that send duplicate content
          const normalizedNew = transcript.toLowerCase();
          const normalizedExisting = accumulatedFinalTranscript.toLowerCase();

          // Check for exact duplicate or if new text is suffix of existing
          if (
            !normalizedExisting.endsWith(normalizedNew) &&
            normalizedExisting !== normalizedNew
          ) {
            // Check for overlapping content (mobile often sends overlapping results)
            const overlap = findOverlap(accumulatedFinalTranscript, transcript);
            if (overlap < transcript.length) {
              // Only add the non-overlapping part
              const newPart = transcript.substring(overlap);
              if (newPart.trim()) {
                accumulatedFinalTranscript = accumulatedFinalTranscript
                  ? accumulatedFinalTranscript + " " + newPart
                  : newPart;
              }
            }
          }
          lastResultIndex = i;
        }
      } else {
        // Only show interim for the latest non-final result
        currentInterim = transcript;
      }
    }

    // Show final + interim
    let displayText = accumulatedFinalTranscript;
    if (currentInterim) {
      displayText +=
        ' <span style="color: #8b949e;">' + currentInterim + "</span>";
    }

    voiceTranscript.innerHTML = displayText || "<em>Listening...</em>";
    lastInterimTranscript = currentInterim;
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    voiceStatusText.textContent = "Error: " + event.error;

    if (event.error === "not-allowed") {
      showToast(
        "Microphone access denied. Please allow microphone access.",
        "error"
      );
    }
  };
}

function toggleVoiceInput() {
  if (!recognition) {
    showToast("Speech recognition not available", "error");
    return;
  }

  if (isListening) {
    recognition.stop();
  } else {
    // Reset state for new session
    accumulatedFinalTranscript = "";
    lastResultIndex = -1;
    lastInterimTranscript = "";
    voiceTranscript.innerHTML = "<em>Listening...</em>";
    recognition.start();
  }
}

function clearVoiceTranscript() {
  accumulatedFinalTranscript = "";
  lastResultIndex = -1;
  lastInterimTranscript = "";
  voiceTranscript.innerHTML = "<em>Voice transcript will appear here...</em>";
}

function processVoiceTranscript(transcript) {
  // Remove consecutive duplicate words (common mobile speech recognition issue)
  const deduplicatedTranscript = deduplicateConsecutiveWords(transcript);

  // Normalize and split by "next" (preserve capitalization from speech-to-text)
  const normalized = deduplicatedTranscript
    .replace(/,?\s*next\s*,?/gi, "\n")
    .replace(/,/g, "\n")
    .trim();

  // Parse each line
  const lines = normalized.split("\n").filter((line) => line.trim());
  const parsedItems = [];

  for (const line of lines) {
    const parsed = parseItemLine(line.trim(), true); // true = from voice input
    if (parsed) {
      parsedItems.push(`${parsed.quantity} ${parsed.name}`);
    }
  }

  // Add to contents input
  if (parsedItems.length > 0) {
    const currentContent = contentsInput.value.trim();
    const newContent = currentContent
      ? currentContent + "\n" + parsedItems.join("\n")
      : parsedItems.join("\n");
    contentsInput.value = newContent;
    showToast(`Added ${parsedItems.length} items from voice input`, "success");
  }
}

function parseItemLine(line, fromVoiceInput = false) {
  // Try to extract quantity and item name
  // Patterns: "5 hdmi cables", "five hdmi cables", "hdmi cable"
  // If fromVoiceInput is false, preserve original capitalization

  const wordToNum = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
  };

  // Check for number at start
  const numMatch = line.match(/^(\d+)\s+(.+)$/);
  if (numMatch) {
    return {
      quantity: parseInt(numMatch[1]),
      name: fromVoiceInput ? capitalizeWords(numMatch[2]) : numMatch[2],
    };
  }

  // Check for word number at start
  const words = line.split(/\s+/);
  const firstWord = words[0].toLowerCase();
  if (wordToNum[firstWord]) {
    const remainingText = words.slice(1).join(" ");
    return {
      quantity: wordToNum[firstWord],
      name: fromVoiceInput ? capitalizeWords(remainingText) : remainingText,
    };
  }

  // Check for "a" or "an" at start (means 1)
  if (firstWord === "a" || firstWord === "an") {
    const remainingText = words.slice(1).join(" ");
    return {
      quantity: 1,
      name: fromVoiceInput ? capitalizeWords(remainingText) : remainingText,
    };
  }

  // Default to quantity 1
  if (line.trim()) {
    return {
      quantity: 1,
      name: fromVoiceInput ? capitalizeWords(line) : line,
    };
  }

  return null;
}

function capitalizeWords(str) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function toTitleCase(str) {
  // Convert to title case, preserving existing capitalization for acronyms
  // Small words (of, the, a, an, etc.) stay lowercase unless first word
  const smallWords = new Set([
    "of",
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
  ]);

  return str
    .split(" ")
    .map((word, index) => {
      const lowerWord = word.toLowerCase();

      // If word is already all uppercase (likely an acronym), keep it
      if (word === word.toUpperCase() && word.length > 1) {
        return word;
      }

      // Small words stay lowercase unless they're the first word
      if (index > 0 && smallWords.has(lowerWord)) {
        return lowerWord;
      }

      // Otherwise, capitalize first letter, lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Remove consecutive duplicate words from a string.
 * Handles the common mobile speech recognition issue where words repeat.
 * e.g., "one one one pumpkin one pumpkin candle" -> "one pumpkin candle"
 */
function deduplicateConsecutiveWords(text) {
  const words = text.split(/\s+/);
  if (words.length === 0) return text;

  const result = [words[0]];

  for (let i = 1; i < words.length; i++) {
    // Only add word if it's different from the previous one (case-insensitive)
    if (words[i].toLowerCase() !== words[i - 1].toLowerCase()) {
      result.push(words[i]);
    }
  }

  return result.join(" ");
}

/**
 * Find the overlap between the end of existing text and start of new text.
 * Returns the length of the overlapping portion.
 * This helps handle mobile speech recognition that sends overlapping results.
 */
function findOverlap(existing, newText) {
  if (!existing || !newText) return 0;

  const existingLower = existing.toLowerCase();
  const newLower = newText.toLowerCase();

  // Check for word-based overlap (more reliable than character-based)
  const existingWords = existingLower.split(/\s+/);
  const newWords = newLower.split(/\s+/);

  // Try to find where newText overlaps with end of existing
  for (
    let overlapLen = Math.min(existingWords.length, newWords.length);
    overlapLen > 0;
    overlapLen--
  ) {
    const existingEnd = existingWords.slice(-overlapLen).join(" ");
    const newStart = newWords.slice(0, overlapLen).join(" ");

    if (existingEnd === newStart) {
      // Found overlap - return character position after overlap
      return newText.split(/\s+/).slice(0, overlapLen).join(" ").length + 1;
    }
  }

  return 0;
}

// ============================================
// BIN MANAGEMENT
// ============================================

function generateBinId() {
  return (
    "BIN-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  );
}

function getBinFullName() {
  const namespace = binNamespaceInput.value.trim() || "Crate";
  const number = binNumberInput.value || "1";
  // Apply title case to namespace for better display
  const titleCaseNamespace = toTitleCase(namespace);
  return `${titleCaseNamespace} ${number}`;
}

function parseContents(text) {
  const lines = text.split("\n").filter((line) => line.trim());
  const items = [];

  for (const line of lines) {
    const parsed = parseItemLine(line);
    if (parsed) {
      items.push(parsed);
    }
  }

  return items;
}

function generateLabel() {
  const binName = getBinFullName();
  const contents = contentsInput.value.trim();

  if (!contents) {
    showToast("Please enter crate contents first", "error");
    return;
  }

  const items = parseContents(contents);
  if (items.length === 0) {
    showToast("Could not parse any items from contents", "error");
    return;
  }

  // Generate or reuse bin ID
  if (!currentBinId) {
    currentBinId = generateBinId();
  }

  // Save bin data
  const namespace = binNamespaceInput.value.trim();
  const binData = {
    id: currentBinId,
    name: binName,
    namespace: toTitleCase(namespace), // Save namespace in title case
    number: parseInt(binNumberInput.value) || 1,
    items: items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveBin(currentBinId, binData);
  saveSettings();

  // Render labels
  renderLabels(binData);

  // Update hash to reflect generated bin
  updateHash(currentBinId);

  showToast("Label generated successfully!", "success");
}

function renderLabels(binData) {
  const itemsPerPage = parseInt(itemsPerPageInput.value) || 10;
  // Generate hash-based URL for viewing this crate
  const currentUrl = window.location.origin + window.location.pathname;
  const fullBarcodeUrl = currentUrl + "#" + binData.id;

  // Split items into pages
  const pages = [];
  for (let i = 0; i < binData.items.length; i += itemsPerPage) {
    pages.push(binData.items.slice(i, i + itemsPerPage));
  }

  // Ensure at least one page
  if (pages.length === 0) {
    pages.push([]);
  }

  let html = "";

  pages.forEach((pageItems, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const totalPages = pages.length;

    html += `
            <div class="label-page" data-page="${pageIndex + 1}">
                ${
                  isFirstPage
                    ? `
                    <div class="label-header">
                        <div class="label-header-text">
                            <div class="label-bin-name">${escapeHtml(
                              binData.name
                            )}</div>
                            <div class="label-bin-id">ID: ${binData.id}</div>
                        </div>
                        <div class="label-qrcode" data-url="${escapeHtml(
                          fullBarcodeUrl
                        )}"></div>
                    </div>
                `
                    : `
                    <div class="label-header label-header-continuation">
                        <div class="label-header-text">
                            <div class="label-continuation">
                                (Continued from ${escapeHtml(binData.name)})
                            </div>
                        </div>
                        <div class="label-qrcode" data-url="${escapeHtml(
                          fullBarcodeUrl
                        )}"></div>
                    </div>
                `
                }

                <div class="label-contents">
                    <div class="label-contents-title">Contents:</div>
                    ${pageItems
                      .map(
                        (item) => `
                        <div class="label-item">
                            <span class="item-qty">${item.quantity}x</span>
                            <span class="item-name">${escapeHtml(
                              item.name
                            )}</span>
                        </div>
                    `
                      )
                      .join("")}
                </div>

                <div class="label-footer">
                    <div class="label-barcode-text">${escapeHtml(
                      fullBarcodeUrl
                    )}</div>
                    ${
                      totalPages > 1
                        ? `<div class="label-page-indicator">Page ${
                            pageIndex + 1
                          } of ${totalPages}</div>`
                        : ""
                    }
                </div>
            </div>
        `;
  });

  labelPreview.innerHTML = html;

  // Generate QR codes for all pages
  generateQRCodes(fullBarcodeUrl);
}

function generateQRCodes(url) {
  // Check if QRCode library is available
  if (typeof QRCode === "undefined") {
    console.warn("QRCode library not loaded");
    return;
  }

  const qrContainers = labelPreview.querySelectorAll(".label-qrcode");

  for (const container of qrContainers) {
    const urlToEncode = container.getAttribute("data-url") || url;
    // Clear any existing QR code
    container.innerHTML = "";
    try {
      new QRCode(container, {
        text: urlToEncode,
        width: 80,
        height: 80,
        colorDark: "#000000",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }
}

function nextBin() {
  // Increment bin number
  const currentNumber = parseInt(binNumberInput.value) || 1;
  binNumberInput.value = currentNumber + 1;

  // Clear contents and reset bin ID
  contentsInput.value = "";
  currentBinId = null;
  clearVoiceTranscript();

  // Clear preview
  labelPreview.innerHTML = `
        <div class="empty-state" style="color: #666;">
            <div class="empty-state-icon">🏷️</div>
            <p>Ready for ${getBinFullName()}</p>
        </div>
    `;

  // Clear hash when moving to next bin
  updateHash(null);

  showToast(`Ready for ${getBinFullName()}`, "success");
}

function clearAll() {
  contentsInput.value = "";
  currentBinId = null;
  clearVoiceTranscript();

  labelPreview.innerHTML = `
        <div class="empty-state" style="color: #666;">
            <div class="empty-state-icon">🏷️</div>
            <p>Enter contents and click "Generate Label" to preview</p>
        </div>
    `;

  // Clear hash when clearing
  updateHash(null);
}

function loadBinToEditor(binId) {
  const bins = getBins();
  const bin = bins[binId];

  if (!bin) {
    showToast("Crate not found", "error");
    // Clear hash if bin doesn't exist
    if (window.location.hash === `#${binId}`) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    return;
  }

  currentBinId = bin.id;
  binNamespaceInput.value = bin.namespace || "";
  binNumberInput.value = bin.number || 1;

  // Convert items back to text
  const contentsText = bin.items
    .map((item) => `${item.quantity} ${item.name}`)
    .join("\n");
  contentsInput.value = contentsText;

  // Render the label
  renderLabels(bin);

  // Update hash to reflect loaded bin
  updateHash(binId);

  showToast(`Loaded ${bin.name}`, "success");
}

function updateBinsList(bins) {
  const binIds = Object.keys(bins);
  binCount.textContent = binIds.length;

  if (binIds.length === 0) {
    binsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <p>No crates saved yet</p>
            </div>
        `;
    return;
  }

  // Sort by updated date, newest first
  const sortedBins = binIds
    .map((id) => bins[id])
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  binsList.innerHTML = sortedBins
    .map(
      (bin) => `
        <div class="bin-card" onclick="loadBinToEditor('${bin.id}')">
            <div class="bin-card-info">
                <div class="bin-card-name">${escapeHtml(bin.name)}</div>
                <div class="bin-card-meta">${bin.id} • ${
        bin.items.length
      } items</div>
            </div>
            <div class="bin-card-actions">
                <button class="btn btn-secondary bin-card-btn" onclick="event.stopPropagation(); printSingleBin('${
                  bin.id
                }')">
                    🖨️
                </button>
                <button class="btn btn-danger bin-card-btn" onclick="event.stopPropagation(); confirmDeleteBin('${
                  bin.id
                }')">
                    🗑️
                </button>
            </div>
        </div>
    `
    )
    .join("");
}

function confirmDeleteBin(binId) {
  if (confirm("Are you sure you want to delete this crate?")) {
    deleteBin(binId);

    // Clear editor if this was the current bin
    if (currentBinId === binId) {
      clearAll();
      currentBinId = null;
      updateHash(null);
    }

    showToast("Crate deleted", "success");
  }
}

function printSingleBin(binId) {
  const bins = getBins();
  const bin = bins[binId];
  if (bin) {
    renderLabels(bin);
    setTimeout(() => window.print(), 100);
  }
}

// ============================================
// IMPORT / EXPORT
// ============================================

function exportBins() {
  const bins = getBins();
  const binCount = Object.keys(bins).length;

  if (binCount === 0) {
    showToast("No crates to export", "error");
    return;
  }

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    bins: bins,
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `crate-labeler-export-${
    new Date().toISOString().split("T")[0]
  }.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported ${binCount} crate(s) successfully!`, "success");
}

function triggerImport() {
  importFileInput.click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      processImportData(data);
    } catch (error) {
      showToast("Invalid JSON file. Please check the file format.", "error");
      console.error("Import error:", error);
    }
  };
  reader.readAsText(file);

  // Reset input so same file can be imported again
  importFileInput.value = "";
}

function processImportData(data) {
  // Validate import data structure
  if (!data.bins || typeof data.bins !== "object") {
    showToast("Invalid file format. Missing crates data.", "error");
    return;
  }

  const importedBins = data.bins;
  const importCount = Object.keys(importedBins).length;

  if (importCount === 0) {
    showToast("No crates found in the import file.", "error");
    return;
  }

  const existingBins = getBins();
  const existingCount = Object.keys(existingBins).length;

  // If no existing bins, import directly
  if (existingCount === 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(importedBins));
    loadBins();
    showToast(`Imported ${importCount} crate(s) successfully!`, "success");

    // Check if the requested bin is now available
    checkAndLoadRequestedBin(importedBins);
    return;
  }

  // Find duplicates (bins with same ID)
  const duplicateIds = Object.keys(importedBins).filter(
    (id) => existingBins[id]
  );

  // Store pending import data and show modal
  pendingImportData = importedBins;

  // Update modal with stats
  importStats.innerHTML = `
    <div class="stats-row">
      <span class="stats-label">Existing crates:</span>
      <span class="stats-value">${existingCount}</span>
    </div>
    <div class="stats-row">
      <span class="stats-label">Crates to import:</span>
      <span class="stats-value">${importCount}</span>
    </div>
    <div class="stats-row ${duplicateIds.length > 0 ? "stats-warning" : ""}">
      <span class="stats-label">Duplicate IDs:</span>
      <span class="stats-value">${duplicateIds.length}</span>
    </div>
  `;

  if (duplicateIds.length > 0) {
    importModalMessage.textContent = `Found ${duplicateIds.length} crate(s) with duplicate IDs. How would you like to proceed?`;
  } else {
    importModalMessage.textContent = `You have ${existingCount} existing crate(s). How would you like to handle the import?`;
  }

  showImportModal();
}

function showImportModal() {
  importModal.classList.add("visible");
}

function hideImportModal() {
  importModal.classList.remove("visible");
  pendingImportData = null;
}

function executeOverwrite() {
  if (!pendingImportData) return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingImportData));
  loadBins();

  const count = Object.keys(pendingImportData).length;
  showToast(`Replaced with ${count} imported crate(s)!`, "success");

  // Check if the requested bin is now available
  checkAndLoadRequestedBin(pendingImportData);

  hideImportModal();
}

function executeMerge() {
  if (!pendingImportData) return;

  const existingBins = getBins();
  const mergedBins = { ...existingBins };
  let renamedCount = 0;
  let addedCount = 0;

  for (const [binId, binData] of Object.entries(pendingImportData)) {
    if (mergedBins[binId]) {
      // Duplicate ID found - generate new ID and rename
      const newId = generateBinId();
      const renamedBin = {
        ...binData,
        id: newId,
        name: binData.name + " (Imported)",
        updatedAt: new Date().toISOString(),
      };
      mergedBins[newId] = renamedBin;
      renamedCount++;
    } else {
      mergedBins[binId] = binData;
      addedCount++;
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedBins));
  loadBins();

  let message = `Merged successfully! Added ${addedCount} crate(s)`;
  if (renamedCount > 0) {
    message += `, renamed ${renamedCount} duplicate(s)`;
  }
  showToast(message, "success");

  // Check if the requested bin is now available
  checkAndLoadRequestedBin(mergedBins);

  hideImportModal();
}

// ============================================
// SHARE CRATE VIA QR
// ============================================

function showShareModal() {
  if (!currentBinId) {
    showToast("Generate or select a crate first", "error");
    return;
  }

  const bins = getBins();
  const bin = bins[currentBinId];

  if (!bin) {
    showToast("Crate not found", "error");
    return;
  }

  // Generate share URL with encoded crate data
  const shareData = {
    v: 1, // version for future compatibility
    crate: bin,
  };

  const encodedData = btoa(
    unescape(encodeURIComponent(JSON.stringify(shareData)))
  );
  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = baseUrl + "#share=" + encodedData;

  // Check if URL is too long (QR codes have limits)
  if (shareUrl.length > 2000) {
    showToast(
      "Crate has too much data to share via QR. Try reducing items.",
      "error"
    );
    return;
  }

  // Update modal content
  shareCrateName.textContent = bin.name;

  // Clear existing QR code
  shareQrContainer.innerHTML = "";

  // Generate QR code
  if (typeof QRCode !== "undefined") {
    new QRCode(shareQrContainer, {
      text: shareUrl,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.L, // Low error correction for more data capacity
    });
  } else {
    shareQrContainer.innerHTML =
      '<p style="color: red;">QR Code library not loaded</p>';
  }

  shareModal.classList.add("visible");
}

function hideShareModal() {
  shareModal.classList.remove("visible");
  shareQrContainer.innerHTML = "";
}

function checkForSharedCrate() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#share=")) {
    return false;
  }

  const encodedData = hash.substring(7); // Remove "#share="
  if (!encodedData) {
    return false;
  }

  try {
    const jsonString = decodeURIComponent(escape(atob(encodedData)));
    const shareData = JSON.parse(jsonString);

    if (!shareData.crate || !shareData.crate.id) {
      showToast("Invalid share data", "error");
      clearShareHash();
      return false;
    }

    // Store the pending import data and show confirmation modal
    pendingQrImportData = shareData.crate;
    showImportQrModal(shareData.crate);
    return true;
  } catch (error) {
    console.error("Error parsing shared crate data:", error);
    showToast("Could not read shared crate data", "error");
    clearShareHash();
    return false;
  }
}

function showImportQrModal(crateData) {
  importQrModalMessage.textContent = `"${crateData.name}" was shared with you. Would you like to import it?`;

  importQrStats.innerHTML = `
    <div class="stats-row">
      <span class="stats-label">Crate Name:</span>
      <span class="stats-value">${escapeHtml(crateData.name)}</span>
    </div>
    <div class="stats-row">
      <span class="stats-label">Items:</span>
      <span class="stats-value">${
        crateData.items ? crateData.items.length : 0
      }</span>
    </div>
    <div class="stats-row">
      <span class="stats-label">ID:</span>
      <span class="stats-value">${crateData.id}</span>
    </div>
  `;

  importQrModal.classList.add("visible");
}

function hideImportQrModal() {
  importQrModal.classList.remove("visible");
  pendingQrImportData = null;
  clearShareHash();
}

function acceptQrImport() {
  if (!pendingQrImportData) {
    hideImportQrModal();
    return;
  }

  const bins = getBins();
  let crateToSave = { ...pendingQrImportData };

  // Check for duplicate ID
  if (bins[crateToSave.id]) {
    // Generate new ID to avoid conflict
    const newId = generateBinId();
    crateToSave = {
      ...crateToSave,
      id: newId,
      name: crateToSave.name + " (Shared)",
      updatedAt: new Date().toISOString(),
    };
  }

  // Save the crate
  saveBin(crateToSave.id, crateToSave);

  // Load it into the editor
  loadBinToEditor(crateToSave.id);

  showToast(`Imported "${crateToSave.name}" successfully!`, "success");
  hideImportQrModal();
}

function clearShareHash() {
  // Clear the share hash from URL without triggering hashchange
  if (window.location.hash.startsWith("#share=")) {
    window.history.replaceState(null, "", window.location.pathname);
  }
}

// ============================================
// PRINT & PDF
// ============================================

function printLabels() {
  if (labelPreview.querySelector(".empty-state")) {
    showToast("Generate a label first", "error");
    return;
  }
  window.print();
}

async function downloadPdf() {
  if (labelPreview.querySelector(".empty-state")) {
    showToast("Generate a label first", "error");
    return;
  }

  showToast("Generating PDF...", "success");

  // Ensure QR codes are generated before capturing (they should already be, but just in case)
  const qrCanvases = labelPreview.querySelectorAll(".label-qrcode");
  if (qrCanvases.length > 0 && currentBinId) {
    const currentUrl = window.location.origin + window.location.pathname;
    const bins = getBins();
    const currentBin = bins[currentBinId];
    if (currentBin) {
      const fullBarcodeUrl = currentUrl + "#" + currentBin.id;
      await generateQRCodes(fullBarcodeUrl);
      // Small delay to ensure canvas is fully rendered
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [4, 6],
  });

  const labelPages = labelPreview.querySelectorAll(".label-page");

  for (let i = 0; i < labelPages.length; i++) {
    const page = labelPages[i];

    // Temporarily add to body for capture
    const clone = page.cloneNode(true);
    clone.style.position = "absolute";
    clone.style.left = "-9999px";
    clone.style.width = "4in";
    clone.style.height = "6in";
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      if (i > 0) {
        pdf.addPage([4, 6], "portrait");
      }

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, 4, 6);
    } finally {
      document.body.removeChild(clone);
    }
  }

  // Get bin name for filename
  const binName = getBinFullName().replace(/\s+/g, "_");
  pdf.save(`${binName}_labels.pdf`);

  showToast("PDF downloaded!", "success");
}

// ============================================
// HASH ROUTING
// ============================================

function updateHash(binId) {
  if (binId) {
    window.history.replaceState(null, "", "#" + binId);
  } else {
    window.history.replaceState(null, "", window.location.pathname);
  }
}

function checkHashAndLoadBin() {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) {
    return; // No hash or just "#"
  }

  // Skip if it's a share URL (handled by checkForSharedCrate)
  if (hash.startsWith("#share=")) {
    return;
  }

  const binId = hash.substring(1); // Remove the "#"
  if (!binId) {
    return;
  }

  // Load the bin if it exists
  const bins = getBins();
  if (bins[binId]) {
    // Use a small delay to ensure DOM is ready
    setTimeout(() => {
      loadBinToEditor(binId);
      // Scroll to top to show the loaded bin
      window.scrollTo(0, 0);
    }, 100);
  } else {
    // Show persistent message with import prompt
    showCrateNotFoundMessage(binId);
  }
}

function showCrateNotFoundMessage(binId) {
  // Store the requested bin ID so we can check after import
  requestedBinId = binId;

  // Display persistent message in label preview
  labelPreview.innerHTML = `
    <div class="empty-state" style="color: #d1242f;">
      <div class="empty-state-icon">📦</div>
      <h3 style="margin: 16px 0 8px 0; font-size: 1.2rem;">Crate Not Found</h3>
      <p style="margin-bottom: 16px;">The crate <strong>${escapeHtml(
        binId
      )}</strong> was not found in your local storage.</p>
      <p style="margin-bottom: 24px; color: #666;">If you have a saved export file, you can import it to load this crate.</p>
      <button class="btn btn-primary" onclick="triggerImport()" style="margin-top: 8px;">
        📥 Import Crate Data
      </button>
      <button class="btn btn-secondary" onclick="clearCrateNotFoundMessage()" style="margin-top: 8px; margin-left: 8px;">
        Dismiss
      </button>
    </div>
  `;

  // Also show a toast
  showToast(`Crate ${binId} not found. You can import a saved file.`, "error");

  // Scroll to top to show the message
  window.scrollTo(0, 0);
}

function clearCrateNotFoundMessage() {
  // Clear the hash and requested bin ID
  window.history.replaceState(null, "", window.location.pathname);
  requestedBinId = null;

  // Show default empty state
  labelPreview.innerHTML = `
    <div class="empty-state" style="color: #666;">
      <div class="empty-state-icon">🏷️</div>
      <p>Enter contents and click "Generate Label" to preview</p>
    </div>
  `;
}

function checkAndLoadRequestedBin(bins) {
  // If there was a requested bin ID and it's now available, load it
  if (requestedBinId && bins[requestedBinId]) {
    const binIdToLoad = requestedBinId; // Store before clearing
    requestedBinId = null; // Clear the requested ID
    setTimeout(() => {
      loadBinToEditor(binIdToLoad);
      showToast(`Found and loaded crate ${binIdToLoad}!`, "success");
      window.scrollTo(0, 0);
    }, 100);
  }
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
        <span>${type === "success" ? "✓" : "✕"}</span>
        <span>${message}</span>
    `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  voiceBtn.addEventListener("click", toggleVoiceInput);
  clearVoiceBtn.addEventListener("click", clearVoiceTranscript);
  generateBtn.addEventListener("click", generateLabel);
  nextBinBtn.addEventListener("click", nextBin);
  clearAllBtn.addEventListener("click", clearAll);
  printBtn.addEventListener("click", printLabels);
  downloadPdfBtn.addEventListener("click", downloadPdf);

  // Import/Export
  exportBinsBtn.addEventListener("click", exportBins);
  importBinsBtn.addEventListener("click", triggerImport);
  importFileInput.addEventListener("change", handleImportFile);

  // Import modal
  modalClose.addEventListener("click", hideImportModal);
  modalCancel.addEventListener("click", hideImportModal);
  modalOverwrite.addEventListener("click", executeOverwrite);
  modalMerge.addEventListener("click", executeMerge);
  importModal.addEventListener("click", (e) => {
    if (e.target === importModal) hideImportModal();
  });

  // Share modal
  shareCrateBtn.addEventListener("click", showShareModal);
  shareModalClose.addEventListener("click", hideShareModal);
  shareModalDone.addEventListener("click", hideShareModal);
  shareModal.addEventListener("click", (e) => {
    if (e.target === shareModal) hideShareModal();
  });

  // Import from QR modal
  importQrModalClose.addEventListener("click", hideImportQrModal);
  importQrCancel.addEventListener("click", hideImportQrModal);
  importQrAccept.addEventListener("click", acceptQrImport);
  importQrModal.addEventListener("click", (e) => {
    if (e.target === importQrModal) hideImportQrModal();
  });

  // Auto-save settings on change
  barcodeUrlInput.addEventListener("change", saveSettings);
  itemsPerPageInput.addEventListener("change", saveSettings);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      generateLabel();
    }
    // Ctrl/Cmd + P to print
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      if (!labelPreview.querySelector(".empty-state")) {
        // Let default print behavior handle it
      }
    }
  });
}

// Initialize on load
document.addEventListener("DOMContentLoaded", init);
