# QR Code Generator

A simple, modern, responsive QR code generator that runs entirely in your browser. No build tools, no server, no internet connection needed.

**Live demo (hosted with GitHub Pages from this repo):** https://ashish-gamedev.github.io/qr-code-generator/

## Features

- Generate QR codes from any text, URL, or other content
- Customize foreground and background colors
- Choose output size (128–1024 px)
- Instant live preview while you type
- Download as PNG or SVG
- Copy the QR image or the encoded text to the clipboard
- Input validation and helpful error messages

## How to run

Use the hosted URL above, or open `index.html` in any modern web browser. That's it.

Everything is processed locally — your data is never uploaded anywhere.

## Files

- `index.html` — page structure
- `styles.css` — layout, theme, and responsive styles
- `app.js` — validation, QR rendering, export, and clipboard logic
- `vendor/qrcode.min.js` — [qrcodejs](https://github.com/davidshimjs/qrcodejs), bundled locally for offline use

## Notes

- QR codes include a 4-module quiet zone (blank border) so they scan reliably.
- Error correction level is set to `M` (medium) for a good balance of capacity and robustness.
- Clipboard image copying requires a browser that supports the async Clipboard API. If it isn't available, use **Download PNG** instead.
