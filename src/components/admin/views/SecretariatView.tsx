import { useMemo, useState, type FormEvent } from 'react';
import { Edit2, Eye, EyeOff, Plus, Search, Trash2, UserCheck, X } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { SecretariatCategory, SecretariatMember } from '../../../types/admin';
import { hasPermission } from '../../../utils/adminPermissions';
import { ConfirmDialog } from '../ConfirmDialog';

const CATEGORIES: Array<{ id: SecretariatCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Categories' },
  { id: 'secretariat', label: 'Secretariat' },
  { id: 'communications', label: 'Communications & Creative' },
  { id: 'operations', label: 'Operations' },
  { id: 'logistics', label: 'Logistics & Admin' },
];

export function SecretariatView() {
  const {
    data,
    currentUser,
    saveSecretariatMember,
    deleteSecretariatMember,
  } = useAdminStore();

  const [categoryFilter, setCategoryFilter] = useState<SecretariatCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SecretariatMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretariatMember | null>(null);

  const canManage = hasPermission(currentUser, 'secretariat.manage');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...data.secretariat]
      .sort((a, b) => a.order - b.order)
      .filter((m) => {
        if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
        if (q) {
          const hay = `${m.name} ${m.role} ${m.groupLabel} ${m.bio}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [categoryFilter, data.secretariat, search]);

  const openNew = () => {
    setEditing({
      id: '',
      name: '',
      role: '',
      category: 'secretariat',
      groupLabel: 'secretariat',
      bio: '',
      quote: '',
      quoteBy: null,
      photoUrl: null,
      email: '',
      visible: true,
      order: data.secretariat.length + 1,
    });
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    if (saveSecretariatMember(editing)) {
      setEditing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="wm-surface-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Secretariat members..."
              className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as SecretariatCategory | 'all')}
            aria-label="Filter category"
            className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {/* Unified Roster Directory Table */}
      <div className="wm-surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Role & Track</th>
                <th className="py-3 px-4">Biography</th>
                <th className="py-3 px-4">Visibility</th>
                {canManage && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[#ede6ca]/[0.03] align-top">
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {m.photoUrl ? (
                        <img
                          src={m.photoUrl}
                          alt={m.name}
                          className="h-10 w-10 rounded object-cover border border-[color:var(--wm-hairline-strong)] shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[color:var(--wm-accent)] shrink-0">
                          <UserCheck className="h-4 w-4" aria-hidden="true" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[color:var(--wm-ink)]">{m.name}</p>
                        <p className="font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                          {m.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <p className="font-medium text-[color:var(--wm-accent)]">{m.role}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      {m.category}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 max-w-md text-[color:var(--wm-ink-secondary)] leading-relaxed">
                    {m.bio}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => saveSecretariatMember({ ...m, visible: !m.visible })}
                        className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                          m.visible
                            ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-200'
                            : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-muted)]'
                        }`}
                      >
                        {m.visible ? (
                          <Eye className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <EyeOff className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{m.visible ? 'Visible' : 'Hidden'}</span>
                      </button>
                    ) : (
                      <span className="text-[color:var(--wm-ink-secondary)]">
                        {m.visible ? 'Visible' : 'Hidden'}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(structuredClone(m))}
                          className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(m)}
                          aria-label={`Remove ${m.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                {editing.id ? 'Edit Secretariat Member' : 'Add Secretariat Member'}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close member editor"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Full Name</label>
                <input
                  required
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Title / Role</label>
                <input
                  required
                  type="text"
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Category</label>
                <select
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value as SecretariatCategory })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                >
                  <option value="secretariat">Secretariat</option>
                  <option value="communications">Communications & Creative</option>
                  <option value="operations">Operations</option>
                  <option value="logistics">Logistics & Admin</option>
                </select>
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Portrait Path</label>
                <select
                  value={editing.photoUrl ?? ''}
                  onChange={(e) => setEditing({ ...editing, photoUrl: e.target.value || null })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                >
                  <option value="">No Portrait</option>
                  {data.mediaLibrary
                    .filter((m) => m.folder === 'Portraits')
                    .map((asset) => (
                      <option key={asset.id} value={asset.url}>
                        {asset.fileName}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Biography</label>
              <textarea
                rows={3}
                value={editing.bio}
                onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-3 text-[color:var(--wm-ink)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
              >
                Save Member
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove Secretariat Member"
        description={`Remove ${deleteTarget?.name} from the conference roster?`}
        confirmLabel="Remove Member"
        tone="danger"
        onConfirm={() => {
          if (deleteTarget) deleteSecretariatMember(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
