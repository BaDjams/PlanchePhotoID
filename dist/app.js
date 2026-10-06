"use strict";

const $ = id => document.getElementById(id);
const state = {
  photos: [],
  activeId: null,
  dragging: false,
  pointer: { x: 0, y: 0 },
  cropMode: "id",
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

function cropProperty(mode = state.cropMode) {
  return mode === "large" ? "largeCrop" : "crop";
}

function layoutMode() {
  return $("layoutMode").value;
}

function cropRatio(mode = state.cropMode) {
  return mode === "large" ? 1.5 : state.photoSize.h / state.photoSize.w;
}

function cropDimensions(mode = state.cropMode) {
  const width = 700;
  if (mode === "large") return { width, height: 1050 };
  const ratio = cropRatio(mode);
  if (ratio > 1.5) return { width: Math.max(1, Math.round(1050 / ratio)), height: 1050 };
  return { width, height: Math.max(1, Math.round(width * ratio)) };
}

function ensureCropState(photo, reset = false, mode = state.cropMode) {
  const { width, height } = cropDimensions(mode);
  const property = cropProperty(mode);
  const base = Math.max(width / photo.image.naturalWidth, height / photo.image.naturalHeight);
  if (reset || !photo[property]) {
    photo[property] = {
      zoom: 1,
      x: (width - photo.image.naturalWidth * base) / 2,
      y: (height - photo.image.naturalHeight * base) / 2
    };
  }
  photo[property].zoom = Math.max(1, Math.min(5, photo[property].zoom));
  clampCrop(photo, mode);
}

function cropScale(photo, mode = state.cropMode) {
  const { width, height } = cropDimensions(mode);
  return Math.max(width / photo.image.naturalWidth, height / photo.image.naturalHeight) * photo[cropProperty(mode)].zoom;
}

function clampCrop(photo, mode = state.cropMode) {
  const { width, height } = cropDimensions(mode);
  const crop = photo[cropProperty(mode)];
  const scale = cropScale(photo, mode);
  const drawnW = photo.image.naturalWidth * scale;
  const drawnH = photo.image.naturalHeight * scale;
  crop.x = Math.min(0, Math.max(width - drawnW, crop.x));
  crop.y = Math.min(0, Math.max(height - drawnH, crop.y));
}

function renderCrop() {
  const photo = activePhoto();
  const mode = state.cropMode;
  const { width, height } = cropDimensions(mode);
  if (cropCanvas.width !== width || cropCanvas.height !== height) {
    cropCanvas.width = width;
    cropCanvas.height = height;
  }
  cropCtx.fillStyle = "#243a46";
  cropCtx.fillRect(0, 0, width, height);
  if (!photo) return;
  ensureCropState(photo, false, mode);
  const crop = photo[cropProperty(mode)];
  const scale = cropScale(photo, mode);
  cropCtx.drawImage(photo.image, crop.x, crop.y, photo.image.naturalWidth * scale, photo.image.naturalHeight * scale);

  if (mode === "large" || layoutMode() === "exact") return;

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
          largeCrop: null,
          copies: 4
        };
        state.photos.push(photo);
        state.activeId = photo.id;
        ensureCropState(photo, true, "id");
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
    copyInput.disabled = $("autoFill").checked || layoutMode() !== "identity";
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
      refreshAll();
    });
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        state.activeId = photo.id;
        refreshAll();
      }
    });
    list.append(item);
  });
  $("photoCount").textContent = state.photos.length;
  $("emptyPhotos").hidden = state.photos.length > 0;
}

