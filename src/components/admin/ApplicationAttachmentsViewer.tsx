import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lock,
  ShieldAlert,
  X,
} from 'lucide-react';
import { fetchSignedDocumentUrls } from '../../services/liveBackendService';
import type { AdminUser, Application, Department, UploadedDocument } from '../../types/admin';
import { canViewConfidentialMedicalInfo } from '../../utils/adminPermissions';

interface ApplicationAttachmentsViewerProps {
  application: Application;
  actor: AdminUser | null | undefined;
  departments?: Department[];
}

function isImageDoc(doc: UploadedDocument): boolean {
  if (doc.category === 'photo') return true;
  if (doc.fileType.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(doc.name);
}

export function ApplicationAttachmentsViewer({
  application,
  actor,
  departments,
}: ApplicationAttachmentsViewerProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null);

  const hasStoragePaths = useMemo(
    () => application.documents.some((d) => Boolean(d.storagePath)),
    [application.documents],
  );

  useEffect(() => {
    let cancelled = false;
    if (!hasStoragePaths) {
      setSignedUrls({});
      return;
    }
    setLoadingUrls(true);
    void fetchSignedDocumentUrls(application.id).then((urls) => {
      if (!cancelled) {
        setSignedUrls(urls);
        setLoadingUrls(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [application.id, hasStoragePaths]);

  const resolveUrl = (doc: UploadedDocument): string => {
    if (doc.storagePath && signedUrls[doc.storagePath]) {
      return signedUrls[doc.storagePath];
    }
    return doc.previewUrl || '';
  };

  const photoDocs = useMemo(
    () => application.documents.filter((d) => d.category === 'photo'),
    [application.documents],
  );
  const otherDocs = useMemo(
    () => application.documents.filter((d) => d.category !== 'photo'),
    [application.documents],
  );

  const allowMedicalView =
    canViewConfidentialMedicalInfo(actor, departments) &&
    application.medicalInfo?.restricted !== true;

  useEffect(() => {
    if (lightboxIndex === null && !previewDoc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
        setPreviewDoc(null);
      } else if (lightboxIndex !== null && photoDocs.length > 0) {
        if (e.key === 'ArrowRight') {
          setLightboxIndex((i) => (i === null ? 0 : (i + 1) % photoDocs.length));
        } else if (e.key === 'ArrowLeft') {
          setLightboxIndex((i) =>
            i === null ? 0 : (i - 1 + photoDocs.length) % photoDocs.length,
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, previewDoc, photoDocs.length]);

  const activeLightboxDoc =
    lightboxIndex !== null && photoDocs[lightboxIndex] ? photoDocs[lightboxIndex] : null;
  const activeLightboxUrl = activeLightboxDoc ? resolveUrl(activeLightboxDoc) : '';

  return (
    <div className="space-y-4">
      {/* Media Camera + Photography Portfolio Gallery */}
      {(application.cameraModel || photoDocs.length > 0) && (
        <div className="wm-surface-inset p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-accent)]">
                Photography Portfolio ({photoDocs.length})
              </p>
              {application.cameraModel && (
                <p className="mt-0.5 text-xs text-[color:var(--wm-ink)]">
                  <strong>Camera Equipment:</strong> {application.cameraModel}
                </p>
              )}
            </div>
            {loadingUrls && (
              <span className="text-[11px] text-[color:var(--wm-ink-muted)]">
                Loading secure previews…
              </span>
            )}
          </div>

          {photoDocs.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {photoDocs.map((doc, idx) => {
                const url = resolveUrl(doc);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="group relative aspect-square overflow-hidden rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] text-left cursor-pointer hover:border-[color:var(--wm-accent)]"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={doc.name}
                        className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-1 text-center text-[color:var(--wm-ink-muted)]">
                        <ImageIcon className="h-4 w-4 mb-1" aria-hidden="true" />
                        <span className="text-[9px] truncate w-full">{doc.name}</span>
                      </div>
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/75 px-1 py-0.5 font-mono text-[9px] text-[color:var(--wm-ink)]">
                      #{idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Proof of Experience & Press Writing Samples */}
      {otherDocs.length > 0 && (
        <div className="wm-surface-inset p-4 space-y-2.5">
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-accent)]">
            Uploaded Supporting Files & Writing Samples ({otherDocs.length})
          </p>
          <div className="divide-y divide-[color:var(--wm-hairline)] rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] overflow-hidden">
            {otherDocs.map((doc) => {
              const url = resolveUrl(doc);
              const isImg = isImageDoc(doc);
              return (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-[color:var(--wm-accent)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[color:var(--wm-ink)]">{doc.name}</p>
                      <p className="font-mono text-[10px] text-[color:var(--wm-ink-muted)]">
                        {doc.category === 'portfolio' ? 'Writing / Portfolio Sample' : 'Proof of Experience'}
                        {doc.sizeLabel ? ` · ${doc.sizeLabel}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {url ? (
                      <>
                        {isImg && (
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="rounded border border-[color:var(--wm-hairline-strong)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)] cursor-pointer"
                          >
                            Preview
                          </button>
                        )}
                        <a
                          href={url}
                          download={doc.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--wm-accent)] hover:bg-[color:var(--wm-inset)]"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          <span>Open / Download</span>
                        </a>
                      </>
                    ) : (
                      <span className="text-[11px] text-[color:var(--wm-ink-muted)]">
                        Metadata stored
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confidential Medical Disclosure (Strictly gated to authorized Senior Admins) */}
      <div className="wm-surface-inset p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-accent)]">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Confidential Medical Disclosure</span>
          </p>
          <Lock className="h-3.5 w-3.5 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
        </div>

        {allowMedicalView ? (
          <div className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">
            {application.medicalInfo?.hasConditions === true ? (
              <div className="space-y-1">
                <p className="font-semibold text-amber-200">
                  Applicant disclosed a medical condition or regular medication:
                </p>
                <p className="whitespace-pre-wrap text-[color:var(--wm-ink)]">
                  {application.medicalInfo.details || 'No additional explanation provided.'}
                </p>
              </div>
            ) : application.medicalInfo?.hasConditions === false ? (
              <p>No medical conditions or regular medication reported.</p>
            ) : (
              <p className="text-[color:var(--wm-ink-muted)]">No medical record recorded.</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-[color:var(--wm-ink-muted)]">
            Private medical information is restricted strictly to authorized senior administrators.
          </p>
        )}
      </div>

      {/* Lightbox for Photography Portfolio */}
      {activeLightboxDoc && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photography preview"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative flex w-full max-w-3xl flex-col rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--wm-ink)]">
                  {activeLightboxDoc.name}
                </p>
                <p className="font-mono text-xs text-[color:var(--wm-ink-muted)]">
                  Photo {(lightboxIndex ?? 0) + 1} of {photoDocs.length}
                  {activeLightboxDoc.sizeLabel ? ` · ${activeLightboxDoc.sizeLabel}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeLightboxUrl && (
                  <a
                    href={activeLightboxUrl}
                    download={activeLightboxDoc.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Save</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close photo preview"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="relative mt-4 flex min-h-[280px] items-center justify-center overflow-hidden rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)]">
              {activeLightboxUrl ? (
                <img
                  src={activeLightboxUrl}
                  alt={activeLightboxDoc.name}
                  className="max-h-[70dvh] w-auto object-contain"
                />
              ) : (
                <p className="p-8 text-xs text-[color:var(--wm-ink-muted)]">
                  Preview image unavailable for this attachment.
                </p>
              )}

              {photoDocs.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((i) =>
                        i === null ? 0 : (i - 1 + photoDocs.length) % photoDocs.length,
                      )
                    }
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((i) =>
                        i === null ? 0 : (i + 1) % photoDocs.length,
                      )
                    }
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Non-gallery Image Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Attachment preview"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-2xl rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--wm-ink)]">
                  {previewDoc.name}
                </p>
                <p className="font-mono text-xs text-[color:var(--wm-ink-muted)]">
                  {previewDoc.fileType}
                  {previewDoc.sizeLabel ? ` · ${previewDoc.sizeLabel}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label="Close document preview"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)]">
              <img
                src={resolveUrl(previewDoc)}
                alt={previewDoc.name}
                className="max-h-[70dvh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
