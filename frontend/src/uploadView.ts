export function singleUploadFile(files: ArrayLike<File>): File | undefined {
  if (files.length > 1) throw new Error("Choose or drop one file at a time.");
  return files[0];
}

export function previewPage(
  total: number,
  requestedPage: number,
  expanded: boolean,
) {
  const pageSize = expanded ? 25 : 10;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(0, Math.min(requestedPage, pages - 1));
  const start = page * pageSize;
  return { page, pages, start, end: Math.min(total, start + pageSize) };
}
