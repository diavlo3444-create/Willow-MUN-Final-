import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  ApplicationTrack,
  UploadedApplicationFile,
} from '../utils/applicationForm';

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

interface ApplicationFileUploaderProps {
  id: string;
  track: ApplicationTrack;
  fieldKind: 'proof_files' | 'media_photos' | 'writing_samples';
  draftSessionId: string;
  files: UploadedApplicationFile[];
  onFilesChange: (
    updater: (prev: UploadedApplicationFile[]) => UploadedApplicationFile[],
  ) => void;
  title: string;
  description: string;
  accept: string;
  acceptedFormatsLabel: string;
  category: UploadedApplicationFile['category'];
  isImageGallery?: boolean;
  minFiles?: number;
  maxFiles: number;
  required?: boolean;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(
    getFileExtension(file.name),
  );
}

async function createCompactImageDataUrl(file: File): Promise<string | undefined> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return undefined;
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const maxDim = 420;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.58);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(undefined);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(undefined);
    };
    img.src = objectUrl;
  });
}

function uploadBlobWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(98, Math.max(10, Math.round((event.loaded / event.total) * 100)));
        onProgress(pct);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Storage upload returned status ${xhr.status}.`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading file.'));
    xhr.send(file);
  });
}

export function ApplicationFileUploader({
  id,
  track,
  fieldKind,
  draftSessionId,
  files,
  onFilesChange,
  title,
  description,
  accept,
  acceptedFormatsLabel,
  category,
  isImageGallery = false,
  minFiles,
  maxFiles,
  required = false,
  error,
}: ApplicationFileUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const multiInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const remainingSlots = Math.max(0, maxFiles - files.length);

  const validateSelectedFile = (file: File): string | null => {
    if (file.size <= 0) return `"${file.name}" appears to be empty.`;
    if (file.size > MAX_FILE_BYTES) {
      return `"${file.name}" exceeds the 100 MB per-file limit.`;
    }
    const ext = getFileExtension(file.name);
    if (isImageGallery) {
      const allowedImgExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
      if (!file.type.startsWith('image/') && !allowedImgExts.includes(ext)) {
        return `"${file.name}" is not a supported image format (${acceptedFormatsLabel}).`;
      }
    } else {
      const allowedDocExts = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
      if (!allowedDocExts.includes(ext)) {
        return `"${file.name}" is not an accepted format (${acceptedFormatsLabel}).`;
      }
    }
    return null;
  };

  const uploadSingleFile = async (
    file: File,
    entryId: string,
    localPreviewUrl?: string,
  ) => {
    const updateEntry = (patch: Partial<UploadedApplicationFile>) => {
      onFilesChange((prev) =>
        prev.map((item) => (item.id === entryId ? { ...item, ...patch } : item)),
      );
    };

    try {
      const { data, error: initErr } = await supabase.functions.invoke('willow-applications', {
        body: {
          action: 'init_upload',
          application_type: track,
          field_kind: fieldKind,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          draft_session_id: draftSessionId,
        },
      });

      if (data?.error) {
        const errMsg = String(data.error);
        // Hard business rejection (e.g. registration closed, format invalid): do not fallback
        if (
          errMsg.toLowerCase().includes('closed') ||
          errMsg.toLowerCase().includes('only accepts') ||
          errMsg.toLowerCase().includes('under 15 mb')
        ) {
          updateEntry({
            uploadStatus: 'error',
            progress: 0,
            errorMessage: errMsg,
          });
          return;
        }
      }

      if (!initErr && data?.signedUrl && data?.path) {
        updateEntry({ progress: 25 });
        await uploadBlobWithProgress(data.signedUrl, file, (pct) => {
          updateEntry({ progress: pct });
        });
        updateEntry({
          storageBucket: data.bucket || 'wm-application-files',
          storagePath: data.path,
          uploadStatus: 'uploaded',
          progress: 100,
          errorMessage: undefined,
        });
        return;
      }

      // Graceful pre-migration fallback when remote Edge Function lacks init_upload yet
      const inlinePreview = isImageFile(file)
        ? (await createCompactImageDataUrl(file)) || localPreviewUrl
        : localPreviewUrl;
      updateEntry({
        previewUrl: inlinePreview,
        uploadStatus: 'fallback_inline',
        progress: 100,
        errorMessage: undefined,
      });
    } catch {
      const inlinePreview = isImageFile(file)
        ? (await createCompactImageDataUrl(file)) || localPreviewUrl
        : localPreviewUrl;
      updateEntry({
        previewUrl: inlinePreview,
        uploadStatus: 'fallback_inline',
        progress: 100,
        errorMessage: undefined,
      });
    }
  };

  const handleAddFiles = (rawList: FileList | null) => {
    if (!rawList || rawList.length === 0) return;
    setLocalError('');

    const incoming = Array.from(rawList);
    if (files.length >= maxFiles) {
      setLocalError(`Maximum limit of ${maxFiles} file${maxFiles === 1 ? '' : 's'} already reached.`);
      return;
    }

    const acceptedToQueue: File[] = [];
    const rejectedMessages: string[] = [];

    for (const file of incoming) {
      if (files.length + acceptedToQueue.length >= maxFiles) {
        rejectedMessages.push(
          `Only ${maxFiles} file${maxFiles === 1 ? '' : 's'} allowed total — extra files were skipped.`,
        );
        break;
      }
      const err = validateSelectedFile(file);
      if (err) {
        rejectedMessages.push(err);
      } else {
        acceptedToQueue.push(file);
      }
    }

    if (rejectedMessages.length > 0) {
      setLocalError(rejectedMessages[0]);
    }

    if (acceptedToQueue.length === 0) return;

    const prepared = acceptedToQueue.map((file) => {
      const entryId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl =
        isImageFile(file) && typeof URL !== 'undefined'
          ? URL.createObjectURL(file)
          : undefined;
      const entry: UploadedApplicationFile = {
        id: entryId,
        name: file.name,
        category,
        fileType: file.type || getFileExtension(file.name) || 'application/octet-stream',
        sizeBytes: file.size,
        sizeLabel: formatFileSize(file.size),
        previewUrl,
        uploadedAt: new Date().toISOString(),
        uploadStatus: 'uploading',
        progress: 10,
      };
      return { file, entry };
    });

    onFilesChange((prev) => [...prev, ...prepared.map((p) => p.entry)]);
    for (const item of prepared) {
      void uploadSingleFile(item.file, item.entry.id, item.entry.previewUrl);
    }
  };

  const handleReplaceFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = replaceTargetId;
    e.target.value = '';
    setReplaceTargetId(null);

    if (!file || !targetId) return;
    setLocalError('');

    const validationErr = validateSelectedFile(file);
    if (validationErr) {
      setLocalError(validationErr);
      return;
    }

    const previewUrl =
      isImageFile(file) && typeof URL !== 'undefined'
        ? URL.createObjectURL(file)
        : undefined;

    onFilesChange((prev) =>
      prev.map((item) => {
        if (item.id !== targetId) return item;
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(item.previewUrl);
          } catch {
            // Ignore cleanup failure
          }
        }
        return {
          ...item,
          name: file.name,
          fileType: file.type || getFileExtension(file.name) || 'application/octet-stream',
          sizeBytes: file.size,
          sizeLabel: formatFileSize(file.size),
          storageBucket: undefined,
          storagePath: undefined,
          previewUrl,
          uploadedAt: new Date().toISOString(),
          uploadStatus: 'uploading',
          progress: 12,
          errorMessage: undefined,
        };
      }),
    );

    void uploadSingleFile(file, targetId, previewUrl);
  };

  const handleRemove = (targetId: string) => {
    setLocalError('');
    onFilesChange((prev) => {
      const target = prev.find((f) => f.id === targetId);
      if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {
          // Ignore cleanup failure
        }
      }
      return prev.filter((f) => f.id !== targetId);
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleAddFiles(e.dataTransfer.files);
  };

  const countStatusMet = minFiles ? files.length >= minFiles && files.length <= maxFiles : files.length <= maxFiles;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-[#c9c2a6]">
          {title}{' '}
          {required ? (
            '*'
          ) : (
            <span className="font-normal text-[#c9c2a6]/70">(optional)</span>
          )}
        </label>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            minFiles
              ? countStatusMet
                ? 'text-[#a9b47e]'
                : 'text-amber-300'
              : 'text-[#c9c2a6]/80'
          }`}
        >
          {minFiles
            ? `${files.length} / ${minFiles}–${maxFiles} required`
            : `${files.length} / ${maxFiles} max`}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-[#c9c2a6]/85">{description}</p>

      {/* Hidden inputs for multi-select & per-file replace */}
      <input
        id={id}
        ref={multiInputRef}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          handleAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label="Replace selected file"
        onChange={handleReplaceFile}
      />

      {/* Dropzone & Mobile Tap Upload Trigger */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-[3px] border border-dashed px-4 py-5 text-center transition-colors duration-150 ${
          dragging
            ? 'border-[#a9b47e] bg-[#a9b47e]/10'
            : error || localError
              ? 'border-rose-400/55 bg-[#0e1208]'
              : 'border-[#ede6ca]/26 bg-[#0e1208]/90 hover:border-[#ede6ca]/45'
        }`}
      >
        <div className="mx-auto flex max-w-md flex-col items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#ede6ca]/20 bg-[#171c0d] text-[#a9b47e]">
            {isImageGallery ? (
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Upload className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#ede6ca]">
              {remainingSlots === 0
                ? `Maximum ${maxFiles} files uploaded — remove or replace a file below`
                : isImageGallery
                  ? 'Select 10–15 photographs from your device or drag & drop here'
                  : 'Choose files from your device or drag & drop here'}
            </p>
            <p className="font-mono text-[10px] tracking-[0.06em] text-[#c9c2a6]/75">
              Accepted: {acceptedFormatsLabel} · Max 100 MB per file
            </p>
          </div>

          <button
            type="button"
            disabled={remainingSlots === 0}
            onClick={() => multiInputRef.current?.click()}
            className="mun-btn-interactive mt-1 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[2px] border border-[#ede6ca]/34 bg-[#171c0d] px-4 py-2 text-xs font-semibold text-[#ede6ca] hover:bg-[#ede6ca] hover:text-[#181c0d] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {files.length === 0
                ? isImageGallery
                  ? 'Select Photographs'
                  : 'Select File(s)'
                : isImageGallery
                  ? `Add More Photos (${remainingSlots} left)`
                  : `Add Another File (${remainingSlots} left)`}
            </span>
          </button>
        </div>
      </div>

      {/* Image Portfolio Gallery Grid (Media 10–15 photos) */}
      {isImageGallery && files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {files.map((item, idx) => (
            <div
              key={item.id}
              className="group relative flex flex-col overflow-hidden rounded-[2px] border border-[#ede6ca]/20 bg-[#14190b]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0a0d05]">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#c9c2a6]/60">
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}

                <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-[#ede6ca] tabular-nums">
                  #{idx + 1}
                </span>

                {item.uploadStatus === 'uploading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/70 px-3">
                    <Loader2 className="h-4 w-4 animate-spin text-[#a9b47e]" aria-hidden="true" />
                    <div className="h-1 w-full bg-[#ede6ca]/20 overflow-hidden rounded-full">
                      <div
                        className="h-full bg-[#a9b47e] transition-all duration-150"
                        style={{ width: `${item.progress ?? 20}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 p-2">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-[11px] font-medium text-[#ede6ca]" title={item.name}>
                    {item.name}
                  </p>
                  {(item.uploadStatus === 'uploaded' || item.uploadStatus === 'fallback_inline') && (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-[#a9b47e]"
                      aria-label="Uploaded"
                    />
                  )}
                  {item.uploadStatus === 'error' && (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" aria-label="Error" />
                  )}
                </div>
                <p className="font-mono text-[10px] text-[#c9c2a6]/75 tabular-nums">
                  {item.errorMessage ? (
                    <span className="text-rose-300">{item.errorMessage}</span>
                  ) : (
                    item.sizeLabel
                  )}
                </p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReplaceTargetId(item.id);
                      replaceInputRef.current?.click();
                    }}
                    className="inline-flex min-h-[30px] flex-1 items-center justify-center gap-1 rounded-[2px] border border-[#ede6ca]/22 px-2 text-[10px] font-medium text-[#c9c2a6] hover:border-[#ede6ca] hover:text-[#ede6ca] cursor-pointer"
                  >
                    <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    aria-label={`Remove ${item.name}`}
                    className="inline-flex min-h-[30px] items-center justify-center rounded-[2px] border border-rose-400/30 px-2 text-rose-300 hover:bg-rose-950/50 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Standard Document List (Proof of Experience / Press Writing Samples) */}
      {!isImageGallery && files.length > 0 && (
        <ul className="divide-y divide-[#ede6ca]/12 rounded-[2px] border border-[#ede6ca]/18 bg-[#14190b] overflow-hidden">
          {files.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="h-9 w-9 shrink-0 rounded-[2px] border border-[#ede6ca]/20 object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-[#ede6ca]/18 bg-[#0e1208] text-[#a9b47e]">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#ede6ca]">{item.name}</p>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-[#c9c2a6]/75">
                    <span className="tabular-nums">{item.sizeLabel}</span>
                    {item.uploadStatus === 'uploading' && (
                      <span className="text-[#a9b47e]">Uploading {item.progress ?? 15}%…</span>
                    )}
                    {(item.uploadStatus === 'uploaded' || item.uploadStatus === 'fallback_inline') && (
                      <span className="text-[#a9b47e]">Ready</span>
                    )}
                    {item.uploadStatus === 'error' && (
                      <span className="text-rose-300">{item.errorMessage || 'Upload failed'}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setReplaceTargetId(item.id);
                    replaceInputRef.current?.click();
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-[2px] border border-[#ede6ca]/24 px-2.5 text-[11px] font-medium text-[#c9c2a6] hover:border-[#ede6ca] hover:text-[#ede6ca] cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="inline-flex min-h-[34px] items-center justify-center rounded-[2px] border border-rose-400/30 px-2.5 text-rose-300 hover:bg-rose-950/50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(localError || error) && (
        <p role="alert" className="text-xs text-rose-300">
          {localError || error}
        </p>
      )}
    </div>
  );
}
