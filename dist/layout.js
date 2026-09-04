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

  root.PhotoLayout = { arrangePhotos, buildMixedA4Layout };
})(typeof self !== "undefined" ? self : this);
