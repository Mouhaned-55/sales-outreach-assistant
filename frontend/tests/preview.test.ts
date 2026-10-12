import assert from "node:assert/strict";
import test from "node:test";
import { previewPage, singleUploadFile } from "../src/uploadView.ts";

test("compact pagination preserves row positions and handles the final page", () => {
  assert.deepEqual(previewPage(23, 0, false), {
    page: 0,
    pages: 3,
    start: 0,
    end: 10,
  });
  assert.deepEqual(previewPage(23, 2, false), {
    page: 2,
    pages: 3,
    start: 20,
    end: 23,
  });
});
test("expanded preview remains bounded and clamps stale pages", () => {
  assert.deepEqual(previewPage(51, 99, true), {
    page: 2,
    pages: 3,
    start: 50,
    end: 51,
  });
  assert.deepEqual(previewPage(0, 2, false), {
    page: 0,
    pages: 1,
    start: 0,
    end: 0,
  });
});
test("picker and drop accept exactly one file without silently ignoring extras", () => {
  const file = new File(["A,B"], "catalog.csv");
  assert.equal(singleUploadFile([file]), file);
  assert.equal(singleUploadFile([]), undefined);
  assert.throws(() => singleUploadFile([file, file]), /one file/);
});
