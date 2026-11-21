import { useCallback, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Plus, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";

export type FileStatus = "pending" | "uploading" | "uploaded" | "failed";

export interface UploadItem {
  key: string;
  file: File;
  status: FileStatus;
  error?: string;
}

const ACCEPTED = [".pdf", ".docx", ".txt", ".md"];

export function validateFileClient(file: File, maxMb: number): string | null {
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!ACCEPTED.includes(extension)) {
    return `Unsupported type ${extension || "unknown"}. Use PDF, DOCX or TXT.`;
  }
  if (file.size === 0) return "The file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `Larger than the ${maxMb} MB limit.`;
  return null;
}

interface FileDropzoneProps {
  items: UploadItem[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  maxMb: number;
  maxFiles: number;
  disabled?: boolean;
}

export function FileDropzone({ items, onAdd, onRemove, maxMb, maxFiles, disabled }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      onAdd(Array.from(fileList));
    },
    [onAdd],
  );

  const uploadedCount = items.filter((item) => item.status === "uploaded").length;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-primary bg-primary-subtle/60" : "border-border bg-surface",
          disabled && "opacity-60",
        )}
      >
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-primary-subtle text-accent-foreground">
          <UploadCloud className="size-5" aria-hidden />
        </div>
        <p className="text-sm font-medium">Drop resumes here, or choose files</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, DOCX or TXT · up to {maxMb} MB each · up to {maxFiles} resumes per screening
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            type="button"
          >
            <Plus /> Add files
          </Button>
          <span className="text-2xs text-muted-foreground">
            {items.length} selected{uploadedCount ? ` · ${uploadedCount} uploaded` : ""}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{item.file.name}</p>
                <p className="text-2xs text-muted-foreground">
                  {formatBytes(item.file.size)}
                  {item.error ? <span className="ml-2 text-destructive">{item.error}</span> : null}
                </p>
              </div>
              <StatusIcon status={item.status} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(item.key)}
                disabled={disabled || item.status === "uploading"}
                aria-label={`Remove ${item.file.name}`}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { status: FileStatus }) {
  if (status === "uploading") return <Loader2 className="size-4 animate-spin text-primary" aria-label="Uploading" />;
  if (status === "uploaded") return <CheckCircle2 className="size-4 text-success" aria-label="Uploaded" />;
  if (status === "failed") return <AlertCircle className="size-4 text-destructive" aria-label="Failed" />;
  return <span className="text-2xs text-muted-foreground">Ready</span>;
}
