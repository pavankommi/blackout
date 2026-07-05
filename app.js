"use strict";

const dropzone = document.getElementById("dropzone");
const browseBtn = document.getElementById("browseBtn");
const fileInput = document.getElementById("fileInput");
const canvasWrap = document.getElementById("canvasWrap");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const toolbar = document.getElementById("toolbar");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const newBtn = document.getElementById("newBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const formatSelect = document.getElementById("format");
const hint = document.getElementById("hint");

let bitmap = null;      // ImageBitmap, EXIF orientation already applied
let baseName = "image";
let rects = [];         // {x, y, w, h} in natural image-pixel coordinates
let drag = null;

const MIN_RECT_PX = 3;  // ignore accidental clicks

// ---------- loading ----------

async function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    hint.textContent = "not an image file";
    return;
  }
  try {
    // Bake EXIF rotation into pixels — export strips EXIF, so it can't live there.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    hint.textContent = "could not decode this image";
    return;
  }
  baseName = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
  rects = [];
  drag = null;
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  dropzone.hidden = true;
  canvasWrap.hidden = false;
  toolbar.hidden = false;
  hint.textContent = "drag to draw a box · ⌘Z undo";
  render();
  updateButtons();
}

browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});
fileInput.addEventListener("change", () => {
  loadFile(fileInput.files[0]);
  fileInput.value = "";
});

window.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
window.addEventListener("dragleave", (e) => {
  if (e.relatedTarget === null) dropzone.classList.remove("dragover");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = [...(e.dataTransfer.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) loadFile(file);
});

window.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData.items || [])].find((i) => i.type.startsWith("image/"));
  if (item) loadFile(item.getAsFile());
});

// ---------- drawing ----------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  return {
    x: Math.max(0, Math.min(canvas.width, x)),
    y: Math.max(0, Math.min(canvas.height, y)),
  };
}

canvas.addEventListener("pointerdown", (e) => {
  if (!bitmap || e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  const p = canvasPoint(e);
  drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
});

canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  drag.x1 = p.x;
  drag.y1 = p.y;
  render();
});

canvas.addEventListener("pointerup", (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  drag.x1 = p.x;
  drag.y1 = p.y;
  const rect = normalizeRect(drag);
  drag = null;
  if (rect.w >= MIN_RECT_PX && rect.h >= MIN_RECT_PX) rects.push(rect);
  render();
  updateButtons();
});

canvas.addEventListener("pointercancel", () => {
  drag = null;
  render();
});

function normalizeRect(d) {
  return {
    x: Math.min(d.x0, d.x1),
    y: Math.min(d.y0, d.y1),
    w: Math.abs(d.x1 - d.x0),
    h: Math.abs(d.y1 - d.y0),
  };
}

function render() {
  ctx.drawImage(bitmap, 0, 0);
  ctx.fillStyle = "#000";
  for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h);
  if (drag) {
    const r = normalizeRect(drag);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

// ---------- actions ----------

function updateButtons() {
  undoBtn.disabled = rects.length === 0;
  clearBtn.disabled = rects.length === 0;
}

function undo() {
  rects.pop();
  render();
  updateButtons();
}

undoBtn.addEventListener("click", undo);

clearBtn.addEventListener("click", () => {
  rects = [];
  render();
  updateButtons();
});

newBtn.addEventListener("click", () => {
  bitmap = null;
  rects = [];
  drag = null;
  canvasWrap.hidden = true;
  toolbar.hidden = true;
  dropzone.hidden = false;
});

window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    if (bitmap && rects.length) {
      e.preventDefault();
      undo();
    }
  } else if (e.key === "Escape" && drag) {
    drag = null;
    render();
  }
});

// ---------- export ----------

// Fresh canvas re-encodes pixels only — all metadata is gone.
function flatten(type) {
  const out = document.createElement("canvas");
  out.width = bitmap.width;
  out.height = bitmap.height;
  const octx = out.getContext("2d");
  if (type === "image/jpeg") {
    octx.fillStyle = "#fff"; // JPEG has no alpha; flatten onto white
    octx.fillRect(0, 0, out.width, out.height);
  }
  octx.drawImage(bitmap, 0, 0);
  octx.fillStyle = "#000";
  for (const r of rects) octx.fillRect(r.x, r.y, r.w, r.h);
  return out;
}

exportBtn.addEventListener("click", async () => {
  if (!bitmap) return;
  const type = formatSelect.value;
  const out = flatten(type);
  const blob = await new Promise((resolve) => out.toBlob(resolve, type, 0.92));
  if (!blob) {
    hint.textContent = "export failed — image may be too large";
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}-redacted.${type === "image/png" ? "png" : "jpg"}`;
  a.click();
  URL.revokeObjectURL(url);
  hint.textContent = `saved ${a.download} · flattened, metadata stripped`;
});

// Clipboard image writes are PNG-only; Safari needs the write to start
// inside the user gesture, hence the blob promise.
const clipboardSupported = !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
copyBtn.hidden = !clipboardSupported;

copyBtn.addEventListener("click", () => {
  if (!bitmap) return;
  const out = flatten("image/png");
  const blobPromise = new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png")
  );
  navigator.clipboard
    .write([new ClipboardItem({ "image/png": blobPromise })])
    .then(() => {
      hint.textContent = "copied to clipboard · flattened, metadata stripped";
    })
    .catch(() => {
      hint.textContent = "copy failed — use download instead";
    });
});

// ---------- offline ----------

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
