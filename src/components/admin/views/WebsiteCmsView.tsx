import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Monitor,
  Navigation,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { MediaAssetRecord, WebsiteSectionRecord } from '../../../types/admin';
import { ConfirmDialog } from '../ConfirmDialog';

type WebsiteSubView =
  | 'website-editor'
  | 'pages'
  | 'sections'
  | 'media'
  | 'navigation'
  | 'seo'
  | 'versions';

export function WebsiteCmsView({ mode }: { mode: WebsiteSubView }) {
  const {
    data,
    updateWebsiteDraft,
    publishWebsiteChanges,
    restoreWebsiteVersion,
    saveMediaAsset,
    deleteMediaAsset,
  } = useAdminStore();

  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [publishSummary, setPublishSummary] = useState('');
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const [mediaFolder, setMediaFolder] = useState<string>('all');
  const [editingMedia, setEditingMedia] = useState<MediaAssetRecord | null>(null);

  const draft = data.websiteDraft;
  const published = data.websitePublished;
  const hasUnpublishedChanges = JSON.stringify(draft) !== JSON.stringify(published);

  const handlePublish = (e: FormEvent) => {
    e.preventDefault();
    if (publishWebsiteChanges(publishSummary)) {
      setPublishSummary('');
    }
  };

  const handleUploadFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      saveMediaAsset({
        id: '',
        fileName: file.name,
        folder: 'Gallery',
        url: reader.result,
        mimeType: file.type || 'image/png',
        sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        usedIn: ['Media Library Upload'],
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.readAsDataURL(file);
  };

  const moveSection = (secId: string, delta: -1 | 1) => {
    updateWebsiteDraft(
      (d) => {
        const sorted = [...d.sections].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((s) => s.id === secId);
        const targetIdx = idx + delta;
        if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return d;
        [sorted[idx], sorted[targetIdx]] = [sorted[targetIdx], sorted[idx]];
        return {
          ...d,
          sections: sorted.map((s, i) => ({ ...s, order: i + 1 })),
        };
      },
      'Reordered website section in Draft',
    );
  };

  const sortedSections = [...draft.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Persistent Draft vs Live Publication Workbench Bar */}
      <div className="wm-surface-panel px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-[color:var(--wm-accent)] mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Willow MUN Website CMS
              </span>
              <span
                className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                  hasUnpublishedChanges
                    ? 'border-amber-400/40 bg-amber-500/[0.1] text-amber-200'
                    : 'border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-200'
                }`}
              >
                {hasUnpublishedChanges ? 'Draft Has Unpublished Edits' : 'Live & Synced'}
              </span>
            </div>
            <p className="text-xs text-[color:var(--wm-ink-secondary)] mt-0.5">
              Edits save strictly to Draft first. Public routes update only after explicit Publish
              confirmation.
            </p>
          </div>
        </div>

        <form onSubmit={handlePublish} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={publishSummary}
            onChange={(e) => setPublishSummary(e.target.value)}
            placeholder="Release note (optional)..."
            aria-label="Release summary note"
            className="h-9 w-64 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)]"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>Publish Changes</span>
          </button>
        </form>
      </div>

      {/* Mode 1: Visual Website Editor + Multi-Viewport Draft Preview */}
      {mode === 'website-editor' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <section className="xl:col-span-5 wm-surface-panel overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]">
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Quick Section & Hero Draft Editor
              </h2>
            </div>
            <div className="divide-y divide-[color:var(--wm-hairline)]">
              {sortedSections.slice(0, 4).map((sec) => (
                <div key={sec.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium text-[color:var(--wm-accent)] uppercase tracking-wider">
                      {sec.sectionKey} · {sec.label}
                    </span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-[color:var(--wm-ink-secondary)]">
                      <input
                        type="checkbox"
                        checked={sec.published}
                        onChange={(e) =>
                          updateWebsiteDraft(
                            (d) => ({
                              ...d,
                              sections: d.sections.map((x) =>
                                x.id === sec.id ? { ...x, published: e.target.checked } : x,
                              ),
                            }),
                            `Toggled visibility for ${sec.label}`,
                          )
                        }
                        className="accent-[#a9b47e]"
                      />
                      <span>Visible</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    aria-label={`${sec.label} Heading`}
                    value={sec.heading}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          sections: d.sections.map((x) =>
                            x.id === sec.id ? { ...x, heading: e.target.value } : x,
                          ),
                        }),
                        `Updated ${sec.label} heading in Draft`,
                      )
                    }
                    className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                  />
                  {sec.buttonLabel !== undefined && sec.sectionKey === 'hero' && (
                    <input
                      type="text"
                      aria-label="Hero CTA Button Label"
                      value={sec.buttonLabel}
                      onChange={(e) =>
                        updateWebsiteDraft(
                          (d) => ({
                            ...d,
                            sections: d.sections.map((x) =>
                              x.id === sec.id ? { ...x, buttonLabel: e.target.value } : x,
                            ),
                          }),
                          'Updated Hero CTA button copy in Draft',
                        )
                      }
                      className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Draft Preview Canvas with Responsive Viewport Frame */}
          <section className="xl:col-span-7 wm-surface-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                  Draft Viewport Preview (Unpublished Sandbox)
                </h2>
                <p className="text-xs text-[color:var(--wm-ink-secondary)]">
                  Reflects current Website Draft edits cleanly before publishing live.
                </p>
              </div>
              <div className="inline-flex rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewport('desktop')}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 cursor-pointer ${
                    viewport === 'desktop'
                      ? 'bg-[color:var(--wm-focal)] text-[#12170c] font-medium'
                      : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('tablet')}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 cursor-pointer ${
                    viewport === 'tablet'
                      ? 'bg-[color:var(--wm-focal)] text-[#12170c] font-medium'
                      : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                  }`}
                >
                  <Tablet className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tablet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('mobile')}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 cursor-pointer ${
                    viewport === 'mobile'
                      ? 'bg-[color:var(--wm-focal)] text-[#12170c] font-medium'
                      : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mobile</span>
                </button>
              </div>
            </div>

            <div className="flex justify-center overflow-x-auto bg-[color:var(--wm-canvas)] p-5">
              <div
                style={{
                  width:
                    viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '640px' : '100%',
                }}
                className="rounded-md border border-[color:var(--wm-hairline-strong)] bg-[#181c0d] text-[#ede6ca] overflow-hidden shadow-2xl transition-[width] duration-200"
              >
                {/* Mockup Preview Browser Top Bar */}
                <div className="flex items-center justify-between border-b border-[#ede6ca]/15 px-4 py-2.5 text-xs bg-[#13170b]">
                  <span className="font-serif text-base font-medium">Willow MUN</span>
                  <div className="hidden sm:flex gap-3 text-[11px] text-[#cfc8aa]">
                    {draft.navigation
                      .filter((n) => n.visible)
                      .map((n) => (
                        <span key={n.id}>{n.label}</span>
                      ))}
                  </div>
                  <span className="rounded bg-[#ede6ca] px-2.5 py-0.5 text-[10px] font-medium text-[#181c0d]">
                    Apply Now
                  </span>
                </div>

                {/* Mockup Preview Sections */}
                <div className="divide-y divide-[#ede6ca]/12">
                  {sortedSections
                    .filter((s) => s.published)
                    .map((sec) => (
                      <div key={sec.id} className="p-5 space-y-1.5">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[#a9b47e]">
                          {sec.subheading || sec.label}
                        </p>
                        <h3 className="font-serif text-xl text-[#ede6ca]">{sec.heading}</h3>
                        {sec.bodyText && (
                          <p className="text-xs text-[#cfc8aa] leading-relaxed">{sec.bodyText}</p>
                        )}
                        {sec.buttonLabel && (
                          <span className="inline-block mt-1.5 rounded bg-[#ede6ca] px-3 py-1 text-[11px] font-medium text-[#181c0d]">
                            {sec.buttonLabel}
                          </span>
                        )}
                      </div>
                    ))}
                </div>

                {/* Banner Preview */}
                {draft.bannerEnabled && (
                  <div className="border-t border-[#ede6ca]/15 bg-[#14180a] px-4 py-2 text-[11px] text-[#cfc8aa] flex items-center justify-between">
                    <span className="truncate">{draft.bannerText}</span>
                    <span className="font-medium text-[#ede6ca] shrink-0">
                      {draft.bannerLinkLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Mode 2: Pages Management */}
      {mode === 'pages' && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)] inline-flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <span>Website Pages ({draft.pages.length})</span>
            </h2>
            <button
              type="button"
              onClick={() =>
                updateWebsiteDraft(
                  (d) => ({
                    ...d,
                    pages: [
                      ...d.pages,
                      {
                        id: `page-${Date.now().toString(36)}`,
                        title: 'New Custom Page',
                        slug: `/page-${d.pages.length + 1}`,
                        description: 'Additional informational page.',
                        published: false,
                        visibleInNav: true,
                        order: d.pages.length + 1,
                        seoTitle: 'New Page · Willow MUN 2026',
                        seoDescription: 'Conference page description.',
                        seoImageUrl: '/willow-poster.jpg',
                        noIndex: false,
                        updatedAt: new Date().toISOString(),
                      },
                    ],
                  }),
                  'Created new draft page',
                )
              }
              className="inline-flex h-8 items-center gap-1 rounded bg-[color:var(--wm-focal)] px-3 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Page</span>
            </button>
          </div>

          <div className="divide-y divide-[color:var(--wm-hairline)] text-xs">
            {draft.pages.map((p) => (
              <div
                key={p.id}
                className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
              >
                <div className="md:col-span-4">
                  <label className="text-[11px] text-[color:var(--wm-ink-muted)]">Page Title</label>
                  <input
                    type="text"
                    value={p.title}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          pages: d.pages.map((x) =>
                            x.id === p.id ? { ...x, title: e.target.value } : x,
                          ),
                        }),
                        `Renamed page ${p.title}`,
                      )
                    }
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[11px] text-[color:var(--wm-ink-muted)]">Slug</label>
                  <input
                    type="text"
                    value={p.slug}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          pages: d.pages.map((x) =>
                            x.id === p.id ? { ...x, slug: e.target.value } : x,
                          ),
                        }),
                        `Updated slug for ${p.title}`,
                      )
                    }
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 font-mono text-[color:var(--wm-accent)]"
                  />
                </div>
                <div className="md:col-span-5 flex flex-wrap items-center justify-end gap-3 pt-2 md:pt-4">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[color:var(--wm-ink)]">
                    <input
                      type="checkbox"
                      checked={p.published}
                      onChange={(e) =>
                        updateWebsiteDraft(
                          (d) => ({
                            ...d,
                            pages: d.pages.map((x) =>
                              x.id === p.id ? { ...x, published: e.target.checked } : x,
                            ),
                          }),
                          `Toggled published state on ${p.title}`,
                        )
                      }
                      className="accent-[#a9b47e]"
                    />
                    <span>Published</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          pages: [
                            ...d.pages,
                            {
                              ...structuredClone(p),
                              id: `page-${Date.now().toString(36)}`,
                              title: `${p.title} (Copy)`,
                              slug: `${p.slug}-copy`,
                            },
                          ],
                        }),
                        `Duplicated ${p.title}`,
                      )
                    }
                    className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    <span>Duplicate</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mode 3: Full Sections Manager */}
      {mode === 'sections' && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)] inline-flex items-center gap-2">
              <Layers className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <span>Page Sections ({sortedSections.length})</span>
            </h2>
            <button
              type="button"
              onClick={() =>
                updateWebsiteDraft(
                  (d) => ({
                    ...d,
                    sections: [
                      ...d.sections,
                      {
                        id: `sec-${Date.now().toString(36)}`,
                        pageId: d.pages[0]?.id ?? 'page-home',
                        sectionKey: 'custom',
                        label: 'Custom Editorial Block',
                        heading: 'NEW SECTION.',
                        subheading: 'Editorial Highlight',
                        bodyText: 'Draft copy.',
                        buttonLabel: '',
                        buttonHref: '',
                        imageUrl: '',
                        backgroundStyle: 'Translucent Glass',
                        published: false,
                        order: d.sections.length + 1,
                      } satisfies WebsiteSectionRecord,
                    ],
                  }),
                  'Added custom draft section',
                )
              }
              className="inline-flex h-8 items-center gap-1 rounded bg-[color:var(--wm-focal)] px-3 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Custom Section</span>
            </button>
          </div>

          <div className="divide-y divide-[color:var(--wm-hairline)] text-xs">
            {sortedSections.map((sec, idx) => (
              <div key={sec.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-medium text-[color:var(--wm-accent)]">
                    #{idx + 1} · {sec.sectionKey.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveSection(sec.id, -1)}
                      aria-label={`Move ${sec.label} up`}
                      className="h-8 w-8 inline-flex items-center justify-center rounded border border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(sec.id, 1)}
                      aria-label={`Move ${sec.label} down`}
                      className="h-8 w-8 inline-flex items-center justify-center rounded border border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateWebsiteDraft(
                          (d) => ({ ...d, sections: d.sections.filter((x) => x.id !== sec.id) }),
                          `Removed section ${sec.label}`,
                        )
                      }
                      aria-label={`Delete ${sec.label}`}
                      className="h-8 w-8 inline-flex items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    aria-label={`${sec.label} Heading`}
                    value={sec.heading}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          sections: d.sections.map((x) =>
                            x.id === sec.id ? { ...x, heading: e.target.value } : x,
                          ),
                        }),
                        `Updated ${sec.label} heading`,
                      )
                    }
                    className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                  />
                  <input
                    type="text"
                    aria-label={`${sec.label} Subheading`}
                    value={sec.subheading}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          sections: d.sections.map((x) =>
                            x.id === sec.id ? { ...x, subheading: e.target.value } : x,
                          ),
                        }),
                        `Updated ${sec.label} subheading`,
                      )
                    }
                    className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <textarea
                  rows={2}
                  aria-label={`${sec.label} Body`}
                  value={sec.bodyText}
                  onChange={(e) =>
                    updateWebsiteDraft(
                      (d) => ({
                        ...d,
                        sections: d.sections.map((x) =>
                          x.id === sec.id ? { ...x, bodyText: e.target.value } : x,
                        ),
                      }),
                      `Edited body copy for ${sec.label}`,
                    )
                  }
                  className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-2.5 text-[color:var(--wm-ink-secondary)]"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mode 4: Media Library */}
      {mode === 'media' && (
        <section className="wm-surface-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-4">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Media Library ({data.mediaLibrary.length} assets)
              </span>
              <select
                aria-label="Filter media folder"
                value={mediaFolder}
                onChange={(e) => setMediaFolder(e.target.value)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)]"
              >
                <option value="all">All Folders</option>
                <option value="Portraits">Portraits</option>
                <option value="Branding">Branding</option>
                <option value="Banners">Banners</option>
                <option value="Gallery">Gallery</option>
              </select>
            </div>

            <label className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Asset</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleUploadFile}
                className="sr-only"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.mediaLibrary
              .filter((m) => mediaFolder === 'all' || m.folder === mediaFolder)
              .map((asset) => (
                <div
                  key={asset.id}
                  className="wm-surface-inset overflow-hidden text-xs"
                >
                  <img
                    src={asset.url}
                    alt={asset.fileName}
                    className="h-36 w-full object-cover bg-[color:var(--wm-canvas)]"
                  />
                  <div className="p-3 space-y-1.5">
                    <p className="font-semibold text-[color:var(--wm-ink)] truncate">
                      {asset.fileName}
                    </p>
                    <p className="font-mono text-[11px] text-[color:var(--wm-accent)]">
                      {asset.folder} · {asset.sizeLabel}
                    </p>
                    <div className="flex justify-between pt-2 border-t border-[color:var(--wm-hairline)]">
                      <button
                        type="button"
                        onClick={() => setEditingMedia(structuredClone(asset))}
                        className="text-[color:var(--wm-ink)] hover:underline cursor-pointer"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMediaAsset(asset.id)}
                        className="text-rose-200 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {editingMedia && (
            <div
              className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Rename Media Asset"
            >
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (saveMediaAsset(editingMedia)) setEditingMedia(null);
                }}
                className="w-full max-w-sm rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-5 space-y-4 text-xs shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-2.5">
                  <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                    Rename Media Asset
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingMedia(null)}
                    aria-label="Close modal"
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <input
                  type="text"
                  value={editingMedia.fileName}
                  onChange={(e) => setEditingMedia({ ...editingMedia, fileName: e.target.value })}
                  className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMedia(null)}
                    className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-3.5 text-[color:var(--wm-ink)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {/* Mode 5: Navigation, Banner & Footer */}
      {mode === 'navigation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs items-start">
          <section className="wm-surface-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex items-center gap-2">
              <Navigation className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Top Navigation Links & Bottom Banner
              </h2>
            </div>
            <div className="divide-y divide-[color:var(--wm-hairline)]">
              {draft.navigation.map((nav) => (
                <div key={nav.id} className="px-5 py-3 flex items-center gap-2.5">
                  <input
                    type="text"
                    aria-label={`Navigation label ${nav.label}`}
                    value={nav.label}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          navigation: d.navigation.map((n) =>
                            n.id === nav.id ? { ...n, label: e.target.value } : n,
                          ),
                        }),
                        `Renamed nav link ${nav.label}`,
                      )
                    }
                    className="h-9 flex-1 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                  />
                  <input
                    type="text"
                    aria-label={`Navigation target ${nav.label}`}
                    value={nav.href}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          navigation: d.navigation.map((n) =>
                            n.id === nav.id ? { ...n, href: e.target.value } : n,
                          ),
                        }),
                        `Updated nav target for ${nav.label}`,
                      )
                    }
                    className="h-9 w-28 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 font-mono text-[color:var(--wm-accent)]"
                  />
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[color:var(--wm-ink-secondary)]">
                    <input
                      type="checkbox"
                      checked={nav.visible}
                      onChange={(e) =>
                        updateWebsiteDraft(
                          (d) => ({
                            ...d,
                            navigation: d.navigation.map((n) =>
                              n.id === nav.id ? { ...n, visible: e.target.checked } : n,
                            ),
                          }),
                          `Toggled nav item ${nav.label}`,
                        )
                      }
                      className="accent-[#a9b47e]"
                    />
                    <span>Show</span>
                  </label>
                </div>
              ))}
            </div>

            <div className="border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-5 space-y-2.5">
              <label className="inline-flex items-center gap-2 font-medium text-[color:var(--wm-ink)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.bannerEnabled}
                  onChange={(e) =>
                    updateWebsiteDraft(
                      (d) => ({ ...d, bannerEnabled: e.target.checked }),
                      'Toggled announcement bar visibility',
                    )
                  }
                  className="accent-[#a9b47e]"
                />
                <span>Enable Bottom Announcement Bar</span>
              </label>
              <input
                type="text"
                aria-label="Announcement bar copy"
                value={draft.bannerText}
                onChange={(e) =>
                  updateWebsiteDraft(
                    (d) => ({ ...d, bannerText: e.target.value }),
                    'Edited announcement banner copy',
                  )
                }
                className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>
          </section>

          <section className="wm-surface-panel p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)] border-b border-[color:var(--wm-hairline)] pb-3">
              Footer & Contact Details
            </h2>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Edition Line</label>
              <input
                type="text"
                value={draft.footer.editionText}
                onChange={(e) =>
                  updateWebsiteDraft(
                    (d) => ({ ...d, footer: { ...d.footer, editionText: e.target.value } }),
                    'Updated footer edition copy',
                  )
                }
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Official Contact Email</label>
              <input
                type="email"
                value={draft.footer.contactEmail}
                onChange={(e) =>
                  updateWebsiteDraft(
                    (d) => ({ ...d, footer: { ...d.footer, contactEmail: e.target.value } }),
                    'Updated footer contact email',
                  )
                }
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Copyright Notice</label>
              <input
                type="text"
                value={draft.footer.copyrightText}
                onChange={(e) =>
                  updateWebsiteDraft(
                    (d) => ({ ...d, footer: { ...d.footer, copyrightText: e.target.value } }),
                    'Updated footer copyright notice',
                  )
                }
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>
          </section>
        </div>
      )}

      {/* Mode 6: SEO Inspector */}
      {mode === 'seo' && (
        <section className="wm-surface-panel p-5 sm:p-6 space-y-5 text-xs">
          <div className="flex items-center gap-2 border-b border-[color:var(--wm-hairline)] pb-3">
            <Search className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              SEO Metadata & Search Preview
            </h2>
          </div>

          {draft.pages[0] && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-3.5">
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Primary Meta Title</label>
                  <input
                    type="text"
                    value={draft.pages[0].seoTitle}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          pages: d.pages.map((p, idx) =>
                            idx === 0 ? { ...p, seoTitle: e.target.value } : p,
                          ),
                        }),
                        'Updated primary SEO title in Draft',
                      )
                    }
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Meta Description</label>
                  <textarea
                    rows={3}
                    value={draft.pages[0].seoDescription}
                    onChange={(e) =>
                      updateWebsiteDraft(
                        (d) => ({
                          ...d,
                          pages: d.pages.map((p, idx) =>
                            idx === 0 ? { ...p, seoDescription: e.target.value } : p,
                          ),
                        }),
                        'Updated meta description in Draft',
                      )
                    }
                    className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-2.5 text-[color:var(--wm-ink)]"
                  />
                </div>
              </div>

              <div className="lg:col-span-6 wm-surface-inset p-5 space-y-2">
                <p className="wm-section-kicker">Search Engine Result Preview</p>
                <p className="font-mono text-[11px] text-[color:var(--wm-accent)]">
                  https://willowmun.org/
                </p>
                <p className="font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                  {draft.pages[0].seoTitle}
                </p>
                <p className="text-xs text-[color:var(--wm-ink-secondary)] leading-relaxed">
                  {draft.pages[0].seoDescription}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Mode 7: Version History & Rollback */}
      {mode === 'versions' && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex items-center gap-2">
            <History className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Website Release Version History ({data.websiteVersions.length})
            </h2>
          </div>

          <div className="divide-y divide-[color:var(--wm-hairline)] text-xs">
            {data.websiteVersions.map((ver, idx) => (
              <div
                key={ver.id}
                className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#ede6ca]/[0.02]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[11px] font-medium text-[color:var(--wm-accent)]">
                      v{ver.versionNumber}
                    </span>
                    <span className="font-semibold text-[color:var(--wm-ink)]">{ver.summary}</span>
                    {idx === 0 && (
                      <span className="rounded border border-emerald-400/35 bg-emerald-500/[0.1] px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                        Currently Live
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[color:var(--wm-ink-muted)] tabular-nums">
                    Published by {ver.publishedBy} ·{' '}
                    {new Date(ver.publishedAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => restoreWebsiteVersion(ver.id, false)}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Load Into Draft</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreTargetId(ver.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
                  >
                    <span>Restore Live</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={restoreTargetId !== null}
        title="Confirm Live Website Rollback"
        description="This immediately replaces the live public website configuration with the selected historical snapshot and creates a new audit version."
        confirmLabel="Confirm Rollback & Publish"
        onConfirm={() => {
          if (restoreTargetId) restoreWebsiteVersion(restoreTargetId, true);
          setRestoreTargetId(null);
        }}
        onCancel={() => setRestoreTargetId(null)}
      />
    </div>
  );
}
