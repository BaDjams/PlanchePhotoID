import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../dist/styles.css", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"));
const serviceWorker = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
const rootPage = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("l’application ne charge aucune ressource distante", () => {
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
  assert.doesNotMatch(app, /fetch\(["']https?:\/\//i);
});

test("les contrôles du parcours principal sont présents", () => {
  for (const id of ["photoInput", "cropCanvas", "zoomRange", "photoFormat", "paperFormat", "sheetCanvas", "downloadPdf"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("le cadrage autorise un zoom maximal de 500 %", () => {
  assert.match(html, /id="zoomRange"[^>]*max="5"/);
  assert.match(app, /Math\.min\(5, photo\.crop\.zoom\)/);
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
});

test("GitHub Pages ouvre l’application depuis la racine", () => {
  assert.match(rootPage, /location\.replace\("dist\/"/);
  assert.match(rootPage, /url=dist\//);
});