function readSizes() {
  if (layoutMode() === "exact") {
    state.photoSize = { w: positiveValue("exactWidth", 200), h: positiveValue("exactHeight", 300) };
    return;
  }
  if (layoutMode() === "mixed-a4") {
    state.photoSize = { w: 35, h: 45 };
    state.paperSize = { w: 210, h: 297 };
    return;
  }
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

function positiveValue(id, fallback) {
  const value = numberValue(id, fallback);
  return value > 0 ? value : fallback;
}

function calculateLayout() {
  readSizes();
  if (layoutMode() === "mixed-a4") return window.PhotoLayout.buildMixedA4Layout(state.photos);
  if (layoutMode() === "exact") {
    const layout = window.PhotoLayout.buildExactLayout(activePhoto() || state.photos[0] || null, {
      width: state.photoSize.w,
      height: state.photoSize.h,
      series: $("paperSeries").value,
      margin: Math.max(0, numberValue("margin", 8))
    });
    state.paperSize = { w: layout.paperW, h: layout.paperH };
    return layout;
  }
  const margin = Math.max(0, numberValue("margin", 8));
  const gap = Math.max(0, numberValue("gap", 3));
  const { w: paperW, h: paperH } = state.paperSize;
  const { w: photoW, h: photoH } = state.photoSize;
  const cols = Math.max(0, Math.floor((paperW - 2 * margin + gap) / (photoW + gap)));
  const rows = Math.max(0, Math.floor((paperH - 2 * margin + gap) / (photoH + gap)));
  const capacity = cols * rows;
  const gridW = cols ? cols * photoW + (cols - 1) * gap : 0;
  const gridH = rows ? rows * photoH + (rows - 1) * gap : 0;
  return { mixed: false, margin, gap, paperW, paperH, photoW, photoH, cols, rows, capacity, startX: (paperW - gridW) / 2, startY: (paperH - gridH) / 2 };
}

function slotPhotos(layout) {
  return window.PhotoLayout.arrangePhotos(state.photos, layout.capacity, {
    autoFill: $("autoFill").checked,
    groupBySource: $("groupBySource").checked
  });
}

function drawCropped(ctx, photo, x, y, width, height, mode = "id") {
  ensureCropState(photo, false, mode);
  const crop = photo[cropProperty(mode)];
  const dims = cropDimensions(mode);
  const scale = cropScale(photo, mode);
  // La zone source suit le ratio exact du format, sans l’arrondi du canevas de cadrage.
  const sourceW = Math.min(photo.image.naturalWidth, dims.width / scale);
  const sourceH = Math.min(photo.image.naturalHeight, sourceW * cropRatio(mode));
  const sourceX = Math.max(0, Math.min(photo.image.naturalWidth - sourceW, -crop.x / scale));
  const sourceY = Math.max(0, Math.min(photo.image.naturalHeight - sourceH, -crop.y / scale));
  ctx.drawImage(photo.image, sourceX, sourceY, sourceW, sourceH, x, y, width, height);
}

function drawLargeCropped(ctx, photo, x, y, width, height) {
  drawCropped(ctx, photo, x, y, width, height, "large");
}

function layoutPlacements(layout) {
  if (layout.placements) return layout.placements;
  return slotPhotos(layout).map((photo, index) => ({
    photo,
    kind: "id",
    x: layout.startX + (index % layout.cols) * (layout.photoW + layout.gap),
    y: layout.startY + Math.floor(index / layout.cols) * (layout.photoH + layout.gap),
    w: layout.photoW,
    h: layout.photoH
  }));
}

function drawPlacement(ctx, placement, scale = 1) {
  const draw = placement.kind === "large" ? drawLargeCropped : drawCropped;
  draw(ctx, placement.photo, placement.x * scale, placement.y * scale, placement.w * scale, placement.h * scale);
}

function renderSheet() {
  const layout = calculateLayout();
  state.layout = layout;
  const previewScale = Math.min(3, 900 / Math.max(layout.paperW, layout.paperH));
  sheetCanvas.width = Math.max(1, Math.round(layout.paperW * previewScale));
  sheetCanvas.height = Math.max(1, Math.round(layout.paperH * previewScale));
  sheetCtx.fillStyle = "#fff";
  sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  const placements = layoutPlacements(layout);
  placements.forEach(placement => {
    drawPlacement(sheetCtx, placement, previewScale);
    if ($("cutMarks").checked) drawPreviewMarks(sheetCtx, placement.x * previewScale, placement.y * previewScale, placement.w * previewScale, placement.h * previewScale, previewScale);
  });
  $("sheetEmpty").hidden = placements.length > 0;
  $("capacityBadge").textContent = layout.mixed ? "2 grands + 15 ID"
    : layout.exact ? (layout.paper ? layout.paper.name : "Trop grand")
    : `${layout.capacity} emplacement${layout.capacity > 1 ? "s" : ""}`;
  $("downloadPdf").disabled = placements.length === 0;
  if (layout.exact) renderExactHint(layout);
  if (layout.exact && !layout.paper) setStatus("Ces dimensions, avec la marge choisie, dépassent le plus grand format de la série.");
  else if (state.photos.length && !layout.capacity) setStatus("Ce format de photo ne tient pas sur le papier avec les marges choisies.");
  else setStatus("");
}

function formatMm(value) {
  return `${Number(value.toFixed(1)).toLocaleString("fr-FR")}`;
}

function renderExactHint(layout) {
  const size = `${formatMm(layout.photoW)} × ${formatMm(layout.photoH)} mm`;
  if (!layout.paper) {
    $("exactHint").textContent = `Image de ${size} : aucun format ${$("paperSeries").value} ne peut la contenir avec ${formatMm(layout.margin)} mm de marge.`;
    return;
  }
  const orientation = layout.paper.landscape ? "paysage" : "portrait";
  const sideX = (layout.paperW - layout.photoW) / 2;
  const sideY = (layout.paperH - layout.photoH) / 2;
  $("exactHint").textContent = `Papier : ${layout.paper.name} · ${formatMm(layout.paperW)} × ${formatMm(layout.paperH)} mm (${orientation}). `
    + `Image centrée, imprimée à ${size} exactement, avec ${formatMm(sideX)} mm de blanc à gauche et à droite et ${formatMm(sideY)} mm en haut et en bas. `
    + "Découpez le long des traits de coupe pour obtenir les dimensions exactes. La photo sélectionnée est imprimée.";
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
  const mixed = layoutMode() === "mixed-a4";
  const exact = layoutMode() === "exact";
  const photo = activePhoto();
  const largeCropAvailable = mixed && photo && state.photos.indexOf(photo) < 2;
  if (!mixed || (!largeCropAvailable && state.cropMode === "large")) state.cropMode = "id";
  $("photoFormat").disabled = mixed;
  $("paperFormat").disabled = mixed;
  $("photoFormatField").hidden = exact;
  $("paperFormatField").hidden = exact;
  $("autoFill").disabled = mixed || exact;
  $("groupBySource").disabled = mixed || exact || !$("autoFill").checked;
  $("margin").disabled = mixed;
  $("gap").disabled = mixed || exact;
  $("mixedLayoutHint").hidden = !mixed;
  $("exactSettings").hidden = !exact;
  $("exactHint").hidden = !exact;
  $("cropModeControls").hidden = !mixed;
  $("cropModeLarge").disabled = !largeCropAvailable;
  $("cropModeLarge").title = largeCropAvailable ? "" : "Disponible pour les deux premières photos";
  $("cropModeId").classList.toggle("active", state.cropMode === "id");
  $("cropModeLarge").classList.toggle("active", state.cropMode === "large");
  $("cropModeId").setAttribute("aria-pressed", String(state.cropMode === "id"));
  $("cropModeLarge").setAttribute("aria-pressed", String(state.cropMode === "large"));
  $("guideLegend").hidden = state.cropMode === "large" || exact;
  const cropSize = cropDimensions();
  $("cropStage").style.aspectRatio = `${cropSize.width} / ${cropSize.height}`;
  $("cropStage").style.width = `min(100%, 390px, ${Math.round(585 * cropSize.width / cropSize.height)}px)`;
  cropCanvas.setAttribute("aria-label", state.cropMode === "large" ? "Zone de cadrage du tirage 10 par 15" : "Zone de cadrage de la photo d’identité");
  if (exact) {
    $("customPhotoSize").hidden = true;
    $("customPaperSize").hidden = true;
  } else {
    $("customPhotoSize").hidden = $("photoFormat").value !== "custom";
    $("customPaperSize").hidden = $("paperFormat").value !== "custom";
  }
  if (mixed) {
    $("photoFormat").value = "35x45";
    $("paperFormat").value = "210x297";
    $("customPhotoSize").hidden = true;
    $("customPaperSize").hidden = true;
  }
  renderPhotoList();
  $("cropPlaceholder").hidden = Boolean(photo);
  $("zoomRange").disabled = !photo;
  $("resetCrop").disabled = !photo;
  if (photo) {
    ensureCropState(photo);
    const crop = photo[cropProperty()];
    $("zoomRange").value = crop.zoom;
    $("zoomValue").textContent = `${Math.round(crop.zoom * 100)} %`;
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
  const crop = photo[cropProperty()];
  const oldScale = cropScale(photo);
  const imageCenterX = (dims.width / 2 - crop.x) / oldScale;
  const imageCenterY = (dims.height / 2 - crop.y) / oldScale;
  crop.zoom = Number(value);
  const newScale = cropScale(photo);
  crop.x = dims.width / 2 - imageCenterX * newScale;
  crop.y = dims.height / 2 - imageCenterY * newScale;
  clampCrop(photo);
  $("zoomValue").textContent = `${Math.round(crop.zoom * 100)} %`;
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
  const crop = photo[cropProperty()];
  crop.x += point.x - state.pointer.x;
  crop.y += point.y - state.pointer.y;
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

function placementKey(placement) {
  return `${placement.photo.id}:${placement.kind}:${placement.w}x${placement.h}`;
}

function cropToJpeg(placement) {
  // 300 dpi visés, au moins 240 px sur le petit côté, au plus 16 Mpx pour rester
  // sous la limite des canevas mobiles. Le ratio est conservé : l’image est
  // ensuite placée dans le PDF à ses dimensions exactes en millimètres.
  let pixelsPerMm = Math.max(300 / 25.4, 240 / Math.min(placement.w, placement.h));
  pixelsPerMm = Math.min(pixelsPerMm, Math.sqrt(16e6 / (placement.w * placement.h)));
  const targetW = Math.max(1, Math.round(placement.w * pixelsPerMm));
  const targetH = Math.max(1, Math.round(placement.h * pixelsPerMm));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const draw = placement.kind === "large" ? drawLargeCropped : drawCropped;
  draw(ctx, placement.photo, 0, 0, targetW, targetH);
  const data = canvas.toDataURL("image/jpeg", .94).split(",")[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, width: targetW, height: targetH };
}

function buildPdf(layout, placements) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let length = 0;
  const pushBytes = bytes => { parts.push(bytes); length += bytes.length; };
  const pushText = value => pushBytes(enc.encode(value));
  pushBytes(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x37,0x0a,0x25,0xe2,0xe3,0xcf,0xd3,0x0a]));

  const unique = [...new Map(placements.map(placement => [placementKey(placement), placement])).values()];
  const imageData = unique.map(cropToJpeg);
  const imageObjectStart = 5;
  const objectCount = 4 + unique.length;
  const beginObject = number => { offsets[number] = length; pushText(`${number} 0 obj\n`); };
  const endObject = () => pushText("endobj\n");

  // Préréglages d’impression lus par les lecteurs PDF compatibles (Acrobat…) :
  // taille réelle sans mise à l’échelle, papier choisi d’après la taille de la page,
  // recto seul, un exemplaire.
  const printPresets = "/ViewerPreferences << /PrintScaling /None /PickTrayByPDFSize true /Duplex /Simplex /NumCopies 1 >>";
  beginObject(1); pushText(`<< /Type /Catalog /Pages 2 0 R ${printPresets} >>\n`); endObject();
  beginObject(2); pushText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n"); endObject();
  const pt = mm => mm * 72 / 25.4;
  const box = (x, y, w, h) => `[${pt(x).toFixed(4)} ${pt(layout.paperH - y - h).toFixed(4)} ${pt(x + w).toFixed(4)} ${pt(layout.paperH - y).toFixed(4)}]`;
  // La page est orientée comme le papier ; en impression exacte, la TrimBox
  // décrit le format fini après découpe des bords blancs.
  const trim = layout.exact && placements.length === 1
    ? ` /TrimBox ${box(placements[0].x, placements[0].y, placements[0].w, placements[0].h)}`
    : "";
  const resources = unique.map((_, i) => `/Im${i + 1} ${imageObjectStart + i} 0 R`).join(" ");
  beginObject(3); pushText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(layout.paperW).toFixed(4)} ${pt(layout.paperH).toFixed(4)}]${trim} /Rotate 0 /Resources << /XObject << ${resources} >> >> /Contents 4 0 R >>\n`); endObject();

  const commands = [];
  placements.forEach(placement => {
    const x = pt(placement.x);
    const y = pt(layout.paperH - placement.y - placement.h);
    const w = pt(placement.w);
    const h = pt(placement.h);
    const imageIndex = unique.findIndex(candidate => placementKey(candidate) === placementKey(placement)) + 1;
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
  const placements = layoutPlacements(layout);
  if (!placements.length) return;
  setStatus("Préparation du PDF…", false);
  requestAnimationFrame(() => {
    try {
      const pdf = buildPdf(layout, placements);
      const blob = new Blob([pdf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = layout.mixed ? "planche-photo-mixte-a4.pdf"
        : layout.exact ? `impression-exacte-${layout.photoW}x${layout.photoH}mm-${layout.paper.name.replace(/\s+/g, "-")}.pdf`
        : `planche-photo-id-${layout.photoW}x${layout.photoH}mm-${layout.paperW}x${layout.paperH}mm.pdf`;
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

document.querySelectorAll("[data-crop-mode]").forEach(button => button.addEventListener("click", () => {
  const photo = activePhoto();
  if (!photo || button.disabled) return;
  state.cropMode = button.dataset.cropMode;
  ensureCropState(photo);
  refreshAll();
}));

$("layoutMode").addEventListener("change", () => {
  state.cropMode = "id";
  readSizes();
  state.photos.forEach(photo => ensureCropState(photo, true, "id"));
  refreshAll();
});

$("photoFormat").addEventListener("change", () => {
  $("customPhotoSize").hidden = $("photoFormat").value !== "custom";
  readSizes();
  state.photos.forEach(photo => ensureCropState(photo, true, "id"));
  refreshAll();
});
$("paperFormat").addEventListener("change", () => { $("customPaperSize").hidden = $("paperFormat").value !== "custom"; refreshAll(); });
$("paperSeries").addEventListener("change", refreshAll);
["photoWidth","photoHeight","exactWidth","exactHeight"].forEach(id => $(id).addEventListener("input", () => { readSizes(); state.photos.forEach(photo => ensureCropState(photo, true, "id")); refreshAll(); }));
["paperWidth","paperHeight","autoFill","groupBySource","cutMarks","margin","gap"].forEach(id => $(id).addEventListener("input", refreshAll));

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=10", { updateViaCache: "none" })
      .then(registration => registration.update())
      .catch(() => {});
  });
}

refreshAll();
