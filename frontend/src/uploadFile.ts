export type UploadSource = { filename: string; content_base64: string };

export async function encodeUploadFile(
  file: File,
  maxBytes: number,
): Promise<UploadSource> {
  if (!/\.(csv|tsv)$/i.test(file.name)) {
    throw new Error(
      "Choose a .csv or .tsv file. Export other formats as UTF-8 CSV first; Excel and PDF are not supported.",
    );
  }
  if (file.size === 0)
    throw new Error("This file is empty. Choose a CSV containing data.");
  if (file.size > maxBytes)
    throw new Error(
      `This file exceeds the configured limit of ${maxBytes} bytes.`,
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Send original bytes, including the BOM. The backend validates encoding.
  // Small chunks avoid JavaScript's argument limit for larger source files.
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return { filename: file.name, content_base64: btoa(binary) };
}
