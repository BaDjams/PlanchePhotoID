"use strict";

(function exposePhotoLayout(root) {
  function distributeGrouped(photos, capacity) {
    const available = Math.max(0, Math.floor(Number(capacity) || 0));
    if (!photos.length || !available) return [];
    const perPhoto = Math.floor(available / photos.length);
    const remainder = available % photos.length;
    const result = [];
    photos.forEach((photo, index) => {
      const copies = perPhoto + (index < remainder ? 1 : 0);
      for (let copy = 0; copy < copies; copy += 1) result.push(photo);
    });
    return result;
  }

  function arrangePhotos(photos, capacity, options = {}) {
    const available = Math.max(0, Math.floor(Number(capacity) || 0));
    if (!photos.length || !available) return [];

    if (!options.autoFill) {
      const result = [];
      photos.forEach(photo => {
        const copies = Math.max(0, Math.floor(Number(photo.copies) || 0));
        for (let index = 0; index < copies && result.length < available; index += 1) result.push(photo);
      });
      return result;
    }

    if (!options.groupBySource) {
      return Array.from({ length: available }, (_, index) => photos[index % photos.length]);
    }

    return distributeGrouped(photos, available);
  }

  function buildMixedA4Layout(photos) {
    const paperW = 210;
    const paperH = 297;
    const largeGap = 3;
    const gap = 2;
    const largeW = 100;
    const largeH = 150;
    const photoW = 35;
    const photoH = 45;
    const cols = 5;
    const rows = 3;
    const idCapacity = cols * rows;
    const totalH = largeH + largeGap + rows * photoH + (rows - 1) * gap;
    const startY = (paperH - totalH) / 2;
    const largeStartX = (paperW - (largeW * 2 + largeGap)) / 2;
    const idGridW = cols * photoW + (cols - 1) * gap;
    const idStartX = (paperW - idGridW) / 2;
    const idStartY = startY + largeH + largeGap;
    const placements = [];

    if (photos.length) {
      const largePhotos = [photos[0], photos[1] || photos[0]];
      largePhotos.forEach((photo, index) => placements.push({
        photo,
        kind: "large",
        x: largeStartX + index * (largeW + largeGap),
        y: startY,
        w: largeW,
        h: largeH
      }));

      distributeGrouped(photos, idCapacity).forEach((photo, index) => placements.push({
        photo,
        kind: "id",
        x: idStartX + (index % cols) * (photoW + gap),
        y: idStartY + Math.floor(index / cols) * (photoH + gap),
        w: photoW,
        h: photoH
      }));
    }

    return {
      mixed: true,
      paperW,
      paperH,
      photoW,
      photoH,
      gap,
      cols,
      rows,
      capacity: placements.length,
      idCapacity,
      placements
    };
  }

  const inch = 25.4;
  const PAPER_SERIES = {
    A: [
      { name: "A6", w: 105, h: 148 },
      { name: "A5", w: 148, h: 210 },
      { name: "A4", w: 210, h: 297 },
      { name: "A3", w: 297, h: 420 },
      { name: "A2", w: 420, h: 594 },
      { name: "A1", w: 594, h: 841 },
      { name: "A0", w: 841, h: 1189 }
    ],
    ARCH: [
      { name: "ARCH A", w: 9 * inch, h: 12 * inch },
      { name: "ARCH B", w: 12 * inch, h: 18 * inch },
      { name: "ARCH C", w: 18 * inch, h: 24 * inch },
      { name: "ARCH D", w: 24 * inch, h: 36 * inch },
      { name: "ARCH E1", w: 30 * inch, h: 42 * inch },
      { name: "ARCH E", w: 36 * inch, h: 48 * inch }
    ]
  };

  // Plus petit format de la série pouvant contenir l’image et sa marge blanche,
  // orienté comme l’image.
  function choosePaper(imageW, imageH, series = "A", margin = 0) {
    const sheets = PAPER_SERIES[series] || PAPER_SERIES.A;
    const border = 2 * Math.max(0, Number(margin) || 0);
    const long = Math.max(imageW, imageH) + border;
    const short = Math.min(imageW, imageH) + border;
    const sheet = sheets.find(candidate => long <= candidate.h + 1e-9 && short <= candidate.w + 1e-9);
    if (!sheet) return null;
    const landscape = imageW > imageH;
    return {
      name: sheet.name,
      w: landscape ? sheet.h : sheet.w,
      h: landscape ? sheet.w : sheet.h,
      landscape
    };
  }

  function buildExactLayout(photo, options = {}) {
    const width = Number(options.width);
    const height = Number(options.height);
    const margin = Math.max(0, Number(options.margin) || 0);
    const valid = width > 0 && height > 0;
    const paper = valid ? choosePaper(width, height, options.series, margin) : null;
    const sheets = PAPER_SERIES[options.series] || PAPER_SERIES.A;
    const fallback = sheets[sheets.length - 1];
    const paperW = paper ? paper.w : fallback.w;
    const paperH = paper ? paper.h : fallback.h;
    const placements = paper && photo ? [{
      photo,
      kind: "id",
      x: (paperW - width) / 2,
      y: (paperH - height) / 2,
      w: width,
      h: height
    }] : [];
    return {
      exact: true,
      paper,
      paperW,
      paperH,
      photoW: width,
      photoH: height,
      margin,
      capacity: paper ? 1 : 0,
      placements
    };
  }

  function formatMm(value) {
    return String(Math.round(Number(value) * 10) / 10).replace(".", ",");
  }

  function paperLabel(paperW, paperH) {
    const short = Math.min(paperW, paperH);
    const long = Math.max(paperW, paperH);
    const same = (a, b) => Math.abs(a - b) < 0.05;
    const known = [...PAPER_SERIES.A, ...PAPER_SERIES.ARCH, { name: "10x15cm", w: 100, h: 150 }]
      .find(sheet => same(sheet.w, short) && same(sheet.h, long));
    return known ? known.name.replace(/\s+/g, "-") : `papier-${formatMm(paperW)}x${formatMm(paperH)}mm`;
  }

  // Nom de fichier portant les consignes d’impression : papier, orientation,
  // échelle, recto, puis contenu.
  function printFileName(layout) {
    const paper = layout.paper ? layout.paper.name.replace(/\s+/g, "-") : paperLabel(layout.paperW, layout.paperH);
    const orientation = layout.paperW > layout.paperH ? "paysage" : "portrait";
    const instructions = `imprimer-sur-${paper}-${orientation}-taille-reelle-100-recto`;
    const size = `${formatMm(layout.photoW)}x${formatMm(layout.photoH)}mm`;
    if (layout.exact) return `${instructions}_decouper-aux-traits-${size}.pdf`;
    if (layout.mixed) return `${instructions}_planche-mixte-10x15-et-ID-${size}.pdf`;
    return `${instructions}_planche-ID-${size}.pdf`;
  }

  root.PhotoLayout = { arrangePhotos, buildMixedA4Layout, choosePaper, buildExactLayout, printFileName, PAPER_SERIES };
})(typeof self !== "undefined" ? self : this);
