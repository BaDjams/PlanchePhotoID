"use strict";

(function exposePhotoLayout(root) {
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

    const perPhoto = Math.floor(available / photos.length);
    const remainder = available % photos.length;
    const result = [];
    photos.forEach((photo, index) => {
      const copies = perPhoto + (index < remainder ? 1 : 0);
      for (let copy = 0; copy < copies; copy += 1) result.push(photo);
    });
    return result;
  }

  root.PhotoLayout = { arrangePhotos };
})(typeof self !== "undefined" ? self : this);
