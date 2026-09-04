"use strict";

const $ = id => document.getElementById(id);
const state = {
  photos: [],
  activeId: null,
  dragging: false,
  pointer: { x: 0, y: 0 },
  photoSize: { w: 35, h: 45 },
  paperSize: { w: 210, h: 297 },
  layout: null
};

const cropCanvas = $("cropCanvas");
const cropCtx = cropCanvas.getContext("2d", { alpha: false });
const sheetCanvas = $("sheetCanvas");
const sheetCtx = sheetCanvas.getContext("2d", { alpha: false });

function activePhoto() {
  return state.photos.find(photo => photo.id === state.activeId) || null;
}

function cropDimensions() {
  const width = 700;
  return { width, height: Math.round(width * state.photoSize.h / state.photoSize.w) };
}

function ensureCropState(photo, reset = false) {
  const { width, height } = cropDimensions();
  cropCanvas.width = width;
  cropCanvas.height = height;
  const base = Math.max(width / photo.image.naturalWidth, height / photo.image.naturalHeight);
  if (reset || !photo.crop) {
    photo.crop = {
      zoom: 1,
      x: (width - photo.image.naturalWidth * base) / 2,
      y: (height - photo.image.naturalHeight * base) / 2
    };
  }
  photo.crop.zoom = Math.max(1, Math.min(5, photo.crop.zoom));
  clampCrop(photo);
}

function cropScale(photo) {
  const { width, height } = cropDimensions();
  return Math.max(width / photo.image.naturalWidth, height / photo.image.naturalHeight) * photo.crop.zoom;
}

function clampCrop(photo) {
  const { width, height } = cropDimensions();
  const scale = cropScale(photo);
  const drawnW = photo.image.naturalWidth * scale;
  const drawnH = photo.image.naturalHeight * scale;
  photo.crop.x = Math.min(0, Math.max(width - drawnW, photo.crop.x));
  photo.crop.y = Math.min(0, Math.max(height - drawnH, photo.crop.y));
}

function renderCrop() {
  const photo = activePhoto();
  const { width, height } = cropDimensions();
  if (cropCanvas.width !== width || cropCanvas.height !== height) {
    cropCanvas.width = width;
    cropCanvas.height = height;
  }
  cropCtx.fillStyle = "#243a46";
  cropCtx.fillRect(0, 0, width, height);
  if (!photo) return;
  ensureCropState(photo);
  const scale = cropScale(photo);
  cropCtx.drawImage(photo.image, photo.crop.x, photo.crop.y, photo.image.naturalWidth * scale, photo.image.naturalHeight * scale);

  cropCtx.save();
  cropCtx.fillStyle = "rgba(7, 24, 34, .28)";
  const faceTop = height * .095;
  const faceBottom = height * .895;
  cropCtx.fillRect(0, 0, width, faceTop);
  cropCtx.fillRect(0, faceBottom, width, height - faceBottom);

  cropCtx.strokeStyle = "rgba(69, 210, 235, .95)";
  cropCtx.lineWidth = 3;
  cropCtx.setLineDash([]);
  const eyeY = height * .42;
  cropCtx.beginPath();
  cropCtx.moveTo(0, eyeY);
  cropCtx.lineTo(width, eyeY);
  cropCtx.stroke();

  cropCtx.strokeStyle = "rgba(233, 162, 59, .95)";
  cropCtx.lineWidth = 3;
  cropCtx.setLineDash([12, 9]);
  cropCtx.strokeRect(width * .18, faceTop, width * .64, faceBottom - faceTop);

  cropCtx.strokeStyle = "rgba(255,255,255,.72)";
  cropCtx.lineWidth = 2;
  cropCtx.setLineDash([8, 10]);
  cropCtx.beginPath();
  cropCtx.moveTo(width / 2, 0);
  cropCtx.lineTo(width / 2, height);
  cropCtx.stroke();
  cropCtx.restore();
}

