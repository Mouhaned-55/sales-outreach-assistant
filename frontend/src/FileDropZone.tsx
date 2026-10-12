import { useRef, useState } from "react";
import { Icon } from "./components";
import { singleUploadFile } from "./uploadView";

export function FileDropZone({
  disabled,
  filename,
  onFile,
  onError,
}: {
  disabled: boolean;
  filename?: string;
  onFile: (file: File) => void;
  onError: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  function select(files: ArrayLike<File>) {
    if (disabled) return;
    try {
      const file = singleUploadFile(files);
      if (file) onFile(file);
    } catch (error) {
      onError((error as Error).message);
    }
  }
  return (
    <div
      className={`file-drop-zone ${dragging && !disabled ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled && event.dataTransfer.types.includes("Files")) {
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        select(event.dataTransfer.files);
      }}
    >
      <span className="drop-zone-icon">
        <Icon name="upload" size={32} />
      </span>
      <strong>
        {dragging && !disabled
          ? "Drop your CSV here"
          : "Drag & drop your CSV here"}
      </strong>
      <span>or choose a file from your device</span>
      <span className="button drop-zone-button" aria-hidden="true">
        {filename ? "Choose another file" : "Choose CSV file"}
      </span>
      <span className="drop-zone-help">
        One .csv or .tsv file · UTF-8 · Preview before saving
      </span>
      {filename && (
        <span className="drop-zone-filename">Selected: {filename}</span>
      )}
      <input
        id="catalog-file"
        className="drop-zone-input"
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        disabled={disabled}
        aria-label={
          filename
            ? `Choose another CSV file; selected ${filename}`
            : "Choose CSV file or drop it here"
        }
        onChange={(event) => {
          select(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
