# Crate Inventory Labeler

A simple web app for creating printable labels for storage crates. Everything runs in your browser—no server, no database, no hassle. Just open the HTML file and start labeling.

![Made with HTML/CSS/JS](https://img.shields.io/badge/Made%20with-HTML%2FCSS%2FJS-blue)
![No Server Required](https://img.shields.io/badge/Server-Not%20Required-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

![Crate Labeler Screenshot](crate-labeler-example.png)

## Features

- **Voice input** - Talk to your computer and it'll type for you. Say "next" to move to a new line. Works best in Chrome/Edge on non-mobile devices.
- **Text input** - Old school typing. Use `[quantity] [item name]` format if you want.
- **Smart number parsing** - Converts spoken numbers like "five" to digits automatically.
- **Multi-page labels** - Long lists automatically split across multiple pages.
- **Barcode generation** - Each crate gets a unique ID with a scannable Code 128 barcode.
- **Namespace system** - Group your crates (like "Audio Gear 1", "Audio Gear 2") and it'll auto-increment the numbers.
- **PDF export** - Download labels as PDFs ready to print (4" × 6" format).
- **Local storage** - Everything saves in your browser. No accounts, no cloud, no nonsense.
- **Print ready** - Optimized for printing, but honestly it works fine for screen viewing too.

## Getting Started

Just download or clone this repo and open `index.html` in a browser. That's it. No build step, no npm install, no server to run.

```bash
git clone https://github.com/your-username/Crate-Packer.git
cd Crate-Packer
# Now just open index.html in your browser
```

**Browser notes:** Voice input only works in Chrome and Edge right now. Everything else works fine in Firefox and Safari too.

## How to Use

### Creating a Label

1. Set your crate name - enter a namespace (like "Audio Gear" or "Power Supplies") and a number. The number auto-increments when you click "Next Crate".

2. Add your items. You can type them in:

   ```
   5 HDMI Cable 6ft
   3 USB-C Adapter
   2 Power Strip
   10 Cable Ties
   ```

   Or use voice input:

   - Click "Start Voice Input"
   - Say something like "5 HDMI cables, next, 3 USB adapters, next, 2 power strips"
   - Say "next" between items to separate them
   - Click "Stop Listening" when you're done

3. Generate and print - Click "Generate Label" to see a preview, then either print directly or download as PDF.

### What the Labels Look Like

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

### Settings

There are a couple settings you can tweak:

- **Barcode Base URL** - If you want the barcode to link somewhere, set this. Defaults to a placeholder.
- **Items Per Label** - How many items fit on one label before it splits to a new page. Default is 10.

## Project Structure

```
Crate-Packer/
├── index.html              # Main HTML file
├── README.md               # This file
└── assets/
    ├── css/
    │   └── styles.css      # All the styling
    ├── fonts/
    │   ├── LibreBarcode128-Regular.ttf   # Barcode font
    │   └── LibreBarcode39-Regular.ttf    # Alternative barcode font
    └── js/
        ├── app.js                        # Main app logic
        ├── html2canvas.min.js            # For PDF generation
        └── jspdf.umd.min.js              # PDF library
```

## Technical Stuff

### Data Storage

Everything is stored in your browser's `localStorage`:

- `binInventory` - All your saved crates and their contents
- `binInventorySettings` - Your preferences (barcode URL, items per page, etc.)

### Crate IDs

Each crate gets a unique ID that looks like:

```
BIN-{timestamp_base36}-{random_4char}
Example: BIN-M4X7K2-A3B9
```

### Voice Recognition

Uses the Web Speech API. It's pretty straightforward - continuous recognition, live feedback, and it converts words to numbers ("five" becomes 5). The "next" keyword triggers a line break.

### Print Specs

Labels are sized for 4" × 6" thermal label printers (the standard shipping label size), but they'll print fine on regular paper too.

## Customization

### Changing Label Size

If you want different dimensions, edit the `.label-page` class in `assets/css/styles.css`:

```css
.label-page {
  width: 4in; /* Change this */
  min-height: 6in; /* And this */
}
```

Also update the `@page` rule:

```css
@page {
  size: 4in 6in; /* Match your dimensions */
  margin: 0;
}
```

### Changing Barcode Type

The app uses Code 128 by default. To switch to Code 39, change the font in `assets/css/styles.css`:

```css
.label-barcode {
  font-family: "LibreBarcode39", monospace; /* Instead of LibreBarcode128 */
}
```

## TODO

- [ ] Mobile layout improvements
- [ ] Capitalization fixes - don't remove caps from proper names like XLR and HDMI
- [ ] Recall crates with barcodes
- [ ] Base URL autodetect
- [ ] No data warning when trying to load a create we dont know about

## Contributing

If you want to add something or fix a bug, go for it. Fork the repo, make your changes, and open a pull request. I'm not super strict about it.

## Future Ideas

Things I might add eventually (or you could add):

- QR codes as an option
- Export/import crate data as JSON
- Different label size presets
- Search through saved crates
- Batch print multiple crates
- Custom label templates

## License

MIT License - do whatever you want with it.

## Credits

Built using:

- [jsPDF](https://github.com/parallax/jsPDF) for PDF generation
- [html2canvas](https://html2canvas.hertzen.com/) for converting HTML to images
- [Libre Barcode](https://fonts.google.com/specimen/Libre+Barcode+128) fonts from Google Fonts
- Web Speech API for voice recognition
