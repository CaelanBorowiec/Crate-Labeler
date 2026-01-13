# 📦 Bin Inventory Labeler

A fully client-side web application for creating printable inventory labels for storage bins. Features voice input, barcode generation, and PDF export—all without requiring a server or database.

![Made with HTML/CSS/JS](https://img.shields.io/badge/Made%20with-HTML%2FCSS%2FJS-blue)
![No Server Required](https://img.shields.io/badge/Server-Not%20Required-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- **Voice Input** — Dictate your inventory items using the Web Speech API. Say "next" to move to a new line.
- **Text Input** — Traditional keyboard entry with support for `[quantity] [item name]` format.
- **Smart Parsing** — Automatically converts spoken numbers ("five HDMI cables") to digits.
- **Multi-Page Labels** — Long item lists automatically split across multiple labels.
- **Barcode Generation** — Each bin gets a unique ID rendered as a scannable Code 128 barcode.
- **Namespace System** — Organize bins into groups (e.g., "Audio Gear 1", "Audio Gear 2") with auto-increment.
- **PDF Export** — Download labels as print-ready PDFs (4" × 6" format).
- **Local Storage** — All bin data persists in the browser—no account needed.
- **Print Ready** — Optimized print stylesheet for direct printing.

## 🚀 Getting Started

### Quick Start

1. Clone or download this repository
2. Open `index.html` in a modern web browser (Chrome or Edge recommended for voice input)
3. Start labeling!

```bash
git clone https://github.com/your-username/Crate-Packer.git
cd Crate-Packer
# Open index.html in your browser
```

> **Note:** No build step, server, or installation required. Just open the HTML file.

### Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Core App | ✅ | ✅ | ✅ | ✅ |
| Voice Input | ✅ | ✅ | ❌ | ❌ |
| PDF Export | ✅ | ✅ | ✅ | ✅ |

## 📖 Usage

### Creating a Label

1. **Set the Bin Name**
   - Enter a namespace (e.g., "Audio Gear", "Power Supplies")
   - Set the bin number (auto-increments when you click "Next Bin")

2. **Add Contents** — Choose your input method:

   **Text Input:**
   ```
   5 HDMI Cable 6ft
   3 USB-C Adapter
   2 Power Strip
   10 Cable Ties
   ```

   **Voice Input:**
   - Click "🎤 Start Voice Input"
   - Speak: "5 HDMI cables, next, 3 USB adapters, next, 2 power strips"
   - Say "next" to separate items
   - Click "🛑 Stop Listening" when done

3. **Generate & Print**
   - Click "🏷️ Generate Label" to preview
   - Click "🖨️ Print Labels" or "📄 Download PDF"

### Label Format

```
┌─────────────────────────────────┐
│         AUDIO GEAR 1            │
│     ID: BIN-M4X7K2-A3B9         │
├─────────────────────────────────┤
│ Contents:                       │
│   5x  HDMI Cable 6ft            │
│   3x  USB-C Adapter             │
│   2x  Power Strip               │
│  10x  Cable Ties                │
├─────────────────────────────────┤
│     ║║│║║│║│║║║│║║│║║║║         │
│   BIN-M4X7K2-A3B9               │
└─────────────────────────────────┘
```

### Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Barcode Base URL** | URL prefix for barcode links (bin ID appended) | `https://inventory.example.com/bin/` |
| **Items Per Label** | Maximum items before splitting to a new page | `10` |

## 🗂️ Project Structure

```
Crate-Packer/
├── index.html              # Main HTML structure
├── README.md               # This file
└── assets/
    ├── css/
    │   └── styles.css      # Application styles
    ├── fonts/
    │   ├── LibreBarcode128-Regular.ttf   # Barcode font
    │   └── LibreBarcode39-Regular.ttf    # Alternative barcode font
    └── js/
        ├── app.js                        # Application logic
        ├── html2canvas.min.js            # Screenshot library for PDF
        └── jspdf.umd.min.js              # PDF generation library
```

## 🔧 Technical Details

### Data Storage

All data is stored in the browser's `localStorage`:

- **`binInventory`** — Saved bins with their contents
- **`binInventorySettings`** — User preferences (barcode URL, items per page)

### Bin ID Format

Each bin receives a unique identifier:
```
BIN-{timestamp_base36}-{random_4char}
Example: BIN-M4X7K2-A3B9
```

### Voice Recognition

Uses the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) with:
- Continuous recognition mode
- Interim results for live feedback
- "next" keyword detection for line breaks
- Word-to-number conversion ("five" → 5)

### Print Specifications

Labels are optimized for **4" × 6" thermal label printers** (common shipping label size), but work with standard printers as well.

## 🎨 Customization

### Changing Label Size

Modify the `.label-page` CSS class in `assets/css/styles.css`:

```css
.label-page {
    width: 4in;      /* Change width */
    min-height: 6in; /* Change height */
    /* ... */
}
```

Also update the `@page` rule in print styles:

```css
@page {
    size: 4in 6in;  /* Match label dimensions */
    margin: 0;
}
```

### Changing Barcode Type

The app uses Code 128 barcodes via the LibreBarcode font. To use Code 39 instead, change in `assets/css/styles.css`:

```css
.label-barcode {
    font-family: 'LibreBarcode39', monospace;  /* Instead of LibreBarcode128 */
}
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

- [ ] QR code option in addition to barcodes
- [ ] Export/import bin data as JSON
- [ ] Multiple label size presets
- [ ] Search and filter saved bins
- [ ] Batch print multiple bins
- [ ] Custom label templates

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [jsPDF](https://github.com/parallax/jsPDF) — PDF generation
- [html2canvas](https://html2canvas.hertzen.com/) — HTML to canvas rendering
- [Libre Barcode](https://fonts.google.com/specimen/Libre+Barcode+128) — Barcode fonts by Google Fonts
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — Voice recognition

---

<p align="center">
  Made with ❤️ for organizing chaos
</p>
