import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  fetchManageableCommittees,
  removeLiveCommittee,
  upsertLiveCommittee,
} from '../../../services/liveBackendService';
import type { AdminUser, CommitteeRecord } from '../../../types/admin';
import { isDccActor } from '../../../utils/adminPermissions';
import { ConfirmDialog } from '../ConfirmDialog';
import { WmSkeleton } from '../WmSkeleton';

const EMPTY_COMMITTEE: Omit<CommitteeRecord, 'id'> = {
  chamber: '',
  name: '',
  abbreviation: '',
  difficulty: 'Intermediate',
  description: '',
  topics: ['Topic 1'],
  chairName: 'TBA',
  viceChairName: 'TBA',
  logoUrl: null,
  imageUrl: null,
  capacity: 40,
  published: true,
  order: 1,
};

export function CommitteesManagementView({
  actingUserOverride = null,
}: {
  actingUserOverride?: AdminUser | null;
}) {
  const { currentUser, testModeHeadUser, data, pushToast, refreshSnapshot } = useAdminStore();
  const actor = actingUserOverride ?? testModeHeadUser ?? currentUser;

  const [committees, setCommittees] = useState<CommitteeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [remoteSynced, setRemoteSynced] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CommitteeRecord | null>(null);
  const [topicsInput, setTopicsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CommitteeRecord | null>(null);

  const allowed = isDccActor(actor, data.departments);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetchManageableCommittees(actor, data.departments);
    setCommittees(res.committees);
    setRemoteSynced(res.remoteAvailable);
    setLoading(false);
  }, [actor, allowed, data.departments]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return committees
      .filter((c) => {
        if (!q) return true;
        return `${c.chamber} ${c.name} ${c.abbreviation} ${c.description} ${c.chairName}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.order - b.order);
  }, [committees, search]);

  const openEditor = (record?: CommitteeRecord) => {
    if (record) {
      setEditing({ ...record });
      setTopicsInput(record.topics.join('\n'));
    } else {
      const nextOrder = committees.length + 1;
      setEditing({
        id: '',
        ...EMPTY_COMMITTEE,
        order: nextOrder,
        chamber: `Chamber 0${nextOrder}`,
      });
      setTopicsInput('');
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!actor || !editing) return;
    if (!editing.name.trim() || !editing.chamber.trim()) {
      pushToast({ tone: 'error', title: 'Chamber and committee name are required' });
      return;
    }

    setSaving(true);
    const payload: CommitteeRecord = {
      ...editing,
      id:
        editing.id ||
        `chamber-${(editing.abbreviation || editing.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}-${Date.now().toString(36)}`,
      topics: topicsInput
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    };

    const res = await upsertLiveCommittee(actor, payload, data.departments);
    setSaving(false);

    if (!res.ok) {
      pushToast({ tone: 'error', title: 'Could not save committee', description: res.error });
      return;
    }

    refreshSnapshot();
    setEditing(null);
    await load();
    pushToast({
      tone: 'success',
      title: editing.id ? 'Committee updated' : 'Committee created',
      description: res.remoteSynced
        ? 'Saved to Supabase and published to the conference website.'
        : 'Saved locally and reflected on the conference website.',
    });
  };

  const togglePublish = async (committee: CommitteeRecord) => {
    if (!actor) return;
    const res = await upsertLiveCommittee(
      actor,
      {
        ...committee,
        published: !committee.published,
      },
      data.departments,
    );
    if (!res.ok) {
      pushToast({ tone: 'error', title: 'Update failed', description: res.error });
      return;
    }
    refreshSnapshot();
    await load();
    pushToast({
      tone: 'success',
      title: !committee.published ? 'Committee published' : 'Committee unpublished',
      description: `${committee.name} visibility updated across the site.`,
    });
  };

  const confirmDelete = async () => {
    if (!actor || !deleteTarget) return;
    const res = await removeLiveCommittee(actor, deleteTarget.id, data.departments);
    setDeleteTarget(null);
    if (!res.ok) {
      pushToast({ tone: 'error', title: 'Delete failed', description: res.error });
      return;
    }
    refreshSnapshot();
    await load();
    pushToast({ tone: 'success', title: 'Committee removed' });
  };

  if (!allowed) {
    return (
      <div className="wm-surface-panel p-8 text-center">
        <p className="text-sm font-semibold text-rose-200">DCC or Admin Access Required</p>
        <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
          Committee management is restricted to Delegate & Committee Affairs (DCC) and Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="wm-surface-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
              DCC · Committee Management
            </p>
            <h1 className="wm-serif mt-1.5 text-2xl font-semibold text-[color:var(--wm-ink)]">
              Conference Committees
            </h1>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
              Create, edit, and publish chambers, agenda topics, chairs, and capacities. Published committees reflect immediately on the public site.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => openEditor()}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New Committee
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chamber, name, chair, or topic…"
              className="h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
            />
          </label>
          <span className="rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-3 py-2 text-[11px] font-mono text-[color:var(--wm-ink-muted)]">
            {committees.filter((c) => c.published).length} published / {committees.length} total
            {remoteSynced ? ' · Live DB' : ''}
          </span>
        </div>
      </section>

      {editing && (
        <motion.form
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={(e) => void handleSave(e)}
          className="wm-surface-panel space-y-4 border-[color:var(--wm-hairline-strong)] p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3">
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              {editing.id ? `Edit ${editing.name}` : 'Create Committee'}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-[color:var(--wm-ink-secondary)]">
              Chamber Label
              <input
                required
                value={editing.chamber}
                onChange={(e) => setEditing({ ...editing, chamber: e.target.value })}
                placeholder="e.g. Chamber 01"
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--wm-ink-secondary)] lg:col-span-2">
              Committee Name
              <input
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Security Council"
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--wm-ink-secondary)]">
              Abbreviation
              <input
                value={editing.abbreviation}
                onChange={(e) => setEditing({ ...editing, abbreviation: e.target.value })}
                placeholder="e.g. UNSC"
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-[color:var(--wm-ink-secondary)]">
              Difficulty Level
              <select
                value={editing.difficulty}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    difficulty: e.target.value as CommitteeRecord['difficulty'],
                  })
                }
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Crisis">Crisis</option>
              </select>
            </label>
            <label className="text-xs text-[color:var(--wm-ink-secondary)]">
              Chair Name
              <input
                value={editing.chairName}
                onChange={(e) => setEditing({ ...editing, chairName: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--wm-ink-secondary)]">
              Vice-Chair Name
              <input
                value={editing.viceChairName}
                onChange={(e) => setEditing({ ...editing, viceChairName: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                Capacity
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={editing.capacity}
                  onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) || 1 })}
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
                />
              </label>
              <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                Order
                <input
                  type="number"
                  min={1}
                  value={editing.order}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) || 1 })}
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-xs text-[color:var(--wm-ink-secondary)]">
              Description
              <textarea
                rows={4}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="Describe committee mandate and delegate focus…"
                className="mt-1.5 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>
            <label className="text-xs text-[color:var(--wm-ink-secondary)]">
              Agenda Topics (one per line)
              <textarea
                rows={4}
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
                placeholder="Topic 1&#10;Topic 2"
                className="mt-1.5 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wm-hairline)] pt-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[color:var(--wm-ink)]">
              <input
                type="checkbox"
                checked={editing.published}
                onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                className="h-4 w-4 accent-[#2d6a4f]"
              />
              Publish on public conference website
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] px-4 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                {saving ? 'Saving…' : 'Save Committee'}
              </button>
            </div>
          </div>
        </motion.form>
      )}

      {loading ? (
        <WmSkeleton variant="cards" rows={6} />
      ) : filtered.length === 0 ? (
        <div className="wm-surface-panel p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[color:var(--wm-ink)]">No committees match your search</p>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((committee) => (
            <article
              key={committee.id}
              className="wm-surface-panel flex flex-col justify-between p-5 transition-colors hover:border-[color:var(--wm-hairline-strong)]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--wm-accent)]">
                    {committee.chamber} {committee.abbreviation ? `· ${committee.abbreviation}` : ''}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                      committee.published
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-muted)]'
                    }`}
                  >
                    {committee.published ? 'Published' : 'Draft'}
                  </span>
                </div>

                <h3 className="wm-serif mt-2 text-lg font-semibold text-[color:var(--wm-ink)]">
                  {committee.name}
                </h3>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                  {committee.description || 'No description added yet.'}
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--wm-ink-muted)]">
                  <span className="rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-2 py-0.5">
                    {committee.difficulty}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-2 py-0.5">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {committee.capacity} delegates
                  </span>
                  <span>
                    Chair: <strong className="font-medium text-[color:var(--wm-ink-secondary)]">{committee.chairName || 'TBA'}</strong>
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--wm-hairline)] pt-3">
                <button
                  type="button"
                  onClick={() => void togglePublish(committee)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:border-[color:var(--wm-hairline-strong)] hover:text-[color:var(--wm-ink)]"
                >
                  {committee.published ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Unpublish
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Publish
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditor(committee)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(committee)}
                    aria-label={`Delete ${committee.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-400/25 text-rose-300 hover:bg-rose-500/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        tone="danger"
        title="Delete Committee?"
        description={
          deleteTarget
            ? `Permanently remove "${deleteTarget.name}" from the Willow MUN committees roster?`
            : ''
        }
        confirmLabel="Delete Committee"
        cancelLabel="Cancel"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
