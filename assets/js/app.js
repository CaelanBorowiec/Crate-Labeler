// ============================================
// BIN INVENTORY LABELER APPLICATION
// ============================================

const STORAGE_KEY = "binInventory";
const SETTINGS_KEY = "binInventorySettings";

// State
let currentBinId = null;
let isListening = false;
let recognition = null;
let finalTranscriptParts = []; // Store final results by index to prevent duplicates
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

  loadSettings();
  loadBins();
  setupSpeechRecognition();
  setupEventListeners();
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  barcodeUrlInput.value =
    settings.barcodeUrl || "https://inventory.example.com/bin/";
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

    // Process final transcript from all collected parts
    const fullTranscript = finalTranscriptParts.join(" ").trim();
    if (fullTranscript) {
      processVoiceTranscript(fullTranscript);
    }
  };

  recognition.onresult = (event) => {
    let currentInterim = "";

    // Process all results, storing finals by index to prevent duplicates
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();

      if (result.isFinal) {
        // Only store if we haven't already stored this index
        // This prevents mobile browsers from adding duplicates
        if (finalTranscriptParts[i] === undefined && transcript) {
          finalTranscriptParts[i] = transcript;
        }
      } else {
        // Only show interim for the latest non-final result
        currentInterim = transcript;
      }
    }

    // Build display from stored final parts (filter out empty slots)
    const finalDisplay = finalTranscriptParts.filter(Boolean).join(" ");

    // Show final + interim
    let displayText = finalDisplay;
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
    finalTranscriptParts = [];
    lastInterimTranscript = "";
    voiceTranscript.innerHTML = "<em>Listening...</em>";
    recognition.start();
  }
}

function clearVoiceTranscript() {
  finalTranscriptParts = [];
  lastInterimTranscript = "";
  voiceTranscript.innerHTML = "<em>Voice transcript will appear here...</em>";
}

function processVoiceTranscript(transcript) {
  // Remove consecutive duplicate words (common mobile speech recognition issue)
  const deduplicatedTranscript = deduplicateConsecutiveWords(transcript);

  // Normalize and split by "next"
  const normalized = deduplicatedTranscript
    .toLowerCase()
    .replace(/,?\s*next\s*,?/gi, "\n")
    .replace(/,/g, "\n")
    .trim();

  // Parse each line
  const lines = normalized.split("\n").filter((line) => line.trim());
  const parsedItems = [];

  for (const line of lines) {
    const parsed = parseItemLine(line.trim());
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

function parseItemLine(line) {
  // Try to extract quantity and item name
  // Patterns: "5 hdmi cables", "five hdmi cables", "hdmi cable"

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
      name: capitalizeWords(numMatch[2]),
    };
  }

  // Check for word number at start
  const words = line.split(/\s+/);
  const firstWord = words[0].toLowerCase();
  if (wordToNum[firstWord]) {
    return {
      quantity: wordToNum[firstWord],
      name: capitalizeWords(words.slice(1).join(" ")),
    };
  }

  // Check for "a" or "an" at start (means 1)
  if (firstWord === "a" || firstWord === "an") {
    return {
      quantity: 1,
      name: capitalizeWords(words.slice(1).join(" ")),
    };
  }

  // Default to quantity 1
  if (line.trim()) {
    return {
      quantity: 1,
      name: capitalizeWords(line),
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
  const namespace = binNamespaceInput.value.trim() || "Bin";
  const number = binNumberInput.value || "1";
  return `${namespace} ${number}`;
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
    showToast("Please enter bin contents first", "error");
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
  const binData = {
    id: currentBinId,
    name: binName,
    namespace: binNamespaceInput.value.trim(),
    number: parseInt(binNumberInput.value) || 1,
    items: items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveBin(currentBinId, binData);
  saveSettings();

  // Render labels
  renderLabels(binData);

  showToast("Label generated successfully!", "success");
}

function renderLabels(binData) {
  const itemsPerPage = parseInt(itemsPerPageInput.value) || 10;
  const barcodeUrl = barcodeUrlInput.value || "";
  const fullBarcodeUrl = barcodeUrl + binData.id;

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
                        <div class="label-bin-name">${escapeHtml(
                          binData.name
                        )}</div>
                        <div class="label-bin-id">ID: ${binData.id}</div>
                    </div>
                `
                    : `
                    <div class="label-continuation">
                        (Continued from ${escapeHtml(binData.name)})
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

                <div class="label-barcode-section">
                    <div class="label-barcode">${binData.id}</div>
                    <div class="label-barcode-text">${escapeHtml(
                      fullBarcodeUrl
                    )}</div>
                </div>

                ${
                  totalPages > 1
                    ? `
                    <div class="label-page-indicator">Page ${
                      pageIndex + 1
                    } of ${totalPages}</div>
                `
                    : ""
                }
            </div>
        `;
  });

  labelPreview.innerHTML = html;
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
}

function loadBinToEditor(binId) {
  const bins = getBins();
  const bin = bins[binId];

  if (!bin) {
    showToast("Bin not found", "error");
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

  showToast(`Loaded ${bin.name}`, "success");
}

function updateBinsList(bins) {
  const binIds = Object.keys(bins);
  binCount.textContent = binIds.length;

  if (binIds.length === 0) {
    binsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <p>No bins saved yet</p>
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
  if (confirm("Are you sure you want to delete this bin?")) {
    deleteBin(binId);

    // Clear editor if this was the current bin
    if (currentBinId === binId) {
      clearAll();
      currentBinId = null;
    }

    showToast("Bin deleted", "success");
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
