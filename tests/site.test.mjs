import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../dist/styles.css", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"));
const serviceWorker = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
const rootPage = await readFile(new URL("../index.html", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../dist/layout.js", import.meta.url), "utf8");

test("l’application ne charge aucune ressource distante", () => {
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
  assert.doesNotMatch(app, /fetch\(["']https?:\/\//i);
});

test("les contrôles du parcours principal sont présents", () => {
  for (const id of ["photoInput", "cropCanvas", "zoomRange", "layoutMode", "photoFormat", "paperFormat", "sheetCanvas", "downloadPdf"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("le cadrage autorise un zoom maximal de 500 %", () => {
  assert.match(html, /id="zoomRange"[^>]*max="5"/);
  assert.match(app, /Math\.min\(5, photo\[property\]\.zoom\)/);
});

test("le cadre visuel suit les proportions du format sélectionné", () => {
  assert.match(app, /cropStage.*style\.aspectRatio/);
  assert.match(app, /cropDimensions\(mode = state\.cropMode\)/);
  assert.match(app, /mode === "large".*height: 1050/);
});

test("les panneaux masqués ne peuvent pas recouvrir le cadrage", () => {
  assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.match(app, /cropPlaceholder.*hidden\s*=\s*Boolean\(photo\)/);
});

test("le format français et le papier A4 sont proposés", () => {
  assert.match(html, /value="35x45"/);
  assert.match(html, /value="210x297"/);
});

test("le PDF conserve des dimensions physiques exactes", () => {
  assert.match(app, /mm => mm \* 72 \/ 25\.4/);
  assert.match(app, /\/MediaBox/);
  assert.match(app, /application\/pdf/);
});

test("la web app est installable en mode autonome", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
});

test("une correction remplace immédiatement l’ancien cache", () => {
  assert.match(serviceWorker, /skipWaiting\(\)/);
  assert.match(serviceWorker, /clients\.claim\(\)/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.doesNotMatch(serviceWorker, /caches\.match\(event\.request\)/);
  assert.match(html, /app\.js\?v=10/);
  assert.match(app, /updateViaCache:\s*"none"/);
});

test("GitHub Pages ouvre l’application depuis la racine", () => {
  assert.match(rootPage, /location\.replace\("dist\/"/);
  assert.match(rootPage, /url=dist\//);
});

test("le remplissage groupé conserve chaque photo dans un bloc contigu", () => {
  const sandbox = {};
  vm.runInNewContext(layoutSource, sandbox);
  const photos = [{ id: "image-1" }, { id: "image-2" }];
  const result = sandbox.PhotoLayout.arrangePhotos(photos, 25, { autoFill: true, groupBySource: true });
  assert.deepEqual(Array.from(result, photo => photo.id), [
    ...Array(13).fill("image-1"),
    ...Array(12).fill("image-2")
  ]);
});

test("le remplissage alterné reste disponible", () => {
  const sandbox = {};
  vm.runInNewContext(layoutSource, sandbox);
  const photos = [{ id: "image-1" }, { id: "image-2" }];
  const result = sandbox.PhotoLayout.arrangePhotos(photos, 5, { autoFill: true, groupBySource: false });
  assert.deepEqual(Array.from(result, photo => photo.id), ["image-1", "image-2", "image-1", "image-2", "image-1"]);
});

test("la disposition mixte A4 place deux 10 × 15 et maximise à quinze photos ID", () => {
  const sandbox = {};
  vm.runInNewContext(layoutSource, sandbox);
  const photos = [{ id: "image-1" }, { id: "image-2" }, { id: "image-3" }];
  const layout = sandbox.PhotoLayout.buildMixedA4Layout(photos);
  const large = Array.from(layout.placements).filter(placement => placement.kind === "large");
  const ids = Array.from(layout.placements).filter(placement => placement.kind === "id");
  assert.deepEqual(large.map(placement => placement.photo.id), ["image-1", "image-2"]);
  assert.ok(large.every(placement => placement.w === 100 && placement.h === 150));
  assert.equal(ids.length, 15);
  assert.deepEqual(ids.map(placement => placement.photo.id), [
    ...Array(5).fill("image-1"),
    ...Array(5).fill("image-2"),
    ...Array(5).fill("image-3")
  ]);
});

test("la disposition mixte répartit les restes entre toutes les sources", () => {
  const sandbox = {};
  vm.runInNewContext(layoutSource, sandbox);
  const photos = [1, 2, 3, 4].map(id => ({ id: `image-${id}` }));
  const layout = sandbox.PhotoLayout.buildMixedA4Layout(photos);
  const ids = Array.from(layout.placements).filter(placement => placement.kind === "id");
  assert.deepEqual(ids.map(placement => placement.photo.id), [
    ...Array(4).fill("image-1"),
    ...Array(4).fill("image-2"),
    ...Array(4).fill("image-3"),
    ...Array(3).fill("image-4")
  ]);
  assert.ok(layout.placements.every(placement => placement.x >= 0 && placement.y >= 0));
  assert.ok(layout.placements.every(placement => placement.x + placement.w <= 210 && placement.y + placement.h <= 297));
});

test("les tirages 10 × 15 disposent d’un cadrage indépendant", () => {
  assert.match(html, /id="cropModeId"[^>]*data-crop-mode="id"/);
  assert.match(html, /id="cropModeLarge"[^>]*data-crop-mode="large"/);
  assert.match(app, /largeCrop:\s*null/);
  assert.match(app, /drawCropped\(ctx, photo, x, y, width, height, "large"\)/);
  assert.match(app, /mode === "large" \? "largeCrop" : "crop"/);
});

test("l’impression exacte choisit le format A immédiatement supérieur", () => {
  const sandbox = {};
  vm.runInNewContext(layoutSource, sandbox);
  const { choosePaper } = sandbox.PhotoLayout;
  assert.equal(choosePaper(200, 280, "A", 5).name, "A4");
  assert.equal(choosePaper(200, 290, "A", 5).name, "A3");
  assert.equal(choosePaper(210, 297, "A", 0).name, "A4");
  assert.equal(choosePaper(90, 130, "A", 5).name, "A6");
  assert.equal(choosePaper(900, 1300, "A", 5), null);
});

test("l’impression exacte gère la série ARCH et l’orientation paysage", () => {
  const sandbox = {};
  vm.runInNewContext(layoutSource, sandbox);
  const { choosePaper } = sandbox.PhotoLayout;
  assert.equal(choosePaper(200, 280, "ARCH", 5).name, "ARCH A");
  assert.equal(choosePaper(600, 900, "ARCH", 5).name, "ARCH E1");
  const landscape = choosePaper(400, 250, "ARCH", 8);
  assert.equal(landscape.name, "ARCH B");
  assert.ok(landscape.landscape);
  assert.ok(Math.abs(landscape.w - 457.2) < 1e-9 && Math.abs(landscape.h - 304.8) < 1e-9);
});

test("l’image exacte est centrée à ses dimensions précises", () => {
  const sandbox = {};
  vm.runInNewContext(layoutSource, sandbox);
  const layout = sandbox.PhotoLayout.buildExactLayout({ id: "image-1" }, { width: 123.4, height: 290, series: "A", margin: 8 });
  assert.equal(layout.paper.name, "A3");
  assert.equal(layout.placements.length, 1);
  const [placement] = layout.placements;
  assert.equal(placement.w, 123.4);
  assert.equal(placement.h, 290);
  assert.ok(Math.abs(placement.x * 2 + placement.w - 297) < 1e-9);
  assert.ok(Math.abs(placement.y * 2 + placement.h - 420) < 1e-9);
});

test("le mode d’impression exacte est proposé", () => {
  assert.match(html, /<option value="exact">/);
  for (const id of ["exactWidth", "exactHeight", "paperSeries"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /<option value="ARCH">/);
});

test("le PDF embarque les préréglages d’impression", () => {
  assert.match(app, /\/PrintScaling \/None/);
  assert.match(app, /\/PickTrayByPDFSize true/);
  assert.match(app, /\/TrimBox/);
  assert.match(app, /0x2e,0x37,0x0a/);
});