function addFiles(fileList) {
  const files = [...fileList].filter(file => /^image\/(jpeg|png|webp)$/i.test(file.type));
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const photo = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          name: file.name,
          url: reader.result,
          image,
          crop: null,
          copies: 4
        };
        state.photos.push(photo);
        state.activeId = photo.id;
        ensureCropState(photo, true);
        refreshAll();
      };
      image.onerror = () => setStatus(`Impossible de lire ${file.name}.`);
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoList() {
  const list = $("photoList");
  list.replaceChildren();
  state.photos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = `photo-item${photo.id === state.activeId ? " active" : ""}`;
    item.dataset.id = photo.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Cadrer ${photo.name}`);
    const thumb = document.createElement("img");
    thumb.src = photo.url;
    thumb.alt = "";
    const meta = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = photo.name;
    const detail = document.createElement("small");
    detail.textContent = `Photo ${index + 1}`;
    meta.append(name, detail);
    const copyLabel = document.createElement("label");
    copyLabel.className = "copy-input";
    copyLabel.textContent = "Copies";
    const copyInput = document.createElement("input");
    copyInput.type = "number";
    copyInput.min = "0";
    copyInput.max = "99";
    copyInput.value = photo.copies;
    copyInput.disabled = $("autoFill").checked;
    copyInput.setAttribute("aria-label", `Nombre de copies de ${photo.name}`);
    copyInput.addEventListener("click", event => event.stopPropagation());
    copyInput.addEventListener("keydown", event => event.stopPropagation());
    copyInput.addEventListener("input", event => {
      photo.copies = Math.max(0, Math.min(99, Number(event.target.value) || 0));
      renderSheet();
    });
    copyLabel.append(copyInput);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "×";
    remove.title = `Retirer ${photo.name}`;
    remove.setAttribute("aria-label", `Retirer ${photo.name}`);
    remove.addEventListener("click", event => {
      event.stopPropagation();
      state.photos = state.photos.filter(candidate => candidate.id !== photo.id);
      if (state.activeId === photo.id) state.activeId = state.photos[0]?.id || null;
      refreshAll();
    });
    item.append(thumb, meta, copyLabel, remove);
    item.addEventListener("click", () => {
      state.activeId = photo.id;
      ensureCropState(photo);
      refreshAll();
    });
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        state.activeId = photo.id;
        ensureCropState(photo);
        refreshAll();
      }
    });
    list.append(item);
  });
  $("photoCount").textContent = state.photos.length;
  $("emptyPhotos").hidden = state.photos.length > 0;
}

function readSizes() {
  if ($("photoFormat").value === "custom") {
    state.photoSize = { w: numberValue("photoWidth", 35), h: numberValue("photoHeight", 45) };
  } else {
    const [w, h] = $("photoFormat").value.split("x").map(Number);
    state.photoSize = { w, h };
  }
  if ($("paperFormat").value === "custom") {
    state.paperSize = { w: numberValue("paperWidth", 210), h: numberValue("paperHeight", 297) };
  } else {
    const [w, h] = $("paperFormat").value.split("x").map(Number);
    state.paperSize = { w, h };
  }
}

function numberValue(id, fallback) {
  const value = Number($(id).value);
  return Number.isFinite(value) ? value : fallback;
}

function calculateLayout() {
  readSizes();
  const margin = Math.max(0, numberValue("margin", 8));
  const gap = Math.max(0, numberValue("gap", 3));
  const { w: paperW, h: paperH } = state.paperSize;
  const { w: photoW, h: photoH } = state.photoSize;
  const cols = Math.max(0, Math.floor((paperW - 2 * margin + gap) / (photoW + gap)));
  const rows = Math.max(0, Math.floor((paperH - 2 * margin + gap) / (photoH + gap)));
  const capacity = cols * rows;
  const gridW = cols ? cols * photoW + (cols - 1) * gap : 0;
  const gridH = rows ? rows * photoH + (rows - 1) * gap : 0;
  return { margin, gap, paperW, paperH, photoW, photoH, cols, rows, capacity, startX: (paperW - gridW) / 2, startY: (paperH - gridH) / 2 };
}

function slotPhotos(layout) {
  if (!state.photos.length || !layout.capacity) return [];
  if ($("autoFill").checked) {
    return Array.from({ length: layout.capacity }, (_, index) => state.photos[index % state.photos.length]);
  }
  const result = [];
  state.photos.forEach(photo => {
    for (let i = 0; i < photo.copies && result.length < layout.capacity; i += 1) result.push(photo);
  });
  return result;
}

function drawCropped(ctx, photo, x, y, width, height) {
  const dims = cropDimensions();
  const scale = cropScale(photo);
  const sourceX = -photo.crop.x / scale;
  const sourceY = -photo.crop.y / scale;
  const sourceW = dims.width / scale;
  const sourceH = dims.height / scale;
  ctx.drawImage(photo.image, sourceX, sourceY, sourceW, sourceH, x, y, width, height);
}

function renderSheet() {
  const layout = calculateLayout();
  state.layout = layout;
  const previewScale = Math.min(3, 900 / Math.max(layout.paperW, layout.paperH));
  sheetCanvas.width = Math.max(1, Math.round(layout.paperW * previewScale));
  sheetCanvas.height = Math.max(1, Math.round(layout.paperH * previewScale));
  sheetCtx.fillStyle = "#fff";
  sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  const slots = slotPhotos(layout);
  slots.forEach((photo, index) => {
    const col = index % layout.cols;
    const row = Math.floor(index / layout.cols);
    const x = (layout.startX + col * (layout.photoW + layout.gap)) * previewScale;
    const y = (layout.startY + row * (layout.photoH + layout.gap)) * previewScale;
    drawCropped(sheetCtx, photo, x, y, layout.photoW * previewScale, layout.photoH * previewScale);
    if ($("cutMarks").checked) drawPreviewMarks(sheetCtx, x, y, layout.photoW * previewScale, layout.photoH * previewScale, previewScale);
  });
  $("sheetEmpty").hidden = slots.length > 0;
  $("capacityBadge").textContent = `${layout.capacity} emplacement${layout.capacity > 1 ? "s" : ""}`;
  $("downloadPdf").disabled = slots.length === 0;
  if (state.photos.length && !layout.capacity) setStatus("Ce format de photo ne tient pas sur le papier avec les marges choisies.");
  else setStatus("");
}

function drawPreviewMarks(ctx, x, y, w, h, scale) {
  const length = Math.max(5, 3 * scale);
  ctx.save();
  ctx.strokeStyle = "#65737a";
  ctx.lineWidth = Math.max(1, .25 * scale);
  const corners = [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]];
  corners.forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(cx - sx * length, cy); ctx.lineTo(cx + sx * length, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - sy * length); ctx.lineTo(cx, cy + sy * length); ctx.stroke();
  });
  ctx.restore();
}

function refreshAll() {
  renderPhotoList();
  const photo = activePhoto();
  $("cropPlaceholder").hidden = Boolean(photo);
  $("zoomRange").disabled = !photo;
  $("resetCrop").disabled = !photo;
  if (photo) {
    ensureCropState(photo);
    $("zoomRange").value = photo.crop.zoom;
    $("zoomValue").textContent = `${Math.round(photo.crop.zoom * 100)} %`;
  } else {
    $("zoomValue").textContent = "100 %";
  }
  renderCrop();
  renderSheet();
}

function setZoom(value) {
  const photo = activePhoto();
  if (!photo) return;
  const dims = cropDimensions();
  const oldScale = cropScale(photo);
  const imageCenterX = (dims.width / 2 - photo.crop.x) / oldScale;
  const imageCenterY = (dims.height / 2 - photo.crop.y) / oldScale;
  photo.crop.zoom = Number(value);
  const newScale = cropScale(photo);
  photo.crop.x = dims.width / 2 - imageCenterX * newScale;
  photo.crop.y = dims.height / 2 - imageCenterY * newScale;
  clampCrop(photo);
  $("zoomValue").textContent = `${Math.round(photo.crop.zoom * 100)} %`;
  renderCrop();
  renderSheet();
}

function canvasPoint(event) {
  const rect = cropCanvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * cropCanvas.width / rect.width, y: (event.clientY - rect.top) * cropCanvas.height / rect.height };
}

cropCanvas.addEventListener("pointerdown", event => {
  if (!activePhoto()) return;
  state.dragging = true;
  state.pointer = canvasPoint(event);
  cropCanvas.setPointerCapture(event.pointerId);
});
cropCanvas.addEventListener("pointermove", event => {
  const photo = activePhoto();
  if (!photo || !state.dragging) return;
  const point = canvasPoint(event);
  photo.crop.x += point.x - state.pointer.x;
  photo.crop.y += point.y - state.pointer.y;
  state.pointer = point;
  clampCrop(photo);
  renderCrop();
  renderSheet();
});
cropCanvas.addEventListener("pointerup", () => { state.dragging = false; });
cropCanvas.addEventListener("pointercancel", () => { state.dragging = false; });
cropCanvas.addEventListener("wheel", event => {
  if (!activePhoto()) return;
  event.preventDefault();
  const next = Math.max(1, Math.min(5, Number($("zoomRange").value) + (event.deltaY < 0 ? .08 : -.08)));
  $("zoomRange").value = next;
  setZoom(next);
}, { passive: false });

function cropToJpeg(photo) {
  const targetW = Math.max(240, Math.round(state.photoSize.w / 25.4 * 300));
  const targetH = Math.max(240, Math.round(state.photoSize.h / 25.4 * 300));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawCropped(ctx, photo, 0, 0, targetW, targetH);
  const data = canvas.toDataURL("image/jpeg", .94).split(",")[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, width: targetW, height: targetH };
}

function buildPdf(layout, slots) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let length = 0;
  const pushBytes = bytes => { parts.push(bytes); length += bytes.length; };
  const pushText = value => pushBytes(enc.encode(value));
  pushBytes(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,0x25,0xe2,0xe3,0xcf,0xd3,0x0a]));

  const unique = [...new Map(slots.map(photo => [photo.id, photo])).values()];
  const imageData = unique.map(cropToJpeg);
  const imageObjectStart = 5;
  const objectCount = 4 + unique.length;
  const beginObject = number => { offsets[number] = length; pushText(`${number} 0 obj\n`); };
  const endObject = () => pushText("endobj\n");

  beginObject(1); pushText("<< /Type /Catalog /Pages 2 0 R >>\n"); endObject();
  beginObject(2); pushText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n"); endObject();
  const pt = mm => mm * 72 / 25.4;
  const resources = unique.map((_, i) => `/Im${i + 1} ${imageObjectStart + i} 0 R`).join(" ");
  beginObject(3); pushText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(layout.paperW).toFixed(4)} ${pt(layout.paperH).toFixed(4)}] /Resources << /XObject << ${resources} >> >> /Contents 4 0 R >>\n`); endObject();

  const commands = [];
  slots.forEach((photo, index) => {
    const col = index % layout.cols;
    const row = Math.floor(index / layout.cols);
    const x = pt(layout.startX + col * (layout.photoW + layout.gap));
    const top = layout.startY + row * (layout.photoH + layout.gap);
    const y = pt(layout.paperH - top - layout.photoH);
    const w = pt(layout.photoW);
    const h = pt(layout.photoH);
    const imageIndex = unique.findIndex(candidate => candidate.id === photo.id) + 1;
    commands.push(`q ${w.toFixed(4)} 0 0 ${h.toFixed(4)} ${x.toFixed(4)} ${y.toFixed(4)} cm /Im${imageIndex} Do Q`);
    if ($("cutMarks").checked) commands.push(...pdfCutMarks(x, y, w, h));
  });
  const content = enc.encode(commands.join("\n") + "\n");
  beginObject(4); pushText(`<< /Length ${content.length} >>\nstream\n`); pushBytes(content); pushText("endstream\n"); endObject();

  imageData.forEach((image, index) => {
    beginObject(imageObjectStart + index);
    pushText(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
    pushBytes(image.bytes); pushText("\nendstream\n"); endObject();
  });

  const xref = length;
  pushText(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objectCount; i += 1) pushText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const output = new Uint8Array(length);
  let cursor = 0;
  parts.forEach(part => { output.set(part, cursor); cursor += part.length; });
  return output;
}

