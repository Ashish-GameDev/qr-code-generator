/*
 * QR Code Generator
 * -----------------
 * qrcodejs is used as the encoder. We read its module matrix and draw the
 * result ourselves so PNG/SVG exports have a proper quiet zone (the blank
 * border scanners need) and use exactly the colors and size you choose.
 */

(function () {
  "use strict";

  var MAX_BYTES = 1000;   // keeps input within QR capacity at error level M
  var QUIET_ZONE = 4;     // blank modules around the code, in module units

  var els = {
    text: document.getElementById("qr-text"),
    charCount: document.getElementById("char-count"),
    error: document.getElementById("text-error"),
    fgColor: document.getElementById("fg-color"),
    fgHex: document.getElementById("fg-hex"),
    bgColor: document.getElementById("bg-color"),
    bgHex: document.getElementById("bg-hex"),
    size: document.getElementById("qr-size"),
    sizeValue: document.getElementById("size-value"),
    canvas: document.getElementById("qr-canvas"),
    placeholder: document.getElementById("preview-placeholder"),
    meta: document.getElementById("qr-meta"),
    downloadPng: document.getElementById("download-png"),
    downloadSvg: document.getElementById("download-svg"),
    copyImage: document.getElementById("copy-image"),
    copyText: document.getElementById("copy-text"),
    toast: document.getElementById("toast")
  };

  var state = {
    model: null,
    text: "",
    dark: "#111827",
    light: "#ffffff",
    size: 512,
    encodeError: ""
  };

  var encoder = new TextEncoder();
  var debounceTimer = null;
  var toastTimer = null;

  /* ---------- Small helpers ---------- */

  function byteLength(text) {
    return encoder.encode(text).length;
  }

  // Accept #RGB or #RRGGBB (with or without the leading #).
  function normalizeHex(value) {
    var hex = String(value).trim();
    if (hex.charAt(0) !== "#") hex = "#" + hex;

    if (/^#[0-9a-f]{3}$/i.test(hex)) {
      hex = "#" + hex.slice(1).split("").map(function (c) { return c + c; }).join("");
    }
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : null;
  }

  function showToast(message, isError) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.toggle("error", Boolean(isError));
    els.toast.classList.add("show");
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("show");
    }, 2600);
  }

  function setError(message) {
    els.error.textContent = message || "";
  }

  function updateCounter() {
    var bytes = byteLength(els.text.value);
    els.charCount.textContent = bytes + " / " + MAX_BYTES + " bytes";
    els.charCount.classList.toggle("near-limit", bytes > MAX_BYTES * 0.8 && bytes <= MAX_BYTES);
    els.charCount.classList.toggle("over-limit", bytes > MAX_BYTES);
  }

  function showPlaceholder(show) {
    els.canvas.classList.toggle("is-hidden", show);
    els.placeholder.classList.toggle("is-hidden", !show);
  }

  /* ---------- QR creation & drawing ---------- */

  // Let qrcodejs do the encoding, then keep its module matrix.
  function encode(text) {
    var host = document.createElement("div");
    var qr = new QRCode(host, {
      text: text,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
    var model = qr._oQRCode;
    host.remove();
    if (!model) throw new Error("QR encoding failed");
    return model;
  }

  // Draw the matrix onto any canvas at an exact pixel size.
  function paint(canvas, model, size, dark, light) {
    canvas.width = size;
    canvas.height = size;

    var ctx = canvas.getContext("2d");
    var count = model.getModuleCount();
    var total = count + QUIET_ZONE * 2;
    var unit = size / total;

    ctx.fillStyle = light;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = dark;

    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (!model.isDark(row, col)) continue;
        var x1 = Math.round((col + QUIET_ZONE) * unit);
        var y1 = Math.round((row + QUIET_ZONE) * unit);
        var x2 = Math.round((col + QUIET_ZONE + 1) * unit);
        var y2 = Math.round((row + QUIET_ZONE + 1) * unit);
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }
    }
    return canvas;
  }

  function makeCanvas() {
    return document.createElement("canvas");
  }

  function buildSvg(model, size, dark, light) {
    var count = model.getModuleCount();
    var total = count + QUIET_ZONE * 2;
    var path = "";

    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (model.isDark(row, col)) {
          path += "M" + (col + QUIET_ZONE) + " " + (row + QUIET_ZONE) + "h1v1h-1z";
        }
      }
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 ' + total + " " + total + '" shape-rendering="crispEdges" role="img" aria-label="QR code">\n' +
      '  <rect width="' + total + '" height="' + total + '" fill="' + light + '"/>\n' +
      '  <path d="' + path + '" fill="' + dark + '"/>\n' +
      "</svg>\n";
  }

  /* ---------- Core update flow ---------- */

  function render() {
    // Same foreground and background would make an unreadable (invisible) code.
    var colorConflict = Boolean(state.model) && state.dark === state.light;
    var message = state.encodeError ||
      (colorConflict ? "Foreground and background must be different colors so the code stays scannable." : "");
    var ready = Boolean(state.model) && !message;

    setError(message);
    showPlaceholder(!ready);
    ["downloadPng", "downloadSvg", "copyImage", "copyText"].forEach(function (key) {
      els[key].disabled = !ready;
    });

    if (ready) {
      paint(els.canvas, state.model, state.size, state.dark, state.light);
      els.meta.textContent = state.model.getModuleCount() + " × " + state.model.getModuleCount() +
        " modules  ·  " + state.size + " × " + state.size + " px";
    } else {
      els.meta.textContent = state.model ? "Fix the issue above to preview your code." : "Waiting for input…";
    }
  }

  function rebuild() {
    var text = els.text.value.trim();

    if (!text) {
      state.model = null;
      state.text = "";
      state.encodeError = "";
      render();
      return;
    }

    var bytes = byteLength(text);
    if (bytes > MAX_BYTES) {
      state.model = null;
      state.encodeError = "That's a bit too long (" + bytes + " / " + MAX_BYTES + " bytes). Try shortening it.";
      render();
      return;
    }

    try {
      state.model = encode(text);
      state.text = text;
      state.encodeError = "";
    } catch (err) {
      state.model = null;
      state.encodeError = "We couldn't generate a QR code from that input. Please try something shorter.";
    }
    render();
  }

  function scheduleRebuild() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rebuild, 150);
  }

  /* ---------- Export actions ---------- */

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadPng() {
    if (!state.model) return;
    var canvas = paint(makeCanvas(), state.model, state.size, state.dark, state.light);
    canvas.toBlob(function (blob) {
      if (blob) {
        triggerDownload(blob, "qrcode.png");
        showToast("PNG downloaded");
      } else {
        showToast("Could not create the PNG. Please try again.", true);
      }
    }, "image/png");
  }

  function downloadSvg() {
    if (!state.model) return;
    var svg = buildSvg(state.model, state.size, state.dark, state.light);
    triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "qrcode.svg");
    showToast("SVG downloaded");
  }

  async function copyImage() {
    if (!state.model) return;
    var canvas = paint(makeCanvas(), state.model, state.size, state.dark, state.light);
    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });

    if (!blob || !navigator.clipboard || typeof ClipboardItem === "undefined") {
      throw new Error("Image clipboard is not supported here");
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }

  async function copyTextValue() {
    var text = state.text;
    if (!text) return;

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback for file:// and other non-secure contexts.
    var field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    var ok = document.execCommand("copy");
    field.remove();
    if (!ok) throw new Error("Copy failed");
  }

  function handleCopy(name, task) {
    task()
      .then(function () { showToast(name + " copied to clipboard"); })
      .catch(function () {
        showToast(name === "Image" ? "Image copy isn't supported here — use Download PNG." : "Couldn't copy the text. Please try again.", true);
      });
  }

  /* ---------- Events ---------- */

  els.text.addEventListener("input", function () {
    updateCounter();
    scheduleRebuild();
  });

  function bindColor(kind) {
    var picker = els[kind + "Color"];
    var hex = els[kind + "Hex"];
    var prop = kind === "fg" ? "dark" : "light";

    picker.addEventListener("input", function () {
      hex.value = picker.value;
      hex.classList.remove("invalid");
      state[prop] = picker.value;
      render();
    });

    hex.addEventListener("input", function () {
      var color = normalizeHex(hex.value);
      if (color) {
        state[prop] = color;
        picker.value = color;
        hex.classList.remove("invalid");
        render();
      } else {
        hex.classList.add("invalid");
      }
    });

    // If the user leaves an invalid hex value, restore the last valid color.
    hex.addEventListener("blur", function () {
      hex.value = state[prop];
      hex.classList.remove("invalid");
    });
  }

  bindColor("fg");
  bindColor("bg");

  els.size.addEventListener("input", function () {
    state.size = Number(els.size.value);
    els.sizeValue.textContent = state.size + " px";
    render();
  });

  els.downloadPng.addEventListener("click", downloadPng);
  els.downloadSvg.addEventListener("click", downloadSvg);
  els.copyImage.addEventListener("click", function () { handleCopy("Image", copyImage); });
  els.copyText.addEventListener("click", function () { handleCopy("Text", copyTextValue); });

  /* ---------- Init ---------- */
  state.dark = normalizeHex(els.fgHex.value);
  state.light = normalizeHex(els.bgHex.value);
  state.size = Number(els.size.value);
  els.sizeValue.textContent = state.size + " px";
  updateCounter();
  rebuild();
})();
