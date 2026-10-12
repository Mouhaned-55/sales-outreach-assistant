import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as React from "react";

const require = createRequire(import.meta.url);
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Exercise the real component handlers without adding a DOM dependency.
// This adapter models state/effect dependencies; it does not test browser
// events, React scheduling, native picker behavior, focus, or layout.
function createWorkspace() {
  let active;
  let busy = false;
  let previewError = "";
  const calls = [];
  const cache = new Map();
  const hooks = {
    ...React,
    useState(initial) {
      const frame = active;
      const index = frame.cursor++;
      if (!(index in frame.slots)) {
        frame.slots[index] = typeof initial === "function" ? initial() : initial;
      }
      return [frame.slots[index], (value) => {
        frame.slots[index] = typeof value === "function"
          ? value(frame.slots[index]) : value;
      }];
    },
    useRef(initial) {
      const frame = active;
      const index = frame.cursor++;
      if (!(index in frame.slots)) frame.slots[index] = { current: initial };
      return frame.slots[index];
    },
    useEffect(effect, dependencies) {
      const frame = active;
      const index = frame.cursor++;
      const previous = frame.slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        frame.effects.push(() => {
          previous?.cleanup?.();
          frame.slots[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const previewFor = (payload) => ({
    headers: payload.has_headers ? ["A", "B"] : null,
    rows: [["1", "2"]], row_count: 1, column_count: 2,
    delimiter: payload.delimiter === "auto" ? "," : payload.delimiter,
    requested_delimiter: payload.delimiter, has_headers: payload.has_headers,
    truncated: false, warnings: [],
  });
  async function request(route, method = "GET", payload) {
    calls.push({ route, method, payload });
    if (route === "/uploads/settings") return { max_file_bytes: 1024, preview_row_limit: 50 };
    if (route === "/uploads" && method === "GET") return [];
    if (route === "/uploads/preview") {
      if (previewError) {
        const message = previewError;
        previewError = "";
        throw new Error(message);
      }
      return previewFor(payload);
    }
    if (route === "/uploads" && method === "POST") {
      return {
        ...previewFor(payload), id: "saved-upload", filename: payload.filename,
        uploaded_at: "2026-10-12T12:00:00Z", status: "Awaiting review",
        size_bytes: Buffer.from(payload.content_base64, "base64").length,
        preview: previewFor(payload),
      };
    }
    throw new Error(`Unexpected API call: ${method} ${route}`);
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    cache.set(file, module.exports);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const resolve = (name) => {
      if (name === "react") return hooks;
      if (name === "./api") return { request };
      if (!name.startsWith(".")) return require(name);
      const base = path.resolve(path.dirname(file), name);
      return load([".ts", ".tsx"].map((extension) => base + extension).find(fs.existsSync));
    };
    new Function("require", "module", "exports", code)(resolve, module, module.exports);
    return module.exports;
  }
  function instance(component, getProps) {
    const frame = { slots: [], cursor: 0, effects: [] };
    return () => {
      const props = getProps();
      active = frame;
      frame.cursor = 0;
      const tree = component(props);
      for (const effect of frame.effects.splice(0)) effect();
      active = undefined;
      return tree;
    };
  }
  const { CatalogUploads } = load(path.join(sourceRoot, "CatalogUploads.tsx"));
  const { FileDropZone } = load(path.join(sourceRoot, "FileDropZone.tsx"));
  const { OfferingsPage } = load(path.join(sourceRoot, "pages.tsx"));
  const setBusy = (value) => { busy = value; };
  const render = instance(CatalogUploads, () => ({ busy, setBusy }));
  const renderDrop = instance(FileDropZone, () => find(render(), (node) => node.type === FileDropZone).props);
  return {
    render, renderDrop, calls, CatalogUploads,
    renderPage: instance(OfferingsPage, () => ({ offerings: [], onSaved: async () => {}, busy, setBusy })),
    failNextPreview(message) { previewError = message; },
    get busy() { return busy; },
    previews: () => calls.filter((call) => call.route === "/uploads/preview"),
    saves: () => calls.filter((call) => call.route === "/uploads" && call.method === "POST"),
  };
}

function find(node, predicate) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return;
  }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}
const button = (tree, label) => find(tree, (node) => node.type === "button" && node.props.children === label);
const picker = (tree) => find(tree, (node) => node.type === "input" && node.props.type === "file");
const separator = (tree) => find(tree, (node) => node.type === "select");
const headers = (tree) => find(tree, (node) => node.type === "input" && node.props.type === "checkbox");
const notice = (tree) => find(tree, (node) => node.type?.name === "Notice");
async function ready(workspace) {
  workspace.render();
  await tick();
  assert.equal(picker(workspace.renderDrop()).props.disabled, false);
}
function choose(workspace, file) {
  const target = { files: [file], value: "selected-file" };
  picker(workspace.renderDrop()).props.onChange({ currentTarget: target });
  assert.equal(target.value, "");
}
const catalog = () => new File(["\ufeffA,B\r\n1,2\r\n"], "catalog.csv");

test("upload area is present immediately without a reveal or preview button", async () => {
  const workspace = createWorkspace();
  const page = workspace.renderPage();
  assert.ok(find(page, (node) => node.type === workspace.CatalogUploads));
  assert.equal(button(page, "Upload for review"), undefined);
  assert.ok(picker(workspace.renderDrop()));
  assert.equal(picker(workspace.renderDrop()).props.disabled, true);
  await ready(workspace);
  assert.equal(button(workspace.render(), "Preview CSV"), undefined);
  assert.equal(workspace.previews().length, 0);
});

for (const mode of ["picker", "drop"]) {
  test(`${mode} automatically previews original bytes without saving`, async () => {
    const workspace = createWorkspace();
    await ready(workspace);
    const file = catalog();
    if (mode === "picker") choose(workspace, file);
    else {
      let prevented = false;
      workspace.renderDrop().props.onDrop({
        preventDefault() { prevented = true; }, dataTransfer: { files: [file] },
      });
      assert.equal(prevented, true);
    }
    assert.equal(workspace.busy, true);
    assert.equal(picker(workspace.renderDrop()).props.disabled, true);
    await tick();
    assert.equal(workspace.busy, false);
    assert.equal(workspace.previews().length, 1);
    const call = workspace.previews()[0];
    assert.equal(call.method, "POST");
    assert.equal(call.payload.delimiter, "auto");
    assert.equal(call.payload.has_headers, true);
    assert.deepEqual(Buffer.from(call.payload.content_base64, "base64"), Buffer.from(await file.arrayBuffer()));
    assert.ok(button(workspace.render(), "Save upload for review"));
    assert.equal(workspace.saves().length, 0);
    workspace.render();
    workspace.render();
    await tick();
    assert.equal(workspace.previews().length, 1, "renders must not trigger preview loops");
  });
}

test("separator and header changes automatically preview with their new values", async () => {
  const workspace = createWorkspace();
  await ready(workspace);
  choose(workspace, catalog());
  await tick();
  separator(workspace.render()).props.onChange({ target: { value: ";" } });
  assert.equal(workspace.busy, true);
  await tick();
  assert.equal(workspace.previews().at(-1).payload.delimiter, ";");
  headers(workspace.render()).props.onChange({ target: { checked: false } });
  await tick();
  const last = workspace.previews().at(-1).payload;
  assert.equal(last.delimiter, ";");
  assert.equal(last.has_headers, false);
  assert.equal(last.content_base64, workspace.previews()[0].payload.content_base64);
  assert.equal(workspace.previews().length, 3);
  assert.equal(workspace.saves().length, 0);
});

test("failed preview keeps the file for retry or an automatic settings override", async () => {
  const workspace = createWorkspace();
  await ready(workspace);
  workspace.failNextPreview("Choose the correct separator.");
  choose(workspace, catalog());
  await tick();
  assert.equal(notice(workspace.render()).props.error, "Choose the correct separator.");
  assert.match(picker(workspace.renderDrop()).props["aria-label"], /catalog.csv/);
  assert.equal(button(workspace.render(), "Save upload for review"), undefined);
  button(workspace.render(), "Retry preview").props.onClick();
  await tick();
  assert.ok(button(workspace.render(), "Save upload for review"));
  workspace.failNextPreview("Try another separator.");
  separator(workspace.render()).props.onChange({ target: { value: ";" } });
  await tick();
  assert.ok(button(workspace.render(), "Retry preview"));
  separator(workspace.render()).props.onChange({ target: { value: "\t" } });
  await tick();
  assert.equal(workspace.previews().at(-1).payload.delimiter, "\t");
  assert.ok(button(workspace.render(), "Save upload for review"));
  button(workspace.render(), "Clear file").props.onClick();
  assert.equal(button(workspace.render(), "Save upload for review"), undefined);
  assert.equal(button(workspace.render(), "Retry preview"), undefined);
  assert.equal(notice(workspace.render()).props.error, "");
  assert.equal(picker(workspace.renderDrop()).props["aria-label"], "Choose CSV file or drop it here");
  assert.equal(workspace.saves().length, 0);
});

test("only explicit save stages the previewed source and leaves upload area available", async () => {
  const workspace = createWorkspace();
  await ready(workspace);
  choose(workspace, catalog());
  await tick();
  assert.equal(workspace.saves().length, 0);
  button(workspace.render(), "Save upload for review").props.onClick();
  await tick();
  assert.equal(workspace.saves().length, 1);
  assert.deepEqual(workspace.saves()[0].payload, workspace.previews()[0].payload);
  assert.match(notice(workspace.render()).props.success, /Upload saved/);
  assert.equal(button(workspace.render(), "Save upload for review"), undefined);
  assert.ok(picker(workspace.renderDrop()));
  assert.ok(button(workspace.render(), "Open"));
});
