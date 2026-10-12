import assert from "node:assert/strict";
import test from "node:test";
import { encodeUploadFile } from "../src/uploadFile.ts";

test("transports BOM, whitespace, quoted delimiters, and Unicode without changing bytes", async () => {
  const original = new TextEncoder().encode(
    '\ufeff Label ,Label,\r\n" café, thé ",001,\r\n',
  );
  const file = new File([original], "catalog.csv");
  const result = await encodeUploadFile(file, 1024);
  assert.equal(result.filename, "catalog.csv");
  assert.deepEqual(
    Buffer.from(result.content_base64, "base64"),
    Buffer.from(original),
  );
});

test("does not silently replace undecodable bytes before server validation", async () => {
  const original = new Uint8Array([0xff, 0xfe, 0x41, 0x00]);
  const result = await encodeUploadFile(
    new File([original], "catalog.csv"),
    1024,
  );
  assert.deepEqual(
    Buffer.from(result.content_base64, "base64"),
    Buffer.from(original),
  );
});

test("applies configured size limit rather than a hard-coded limit", async () => {
  await assert.rejects(
    encodeUploadFile(new File(["abcd"], "catalog.csv"), 3),
    /3 bytes/,
  );
  const result = await encodeUploadFile(new File(["abcd"], "catalog.csv"), 4);
  assert.equal(Buffer.from(result.content_base64, "base64").toString(), "abcd");
});

test("rejects empty files and formats that are not supported", async () => {
  await assert.rejects(
    encodeUploadFile(new File([], "empty.csv"), 1024),
    /empty/i,
  );
  await assert.rejects(
    encodeUploadFile(new File(["data"], "catalog.xlsx"), 1024),
    /CSV/,
  );
});

test("encodes files beyond JavaScript spread argument limits", async () => {
  const original = new Uint8Array(200_000).fill(65);
  const result = await encodeUploadFile(
    new File([original], "catalog.tsv"),
    250_000,
  );
  assert.deepEqual(
    Buffer.from(result.content_base64, "base64"),
    Buffer.from(original),
  );
});
