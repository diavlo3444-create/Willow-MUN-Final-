import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type {
  ApplicationCategory,
  ApplicationFormDefinition,
  FormQuestion,
  FormQuestionType,
} from '../../../types/admin';

const QUESTION_TYPES: Array<{ value: FormQuestionType; label: string }> = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'conditional', label: 'Conditional Question' },
];

export function FormBuilderView() {
  const { data, saveApplicationForm, deleteApplicationForm } = useAdminStore();
  const [selectedId, setSelectedId] = useState<string>(data.applicationForms[0]?.id ?? '');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  const selectedForm =
    data.applicationForms.find((f) => f.id === selectedId) ?? data.applicationForms[0] ?? null;

  const [draft, setDraft] = useState<ApplicationFormDefinition | null>(selectedForm);

  const selectForm = (form: ApplicationFormDefinition) => {
    setSelectedId(form.id);
    setDraft(structuredClone(form));
    setPreviewMode(false);
    setPreviewValues({});
  };

  const handleCreateForm = () => {
    const newForm: ApplicationFormDefinition = {
      id: `form-${Date.now().toString(36)}`,
      title: 'New Custom Intake Form',
      category: 'staff',
      departmentId: null,
      description: 'Custom application questions for upcoming Willow MUN intake.',
      isOpen: false,
      deadline: '2026-12-15T23:59:00Z',
      updatedAt: new Date().toISOString(),
      questions: [
        {
          id: `q-${Date.now().toString(36)}`,
          section: 'Background',
          label: 'Describe your interest and relevant experience.',
          helpText: '',
          type: 'long_text',
          required: true,
          options: [],
          conditionalParentId: null,
          conditionalExpectedValue: null,
          order: 1,
        },
      ],
    };
    saveApplicationForm(newForm);
    setSelectedId(newForm.id);
    setDraft(newForm);
  };

  const addQuestion = () => {
    if (!draft) return;
    const q: FormQuestion = {
      id: `q-${Date.now().toString(36)}-${draft.questions.length + 1}`,
      section: 'General',
      label: 'New Application Question',
      helpText: '',
      type: 'short_text',
      required: false,
      options: [],
      conditionalParentId: null,
      conditionalExpectedValue: null,
      order: draft.questions.length + 1,
    };
    setDraft({ ...draft, questions: [...draft.questions, q] });
  };

  const updateQuestion = (qId: string, patch: Partial<FormQuestion>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      questions: draft.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    });
  };

  const moveQuestion = (index: number, delta: -1 | 1) => {
    if (!draft) return;
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= draft.questions.length) return;
    const next = [...draft.questions];
    [next[index], next[nextIdx]] = [next[nextIdx], next[index]];
    setDraft({
      ...draft,
      questions: next.map((q, i) => ({ ...q, order: i + 1 })),
    });
  };

  const removeQuestion = (qId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      questions: draft.questions
        .filter((q) => q.id !== qId)
        .map((q, i) => ({ ...q, order: i + 1 })),
    });
  };

  return (
    <div className="space-y-5">
      {/* Data Integrity Guarantee Strip */}
      <div className="wm-surface-panel bg-[#1b2210] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[color:var(--wm-ink)]">
          <ShieldCheck
            className="h-4 w-4 text-[color:var(--wm-accent)] shrink-0"
            aria-hidden="true"
          />
          <span>
            Editing or reordering questions affects future submissions only.{' '}
            <strong className="text-[color:var(--wm-accent)]">
              All historical applicant responses remain intact
            </strong>
            .
          </span>
        </div>
        <button
          type="button"
          onClick={handleCreateForm}
          className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Create Application Form</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Track Directory List */}
        <aside className="lg:col-span-4 wm-surface-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]">
            <p className="wm-section-kicker">Application Tracks ({data.applicationForms.length})</p>
          </div>
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {data.applicationForms.map((form) => {
              const active = draft?.id === form.id;
              return (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => selectForm(form)}
                  className={`w-full p-4 text-left transition-colors duration-150 cursor-pointer ${
                    active ? 'bg-[#ede6ca]/[0.08]' : 'hover:bg-[#ede6ca]/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wm-accent)]">
                        {form.category} track
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-[color:var(--wm-ink)]">
                        {form.title}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-[10px] font-medium ${
                        form.isOpen ? 'text-emerald-200' : 'text-[color:var(--wm-ink-muted)]'
                      }`}
                    >
                      {form.isOpen ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--wm-ink-secondary)] line-clamp-2">
                    {form.description}
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                    {form.questions.length} question(s)
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Form Schema Builder / Preview */}
        <div className="lg:col-span-8">
          {draft ? (
            <div className="wm-surface-panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-5 py-3.5 bg-[color:var(--wm-inset)]/50">
                <div className="inline-flex rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(false)}
                    className={`h-8 rounded px-3 text-xs font-medium cursor-pointer ${
                      !previewMode
                        ? 'bg-[color:var(--wm-focal)] text-[#12170c]'
                        : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                    }`}
                  >
                    Form Schema Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(true)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium cursor-pointer ${
                      previewMode
                        ? 'bg-[color:var(--wm-focal)] text-[#12170c]'
                        : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Live Preview</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      deleteApplicationForm(draft.id);
                      const remaining = data.applicationForms.filter((f) => f.id !== draft.id);
                      setDraft(remaining[0] ?? null);
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded border border-rose-400/35 px-2.5 text-xs text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => saveApplicationForm(draft)}
                    className="inline-flex h-8 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Save Form</span>
                  </button>
                </div>
              </div>

              {!previewMode ? (
                <div>
                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 border-b border-[color:var(--wm-hairline)] text-xs">
                    <div>
                      <label className="block text-[color:var(--wm-ink-secondary)] font-medium">
                        Form Title
                      </label>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[color:var(--wm-ink-secondary)] font-medium">
                        Applicant Category
                      </label>
                      <select
                        value={draft.category}
                        onChange={(e) =>
                          setDraft({ ...draft, category: e.target.value as ApplicationCategory })
                        }
                        className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                      >
                        <option value="delegate">Delegate & Chairs</option>
                        <option value="staff">Organizing Staff</option>
                        <option value="security">Security Corps</option>
                        <option value="media">Media & Press</option>
                        <option value="volunteer">Volunteers</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[color:var(--wm-ink-secondary)] font-medium">
                        Department Scope
                      </label>
                      <select
                        value={draft.departmentId ?? ''}
                        onChange={(e) =>
                          setDraft({ ...draft, departmentId: e.target.value || null })
                        }
                        className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                      >
                        <option value="">Any Department</option>
                        {data.departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2 cursor-pointer h-9">
                        <input
                          type="checkbox"
                          checked={draft.isOpen}
                          onChange={(e) => setDraft({ ...draft, isOpen: e.target.checked })}
                          className="h-4 w-4 accent-[#a9b47e]"
                        />
                        <span className="font-medium text-[color:var(--wm-ink)]">
                          Form Accepting Responses
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Rule-divided Questions List */}
                  <div className="px-5 py-3 border-b border-[color:var(--wm-hairline)] flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                      Questions ({draft.questions.length})
                    </h3>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                      <span>Add Question</span>
                    </button>
                  </div>

                  <div className="divide-y divide-[color:var(--wm-hairline)]">
                    {draft.questions.map((q, index) => (
                      <div key={q.id} className="p-5 space-y-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-medium text-[color:var(--wm-accent)]">
                            Q{index + 1} · {q.section}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveQuestion(index, -1)}
                              aria-label="Move up"
                              className="h-7 w-7 inline-flex items-center justify-center rounded border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestion(index, 1)}
                              aria-label="Move down"
                              className="h-7 w-7 inline-flex items-center justify-center rounded border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuestion(q.id)}
                              aria-label="Remove question"
                              className="h-7 w-7 inline-flex items-center justify-center rounded border border-rose-400/30 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="text-[color:var(--wm-ink-muted)]">
                              Question Prompt
                            </label>
                            <input
                              type="text"
                              value={q.label}
                              onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                              className="mt-1 h-8 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[color:var(--wm-ink)]"
                            />
                          </div>
                          <div>
                            <label className="text-[color:var(--wm-ink-muted)]">Field Type</label>
                            <select
                              value={q.type}
                              onChange={(e) =>
                                updateQuestion(q.id, { type: e.target.value as FormQuestionType })
                              }
                              className="mt-1 h-8 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[color:var(--wm-ink)]"
                            >
                              {QUESTION_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[color:var(--wm-ink-muted)]">Section</label>
                            <input
                              type="text"
                              value={q.section}
                              onChange={(e) => updateQuestion(q.id, { section: e.target.value })}
                              className="mt-1 h-8 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[color:var(--wm-ink)]"
                            />
                          </div>
                          <div>
                            <label className="text-[color:var(--wm-ink-muted)]">Help Text</label>
                            <input
                              type="text"
                              value={q.helpText}
                              onChange={(e) => updateQuestion(q.id, { helpText: e.target.value })}
                              className="mt-1 h-8 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[color:var(--wm-ink)]"
                            />
                          </div>
                          <div className="flex items-end pb-1">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.required}
                                onChange={(e) =>
                                  updateQuestion(q.id, { required: e.target.checked })
                                }
                                className="h-4 w-4 accent-[#a9b47e]"
                              />
                              <span className="text-[color:var(--wm-ink)]">Required field</span>
                            </label>
                          </div>
                        </div>

                        {(q.type === 'dropdown' || q.type === 'multiple_choice') && (
                          <div>
                            <label className="text-[color:var(--wm-ink-muted)]">
                              Options (comma-separated)
                            </label>
                            <input
                              type="text"
                              value={q.options.join(', ')}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  options: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="mt-1 h-8 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[color:var(--wm-ink)]"
                            />
                          </div>
                        )}

                        {q.type === 'conditional' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[color:var(--wm-hairline)]">
                            <div>
                              <label className="text-[color:var(--wm-ink-muted)]">
                                Trigger Question
                              </label>
                              <select
                                value={q.conditionalParentId ?? ''}
                                onChange={(e) =>
                                  updateQuestion(q.id, {
                                    conditionalParentId: e.target.value || null,
                                  })
                                }
                                className="mt-1 h-8 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[color:var(--wm-ink)]"
                              >
                                <option value="">Select parent question...</option>
                                {draft.questions
                                  .filter((other) => other.id !== q.id)
                                  .map((other) => (
                                    <option key={other.id} value={other.id}>
                                      {other.label}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[color:var(--wm-ink-muted)]">
                                Show When Value Matches
                              </label>
                              <input
                                type="text"
                                value={q.conditionalExpectedValue ?? ''}
                                onChange={(e) =>
                                  updateQuestion(q.id, {
                                    conditionalExpectedValue: e.target.value || null,
                                  })
                                }
                                placeholder="e.g. Chair"
                                className="mt-1 h-8 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[color:var(--wm-ink)]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  <div className="border-b border-[color:var(--wm-hairline)] pb-4">
                    <p className="wm-section-kicker text-[color:var(--wm-accent)]">
                      Applicant Form Preview ({draft.category})
                    </p>
                    <h3 className="mt-1 font-serif text-2xl font-medium text-[color:var(--wm-ink)]">
                      {draft.title}
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                      {draft.description}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {draft.questions.map((q) => {
                      if (
                        q.type === 'conditional' &&
                        q.conditionalParentId &&
                        previewValues[q.conditionalParentId] !== q.conditionalExpectedValue
                      ) {
                        return (
                          <div
                            key={q.id}
                            className="rounded border border-dashed border-[color:var(--wm-hairline)] p-3 text-[11px] text-[color:var(--wm-ink-muted)]"
                          >
                            Conditional field hidden until parent equals &ldquo;
                            {q.conditionalExpectedValue}&rdquo;.
                          </div>
                        );
                      }
                      return (
                        <div key={q.id} className="space-y-1.5 text-xs">
                          <label className="block font-medium text-[color:var(--wm-ink)]">
                            {q.label}{' '}
                            {q.required && <span className="text-rose-300">*</span>}
                          </label>
                          {q.helpText && (
                            <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                              {q.helpText}
                            </p>
                          )}
                          {q.type === 'long_text' || q.type === 'conditional' ? (
                            <textarea
                              rows={3}
                              value={previewValues[q.id] ?? ''}
                              onChange={(e) =>
                                setPreviewValues((p) => ({ ...p, [q.id]: e.target.value }))
                              }
                              className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
                            />
                          ) : q.type === 'dropdown' || q.type === 'multiple_choice' ? (
                            <select
                              value={previewValues[q.id] ?? ''}
                              onChange={(e) =>
                                setPreviewValues((p) => ({ ...p, [q.id]: e.target.value }))
                              }
                              className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                            >
                              <option value="">Select an option...</option>
                              {q.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : q.type === 'file_upload' ? (
                            <div className="rounded border border-dashed border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-3 text-[color:var(--wm-ink-secondary)]">
                              Upload field (.pdf, .jpg, .png up to 10MB)
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={previewValues[q.id] ?? ''}
                              onChange={(e) =>
                                setPreviewValues((p) => ({ ...p, [q.id]: e.target.value }))
                              }
                              className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="wm-surface-panel p-8 text-center text-sm text-[color:var(--wm-ink-muted)]">
              Select or create an application form.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
