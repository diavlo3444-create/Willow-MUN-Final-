import { useState, type FormEvent } from 'react';
import {
  BookOpen,
  Calendar,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Megaphone,
  Plus,
  Tag,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type {
  AnnouncementRecord,
  CommitteeRecord,
  ConferenceDocumentRecord,
  ExecutiveBoardMember,
  FaqRecord,
  GalleryItemRecord,
  ScheduleEventRecord,
  SponsorRecord,
} from '../../../types/admin';

type CmsSection =
  | 'committees'
  | 'executive-board'
  | 'sponsors'
  | 'schedule'
  | 'announcements'
  | 'documents'
  | 'faqs'
  | 'gallery';

export function ConferenceCmsView({ section }: { section: CmsSection }) {
  const {
    data,
    saveCommittee,
    deleteCommittee,
    saveExecutiveBoardMember,
    deleteExecutiveBoardMember,
    saveSponsor,
    deleteSponsor,
    saveScheduleEvent,
    deleteScheduleEvent,
    saveAnnouncement,
    deleteAnnouncement,
    saveConferenceDocument,
    deleteConferenceDocument,
    saveFaq,
    deleteFaq,
    saveGalleryItem,
    deleteGalleryItem,
  } = useAdminStore();

  const [editCommittee, setEditCommittee] = useState<CommitteeRecord | null>(null);
  const [editEb, setEditEb] = useState<ExecutiveBoardMember | null>(null);
  const [editSponsor, setEditSponsor] = useState<SponsorRecord | null>(null);
  const [editEvent, setEditEvent] = useState<ScheduleEventRecord | null>(null);
  const [editAnn, setEditAnn] = useState<AnnouncementRecord | null>(null);
  const [editDoc, setEditDoc] = useState<ConferenceDocumentRecord | null>(null);
  const [editFaq, setEditFaq] = useState<FaqRecord | null>(null);
  const [editGallery, setEditGallery] = useState<GalleryItemRecord | null>(null);

  if (section === 'committees') {
    const sorted = [...data.committees].sort((a, b) => a.order - b.order);
    return (
      <div className="space-y-4">
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <BookOpen className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>
              Conference Chambers (01-06+): agenda topics, chairpersons, seat capacities, and publication state.
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditCommittee({
                id: '',
                chamber: `Chamber 0${data.committees.length + 1}`,
                name: 'New Committee',
                abbreviation: `CH-0${data.committees.length + 1}`,
                difficulty: 'Intermediate',
                description: 'Agenda and chairs to be announced.',
                topics: ['Agenda Topic I'],
                chairName: 'TBA',
                viceChairName: 'TBA',
                logoUrl: '/assets/logo-transparent.png',
                imageUrl: null,
                capacity: 40,
                published: false,
                order: data.committees.length + 1,
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Committee</span>
          </button>
        </div>

        <div className="wm-surface-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                <tr>
                  <th className="py-3 px-4">Chamber</th>
                  <th className="py-3 px-4">Committee & Agenda Topics</th>
                  <th className="py-3 px-4">Dais (Chair & Vice)</th>
                  <th className="py-3 px-4">Level & Cap</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--wm-hairline)]">
                {sorted.map((c) => (
                  <tr key={c.id} className="hover:bg-[#ede6ca]/[0.03] align-top">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-mono text-[11px] font-medium text-[color:var(--wm-accent)]">
                        {c.chamber}
                      </p>
                      <p className="font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                        {c.abbreviation}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <p className="font-serif text-lg font-medium text-[color:var(--wm-ink)] leading-snug">
                        {c.name}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                        {c.description}
                      </p>
                      <p className="mt-1.5 text-[11px] text-[color:var(--wm-accent)]">
                        Topics: {c.topics.join(' | ')}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="text-[color:var(--wm-ink)] font-medium">{c.chairName}</p>
                      <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
                        Vice: {c.viceChairName}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="text-[color:var(--wm-ink)]">{c.difficulty}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                        {c.capacity} delegates
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => saveCommittee({ ...c, published: !c.published })}
                        className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                          c.published
                            ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-200'
                            : 'border-amber-400/30 bg-amber-500/[0.09] text-amber-200'
                        }`}
                      >
                        {c.published ? (
                          <Eye className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <EyeOff className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{c.published ? 'Published' : 'Draft'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditCommittee(structuredClone(c))}
                          className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCommittee(c.id)}
                          aria-label={`Delete ${c.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {editCommittee && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (saveCommittee(editCommittee)) setEditCommittee(null);
              }}
              className="w-full max-w-lg rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
                <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                  Edit Committee Chamber
                </h2>
                <button
                  type="button"
                  onClick={() => setEditCommittee(null)}
                  aria-label="Close committee editor"
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Chamber Label</label>
                  <input
                    required
                    type="text"
                    value={editCommittee.chamber}
                    onChange={(e) => setEditCommittee({ ...editCommittee, chamber: e.target.value })}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Committee Name</label>
                  <input
                    required
                    type="text"
                    value={editCommittee.name}
                    onChange={(e) => setEditCommittee({ ...editCommittee, name: e.target.value })}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Chair Name</label>
                  <input
                    type="text"
                    value={editCommittee.chairName}
                    onChange={(e) => setEditCommittee({ ...editCommittee, chairName: e.target.value })}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Vice Chair Name</label>
                  <input
                    type="text"
                    value={editCommittee.viceChairName}
                    onChange={(e) =>
                      setEditCommittee({ ...editCommittee, viceChairName: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Difficulty</label>
                  <select
                    value={editCommittee.difficulty}
                    onChange={(e) =>
                      setEditCommittee({
                        ...editCommittee,
                        difficulty: e.target.value as CommitteeRecord['difficulty'],
                      })
                    }
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Crisis">Crisis</option>
                  </select>
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Capacity</label>
                  <input
                    type="number"
                    min={5}
                    value={editCommittee.capacity}
                    onChange={(e) =>
                      setEditCommittee({
                        ...editCommittee,
                        capacity: Number(e.target.value) || 20,
                      })
                    }
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">
                  Agenda Topics (comma-separated)
                </label>
                <input
                  type="text"
                  value={editCommittee.topics.join(', ')}
                  onChange={(e) =>
                    setEditCommittee({
                      ...editCommittee,
                      topics: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Description</label>
                <textarea
                  rows={2}
                  value={editCommittee.description}
                  onChange={(e) =>
                    setEditCommittee({ ...editCommittee, description: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--wm-hairline)]">
                <button
                  type="button"
                  onClick={() => setEditCommittee(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
                >
                  Save Committee
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (section === 'executive-board') {
    const sorted = [...data.executiveBoard].sort((a, b) => a.order - b.order);
    return (
      <div className="space-y-4">
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <UserCheck className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>
              Configure Executive Board leadership nodes rendered in the public organizational pedigree tree.
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditEb({
                id: '',
                name: '',
                position: '',
                groupId: 'secretariat',
                groupLabel: 'Secretariat',
                side: 'center',
                cluster: null,
                bio: '',
                quote: '',
                quoteBy: null,
                photoUrl: null,
                visible: true,
                order: data.executiveBoard.length + 1,
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add EB Member</span>
          </button>
        </div>

        <div className="wm-surface-panel overflow-hidden divide-y divide-[color:var(--wm-hairline)]">
          {sorted.map((m) => (
            <div
              key={m.id}
              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#ede6ca]/[0.03]"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {m.photoUrl ? (
                  <img
                    src={m.photoUrl}
                    alt={m.name}
                    className="h-12 w-12 rounded object-cover border border-[color:var(--wm-hairline-strong)] shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex items-center justify-center text-base font-serif text-[color:var(--wm-accent)] shrink-0">
                    {m.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                      #{m.order}
                    </span>
                    <p className="text-sm font-semibold text-[color:var(--wm-ink)]">{m.name}</p>
                    <span className="text-xs text-[color:var(--wm-accent)]">· {m.position}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
                    {m.groupLabel} · Tree Branch: {m.side.toUpperCase()}
                  </p>
                  {m.quote && (
                    <p className="mt-1 text-xs italic text-[color:var(--wm-ink-secondary)] line-clamp-1">
                      &ldquo;{m.quote}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => saveExecutiveBoardMember({ ...m, visible: !m.visible })}
                  className={`h-8 rounded border px-2.5 text-xs font-medium cursor-pointer ${
                    m.visible
                      ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-200'
                      : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-muted)]'
                  }`}
                >
                  {m.visible ? 'Visible on Tree' : 'Hidden'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditEb(structuredClone(m))}
                  className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteExecutiveBoardMember(m.id)}
                  aria-label={`Delete ${m.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {editEb && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (saveExecutiveBoardMember(editEb)) setEditEb(null);
              }}
              className="w-full max-w-lg rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-3 text-xs shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
                <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                  Executive Board Profile
                </h2>
                <button
                  type="button"
                  onClick={() => setEditEb(null)}
                  aria-label="Close EB editor"
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Name</label>
                  <input
                    required
                    type="text"
                    value={editEb.name}
                    onChange={(e) => setEditEb({ ...editEb, name: e.target.value })}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Position</label>
                  <input
                    required
                    type="text"
                    value={editEb.position}
                    onChange={(e) => setEditEb({ ...editEb, position: e.target.value })}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Group Label</label>
                  <input
                    type="text"
                    value={editEb.groupLabel}
                    onChange={(e) => setEditEb({ ...editEb, groupLabel: e.target.value })}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Display Order</label>
                  <input
                    type="number"
                    min={1}
                    value={editEb.order}
                    onChange={(e) => setEditEb({ ...editEb, order: Number(e.target.value) || 1 })}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Editorial Quote</label>
                <input
                  type="text"
                  value={editEb.quote}
                  onChange={(e) => setEditEb({ ...editEb, quote: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
                <button
                  type="button"
                  onClick={() => setEditEb(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (section === 'sponsors') {
    return (
      <div className="space-y-4">
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <Tag className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>Manage conference patrons, sponsorship tiers, website links, and visibility.</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditSponsor({
                id: '',
                name: 'New Partner',
                tier: 'Gold',
                description: 'Conference institutional sponsor.',
                logoUrl: '/assets/logo-transparent.png',
                websiteUrl: 'https://willowmun.org',
                visible: true,
                order: data.sponsors.length + 1,
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Sponsor</span>
          </button>
        </div>

        <div className="wm-surface-panel overflow-hidden divide-y divide-[color:var(--wm-hairline)]">
          {data.sponsors.map((s) => (
            <div
              key={s.id}
              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:bg-[#ede6ca]/[0.03]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {s.logoUrl && (
                  <img
                    src={s.logoUrl}
                    alt=""
                    className="h-11 w-11 rounded bg-[color:var(--wm-canvas)] border border-[color:var(--wm-hairline)] p-1.5 object-contain shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--wm-ink)]">{s.name}</p>
                    <span className="font-mono text-[11px] text-[color:var(--wm-accent)]">
                      {s.tier} Tier
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[color:var(--wm-ink-secondary)]">
                    {s.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => saveSponsor({ ...s, visible: !s.visible })}
                  className={`h-8 rounded border px-2.5 text-xs font-medium cursor-pointer ${
                    s.visible
                      ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-200'
                      : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-muted)]'
                  }`}
                >
                  {s.visible ? 'Visible on Site' : 'Hidden'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditSponsor(structuredClone(s))}
                  aria-label={`Edit ${s.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteSponsor(s.id)}
                  aria-label={`Delete ${s.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {editSponsor && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (saveSponsor(editSponsor)) setEditSponsor(null);
              }}
              className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-3 text-xs shadow-2xl"
            >
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">Sponsor Details</h2>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Organization Name</label>
                <input
                  required
                  type="text"
                  value={editSponsor.name}
                  onChange={(e) => setEditSponsor({ ...editSponsor, name: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Tier</label>
                <select
                  value={editSponsor.tier}
                  onChange={(e) =>
                    setEditSponsor({ ...editSponsor, tier: e.target.value as SponsorRecord['tier'] })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                >
                  <option value="Title">Title</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Community Partner">Community Partner</option>
                </select>
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Description</label>
                <textarea
                  rows={2}
                  value={editSponsor.description}
                  onChange={(e) => setEditSponsor({ ...editSponsor, description: e.target.value })}
                  className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
                <button
                  type="button"
                  onClick={() => setEditSponsor(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
                >
                  Save Sponsor
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (section === 'schedule') {
    return (
      <div className="space-y-4">
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <Calendar className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>Publish and organize official Willow MUN conference itinerary events.</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditEvent({
                id: '',
                title: 'Committee Session II',
                date: '2027-12-18',
                startTime: '15:00',
                endTime: '17:30',
                location: 'Chambers 01-06',
                category: 'Committee Session',
                description: 'Moderated caucuses and working paper drafting.',
                visible: true,
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Event</span>
          </button>
        </div>

        <div className="wm-surface-panel overflow-hidden divide-y divide-[color:var(--wm-hairline)]">
          {data.scheduleEvents.map((ev) => (
            <div
              key={ev.id}
              className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:bg-[#ede6ca]/[0.03]"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 min-w-0">
                <div className="sm:w-40 shrink-0 font-mono text-[11px] text-[color:var(--wm-accent)] tabular-nums">
                  <p>{ev.date}</p>
                  <p className="text-[color:var(--wm-ink-muted)]">
                    {ev.startTime} - {ev.endTime}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--wm-ink)]">{ev.title}</p>
                  <p className="mt-0.5 text-[color:var(--wm-ink-secondary)]">{ev.description}</p>
                  <p className="mt-1 font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                    {ev.location} · {ev.category}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => saveScheduleEvent({ ...ev, visible: !ev.visible })}
                  className={`h-8 rounded border px-2.5 text-xs font-medium cursor-pointer ${
                    ev.visible
                      ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-200'
                      : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-muted)]'
                  }`}
                >
                  {ev.visible ? 'Published' : 'Hidden'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditEvent(structuredClone(ev))}
                  className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteScheduleEvent(ev.id)}
                  aria-label={`Delete ${ev.title}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {editEvent && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (saveScheduleEvent(editEvent)) setEditEvent(null);
              }}
              className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-3 text-xs shadow-2xl"
            >
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">Schedule Event</h2>
              <input
                required
                type="text"
                value={editEvent.title}
                onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })}
                placeholder="Event title"
                className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={editEvent.date}
                  onChange={(e) => setEditEvent({ ...editEvent, date: e.target.value })}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2 text-[color:var(--wm-ink)]"
                />
                <input
                  type="time"
                  value={editEvent.startTime}
                  onChange={(e) => setEditEvent({ ...editEvent, startTime: e.target.value })}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2 text-[color:var(--wm-ink)]"
                />
                <input
                  type="time"
                  value={editEvent.endTime}
                  onChange={(e) => setEditEvent({ ...editEvent, endTime: e.target.value })}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2 text-[color:var(--wm-ink)]"
                />
              </div>
              <input
                type="text"
                value={editEvent.location}
                onChange={(e) => setEditEvent({ ...editEvent, location: e.target.value })}
                placeholder="Venue location"
                className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
              />
              <textarea
                rows={2}
                value={editEvent.description}
                onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })}
                className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
              />
              <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
                <button
                  type="button"
                  onClick={() => setEditEvent(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (section === 'announcements') {
    return (
      <div className="space-y-4">
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <Megaphone className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>Create, edit, publish/unpublish conference announcements shown under Updates.</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditAnn({
                id: '',
                title: 'New Announcement',
                summary: 'Official announcement details.',
                badgeText: 'NEW',
                imageUrl: null,
                publishDate: '2027-11-17',
                published: false,
                featuredInBanner: false,
                order: data.announcements.length + 1,
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Announcement</span>
          </button>
        </div>

        <div className="wm-surface-panel overflow-hidden divide-y divide-[color:var(--wm-hairline)]">
          {data.announcements.map((a) => (
            <div
              key={a.id}
              className="p-4 sm:px-5 flex flex-wrap items-center justify-between gap-4 text-xs hover:bg-[#ede6ca]/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[color:var(--wm-accent)]">
                    [{a.badgeText}]
                  </span>
                  <span className="text-sm font-semibold text-[color:var(--wm-ink)]">{a.title}</span>
                </div>
                <p className="mt-1 text-[color:var(--wm-ink-secondary)]">{a.summary}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => saveAnnouncement({ ...a, published: !a.published })}
                  className={`h-8 rounded border px-2.5 text-xs font-medium cursor-pointer ${
                    a.published
                      ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-200'
                      : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-muted)]'
                  }`}
                >
                  {a.published ? 'Published' : 'Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditAnn(structuredClone(a))}
                  className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteAnnouncement(a.id)}
                  aria-label={`Delete ${a.title}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {editAnn && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (saveAnnouncement(editAnn)) setEditAnn(null);
              }}
              className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-3 text-xs shadow-2xl"
            >
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                Edit Announcement
              </h2>
              <input
                required
                type="text"
                value={editAnn.title}
                onChange={(e) => setEditAnn({ ...editAnn, title: e.target.value })}
                placeholder="Title"
                className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
              />
              <input
                type="text"
                value={editAnn.badgeText}
                onChange={(e) => setEditAnn({ ...editAnn, badgeText: e.target.value })}
                placeholder="Badge e.g. TBA or NEW"
                className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
              />
              <textarea
                rows={3}
                value={editAnn.summary}
                onChange={(e) => setEditAnn({ ...editAnn, summary: e.target.value })}
                className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
              />
              <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
                <button
                  type="button"
                  onClick={() => setEditAnn(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
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
      </div>
    );
  }

  if (section === 'documents') {
    return (
      <div className="space-y-4">
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <FileText className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>Study guides, delegate handbooks, and parliamentary procedure documents.</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditDoc({
                id: '',
                title: 'New Conference Study Guide',
                category: 'Study Guide',
                url: '/favicon.png',
                sizeLabel: '950 KB PDF',
                visible: true,
                updatedAt: new Date().toISOString(),
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Document</span>
          </button>
        </div>

        <div className="wm-surface-panel overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
              <tr>
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Format & Size</th>
                <th className="py-3 px-4">Visibility</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {data.conferenceDocuments.map((d) => (
                <tr key={d.id} className="hover:bg-[#ede6ca]/[0.03]">
                  <td className="py-3.5 px-4 font-semibold text-[color:var(--wm-ink)]">{d.title}</td>
                  <td className="py-3.5 px-4 text-[color:var(--wm-accent)]">{d.category}</td>
                  <td className="py-3.5 px-4 font-mono text-[color:var(--wm-ink-muted)]">
                    {d.sizeLabel}
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => saveConferenceDocument({ ...d, visible: !d.visible })}
                      className={`h-7 rounded border px-2.5 text-[11px] font-medium cursor-pointer ${
                        d.visible
                          ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-200'
                          : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-muted)]'
                      }`}
                    >
                      {d.visible ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditDoc(structuredClone(d))}
                        className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-xs text-[color:var(--wm-ink)] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteConferenceDocument(d.id)}
                        aria-label={`Delete ${d.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editDoc && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (saveConferenceDocument(editDoc)) setEditDoc(null);
              }}
              className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-3 text-xs shadow-2xl"
            >
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                Document Metadata
              </h2>
              <input
                required
                type="text"
                value={editDoc.title}
                onChange={(e) => setEditDoc({ ...editDoc, title: e.target.value })}
                className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
              />
              <select
                value={editDoc.category}
                onChange={(e) =>
                  setEditDoc({
                    ...editDoc,
                    category: e.target.value as ConferenceDocumentRecord['category'],
                  })
                }
                className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
              >
                <option value="Study Guide">Study Guide</option>
                <option value="Rules of Procedure">Rules of Procedure</option>
                <option value="Delegate Handbook">Delegate Handbook</option>
                <option value="Policy">Policy</option>
                <option value="Schedule">Schedule</option>
              </select>
              <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
                <button
                  type="button"
                  onClick={() => setEditDoc(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
                >
                  Save Document
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (section === 'faqs') {
    return (
      <div className="space-y-4">
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <HelpCircle className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>Maintain public Frequently Asked Questions for delegates and schools.</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditFaq({
                id: '',
                category: 'General',
                question: 'New Question?',
                answer: 'Official Secretariat response.',
                visible: true,
                order: data.faqs.length + 1,
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add FAQ</span>
          </button>
        </div>

        <div className="wm-surface-panel overflow-hidden divide-y divide-[color:var(--wm-hairline)]">
          {data.faqs.map((f) => (
            <div
              key={f.id}
              className="p-5 flex flex-wrap items-start justify-between gap-4 text-xs hover:bg-[#ede6ca]/[0.03]"
            >
              <div className="space-y-1 max-w-3xl">
                <p className="wm-section-kicker text-[color:var(--wm-accent)]">{f.category}</p>
                <p className="text-sm font-semibold text-[color:var(--wm-ink)]">{f.question}</p>
                <p className="text-[color:var(--wm-ink-secondary)] leading-relaxed">{f.answer}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditFaq(structuredClone(f))}
                  className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteFaq(f.id)}
                  aria-label={`Delete ${f.question}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {editFaq && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (saveFaq(editFaq)) setEditFaq(null);
              }}
              className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-3 text-xs shadow-2xl"
            >
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">Edit FAQ Entry</h2>
              <input
                required
                type="text"
                value={editFaq.question}
                onChange={(e) => setEditFaq({ ...editFaq, question: e.target.value })}
                className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
              />
              <textarea
                required
                rows={3}
                value={editFaq.answer}
                onChange={(e) => setEditFaq({ ...editFaq, answer: e.target.value })}
                className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
              />
              <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
                <button
                  type="button"
                  onClick={() => setEditFaq(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
                >
                  Save FAQ
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // gallery (visual media genuinely warrants a photography grid)
  return (
    <div className="space-y-4">
      <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
          <ImageIcon className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          <span>Curate public photo gallery items sourced from verified Willow MUN assets.</span>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditGallery({
              id: '',
              title: 'New Gallery Frame',
              caption: 'Willow MUN conference photography.',
              imageUrl: '/willow-poster.jpg',
              folder: 'Conference',
              visible: true,
              order: data.galleryItems.length + 1,
            })
          }
          className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Gallery Photo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {data.galleryItems.map((g) => (
          <div key={g.id} className="wm-surface-panel overflow-hidden flex flex-col">
            <img src={g.imageUrl} alt={g.title} className="h-48 w-full object-cover" />
            <div className="p-4 text-xs flex-1 flex flex-col justify-between gap-3">
              <div>
                <p className="font-semibold text-[color:var(--wm-ink)]">{g.title}</p>
                <p className="mt-1 text-[color:var(--wm-ink-secondary)]">{g.caption}</p>
              </div>
              <div className="flex items-center justify-between pt-2.5 border-t border-[color:var(--wm-hairline)]">
                <button
                  type="button"
                  onClick={() => setEditGallery(structuredClone(g))}
                  className="text-[color:var(--wm-accent)] font-medium hover:underline cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteGalleryItem(g.id)}
                  className="text-rose-200 hover:underline cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editGallery && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (saveGalleryItem(editGallery)) setEditGallery(null);
            }}
            className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-3 text-xs shadow-2xl"
          >
            <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">Gallery Item</h2>
            <input
              required
              type="text"
              value={editGallery.title}
              onChange={(e) => setEditGallery({ ...editGallery, title: e.target.value })}
              className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
            />
            <select
              value={editGallery.imageUrl}
              onChange={(e) => setEditGallery({ ...editGallery, imageUrl: e.target.value })}
              className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
            >
              {data.mediaLibrary.map((m) => (
                <option key={m.id} value={m.url}>
                  {m.fileName} ({m.folder})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={editGallery.caption}
              onChange={(e) => setEditGallery({ ...editGallery, caption: e.target.value })}
              className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
            />
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
              <button
                type="button"
                onClick={() => setEditGallery(null)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
              >
                Save Item
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