function pdfCutMarks(x, y, w, h) {
  const mark = 7;
  const inset = 1.5;
  const commands = ["0.35 w 0.38 G"];
  [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([cx,cy,sx,sy]) => {
    commands.push(`${(cx-sx*mark).toFixed(3)} ${cy.toFixed(3)} m ${(cx-sx*inset).toFixed(3)} ${cy.toFixed(3)} l S`);
    commands.push(`${cx.toFixed(3)} ${(cy-sy*mark).toFixed(3)} m ${cx.toFixed(3)} ${(cy-sy*inset).toFixed(3)} l S`);
  });
  return commands;
}

function downloadPdf() {
  const layout = calculateLayout();
  const slots = slotPhotos(layout);
  if (!slots.length) return;
  setStatus("Préparation du PDF…", false);
  requestAnimationFrame(() => {
    try {
      const pdf = buildPdf(layout, slots);
      const blob = new Blob([pdf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `planche-photo-id-${layout.photoW}x${layout.photoH}mm-${layout.paperW}x${layout.paperH}mm.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatus("PDF généré. Impression : taille réelle, 100 %.", false);
    } catch (error) {
      console.error(error);
      setStatus("La génération du PDF a échoué. Réessayez avec des images plus petites.");
    }
  });
}

function setStatus(message, isError = true) {
  const target = $("status");
  target.textContent = message;
  target.style.color = isError ? "var(--danger)" : "var(--blue)";
}

$("photoInput").addEventListener("change", event => { addFiles(event.target.files); event.target.value = ""; });
$("dropZone").addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") $("photoInput").click(); });
["dragenter", "dragover"].forEach(type => $("dropZone").addEventListener(type, event => { event.preventDefault(); $("dropZone").classList.add("drag-over"); }));
["dragleave", "drop"].forEach(type => $("dropZone").addEventListener(type, event => { event.preventDefault(); $("dropZone").classList.remove("drag-over"); }));
$("dropZone").addEventListener("drop", event => addFiles(event.dataTransfer.files));
$("zoomRange").addEventListener("input", event => setZoom(event.target.value));
$("resetCrop").addEventListener("click", () => { const photo = activePhoto(); if (photo) { ensureCropState(photo, true); refreshAll(); } });
$("downloadPdf").addEventListener("click", downloadPdf);

$("photoFormat").addEventListener("change", () => {
  $("customPhotoSize").hidden = $("photoFormat").value !== "custom";
  readSizes();
  state.photos.forEach(photo => ensureCropState(photo, true));
  refreshAll();
});
$("paperFormat").addEventListener("change", () => { $("customPaperSize").hidden = $("paperFormat").value !== "custom"; refreshAll(); });
["photoWidth","photoHeight"].forEach(id => $(id).addEventListener("input", () => { readSizes(); state.photos.forEach(photo => ensureCropState(photo, true)); refreshAll(); }));
["paperWidth","paperHeight","autoFill","cutMarks","margin","gap"].forEach(id => $(id).addEventListener("input", refreshAll));

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

refreshAll();
