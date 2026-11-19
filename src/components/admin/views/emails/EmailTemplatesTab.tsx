import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, PenLine, RotateCcw, Save } from 'lucide-react';
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_PLACEHOLDERS,
  renderEmailPreview,
} from './sampleData';
import type {
  EmailApplicantRecord,
  EmailDecisionType,
  EmailTemplateRecord,
} from './types';

interface EmailTemplatesTabProps {
  templates: Record<EmailDecisionType, EmailTemplateRecord>;
  applicants: EmailApplicantRecord[];
  onSaveTemplate: (key: EmailDecisionType, subject: string, body: string) => void;
  onResetTemplate: (key: EmailDecisionType) => void;
}

export function EmailTemplatesTab({
  templates,
  applicants,
  onSaveTemplate,
  onResetTemplate,
}: EmailTemplatesTabProps) {
  const [activeKey, setActiveKey] = useState<EmailDecisionType>('accepted');
  const currentSaved = templates[activeKey];

  const [subject, setSubject] = useState(currentSaved.subject);
  const [body, setBody] = useState(currentSaved.body);
  const [previewMode, setPreviewMode] = useState<'rendered' | 'editable'>('rendered');
  const [previewApplicantId, setPreviewApplicantId] = useState<string>(
    applicants[0]?.id ?? '',
  );
  const [editablePreviewSubject, setEditablePreviewSubject] = useState('');
  const [editablePreviewBody, setEditablePreviewBody] = useState('');

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setSubject(currentSaved.subject);
    setBody(currentSaved.body);
  }, [activeKey, currentSaved.subject, currentSaved.body]);

  const previewApplicants = useMemo(() => {
    const matching = applicants.filter((a) => a.applicationStatus === activeKey);
    return matching.length > 0 ? matching : applicants;
  }, [applicants, activeKey]);

  const previewApplicant = useMemo(
    () =>
      previewApplicants.find((a) => a.id === previewApplicantId) ??
      previewApplicants[0] ??
      applicants[0],
    [previewApplicants, previewApplicantId, applicants],
  );

  const renderedSubject = useMemo(
    () =>
      previewApplicant
        ? renderEmailPreview(subject, previewApplicant, activeKey)
        : subject,
    [subject, previewApplicant, activeKey],
  );

  const renderedBody = useMemo(
    () =>
      previewApplicant
        ? renderEmailPreview(body, previewApplicant, activeKey)
        : body,
    [body, previewApplicant, activeKey],
  );

  useEffect(() => {
    setEditablePreviewSubject(renderedSubject);
    setEditablePreviewBody(renderedBody);
  }, [renderedSubject, renderedBody]);

  const insertPlaceholder = (token: string) => {
    const el = bodyRef.current;
    if (!el) {
      setBody((prev) => (prev ? `${prev} ${token}` : token));
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    setBody(next);
    window.requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleReset = () => {
    const fallback = DEFAULT_EMAIL_TEMPLATES[activeKey];
    setSubject(fallback.subject);
    setBody(fallback.body);
    onResetTemplate(activeKey);
  };

  const hasUnsavedChanges =
    subject !== currentSaved.subject || body !== currentSaved.body;

  return (
    <div className="space-y-4">
      {/* Template Type Selector Bar */}
      <div className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {(['accepted', 'rejected'] as const).map((key) => {
            const active = activeKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveKey(key)}
                className={`h-8 rounded-md px-3.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[color:var(--wm-focal)] font-semibold text-[#12170c]'
                    : 'border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                }`}
              >
                {key === 'accepted' ? 'Acceptance Email' : 'Rejection Email'}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset to Default</span>
          </button>

          <button
            type="button"
            disabled={!subject.trim() || !body.trim() || !hasUnsavedChanges}
            onClick={() => onSaveTemplate(activeKey, subject, body)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-3.5 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Save Template Draft</span>
          </button>
        </div>
      </div>

      {/* Editor + Live / Editable Preview Split */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 items-start">
        {/* Left: Template Editor + Placeholders */}
        <section className="xl:col-span-7 wm-surface-panel p-5 space-y-4">
          <div className="border-b border-[color:var(--wm-hairline)] pb-3">
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              {activeKey === 'accepted' ? 'Acceptance Template Editor' : 'Rejection Template Editor'}
            </h2>
            <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
              Edit subject and message body. Click any placeholder below to insert it into the message.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="template-subject-input"
                className="block text-[11px] font-medium text-[color:var(--wm-ink-secondary)]"
              >
                Email Subject
              </label>
              <input
                id="template-subject-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)]"
              />
            </div>

            <div>
              <label
                htmlFor="template-body-input"
                className="block text-[11px] font-medium text-[color:var(--wm-ink-secondary)]"
              >
                Email Body
              </label>
              <textarea
                id="template-body-input"
                ref={bodyRef}
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-3 text-xs leading-relaxed text-[color:var(--wm-ink)]"
              />
            </div>
          </div>

          {/* Placeholder Reference Panel */}
          <div className="rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]/70 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[color:var(--wm-ink)]">
                Placeholder Reference Panel
              </p>
              <span className="text-[10px] text-[color:var(--wm-ink-muted)]">
                Click a token to insert
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EMAIL_TEMPLATE_PLACEHOLDERS.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => insertPlaceholder(item.token)}
                  className="flex items-start justify-between gap-2 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)]/70 px-3 py-2 text-left hover:border-[color:var(--wm-accent)]/50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <code className="block font-mono text-[11px] text-[color:var(--wm-focal)]">
                      {item.token}
                    </code>
                    <span className="mt-0.5 block text-[10px] text-[color:var(--wm-ink-muted)] leading-snug">
                      {item.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Preview Mode + Editable Preview */}
        <section className="xl:col-span-5 wm-surface-panel overflow-hidden">
          <div className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-5 py-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">Email Preview</h3>
              <div
                role="tablist"
                aria-label="Preview mode"
                className="inline-flex rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-0.5 text-[11px]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === 'rendered'}
                  onClick={() => setPreviewMode('rendered')}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 cursor-pointer ${
                    previewMode === 'rendered'
                      ? 'bg-[#2d6a4f]/45 text-[color:var(--wm-ink)] font-medium'
                      : 'text-[color:var(--wm-ink-muted)]'
                  }`}
                >
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewMode === 'editable'}
                  onClick={() => setPreviewMode('editable')}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 cursor-pointer ${
                    previewMode === 'editable'
                      ? 'bg-[#2d6a4f]/45 text-[color:var(--wm-ink)] font-medium'
                      : 'text-[color:var(--wm-ink-muted)]'
                  }`}
                >
                  <PenLine className="h-3 w-3" aria-hidden="true" />
                  <span>Editable Preview</span>
                </button>
              </div>
            </div>

            {previewApplicant && (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <label
                  htmlFor="template-preview-applicant"
                  className="text-[color:var(--wm-ink-muted)] whitespace-nowrap"
                >
                  Sample recipient:
                </label>
                <select
                  id="template-preview-applicant"
                  value={previewApplicant.id}
                  onChange={(e) => setPreviewApplicantId(e.target.value)}
                  className="h-8 flex-1 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[11px] text-[color:var(--wm-ink)]"
                >
                  {previewApplicants.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.applicantName} ({app.department})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="p-5 space-y-4 text-xs">
            {previewMode === 'rendered' ? (
              <>
                <div className="border-b border-[color:var(--wm-hairline)] pb-3 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
                    Subject
                  </p>
                  <p className="text-sm font-semibold text-[color:var(--wm-ink)]">
                    {renderedSubject}
                  </p>
                  {previewApplicant && (
                    <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                      To: {previewApplicant.applicantName} &lt;{previewApplicant.email}&gt;
                    </p>
                  )}
                </div>
                <div className="whitespace-pre-wrap rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)]/70 p-4 leading-relaxed text-[color:var(--wm-ink-secondary)]">
                  {renderedBody}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                  Inspect or fine-tune how this specific rendered preview reads before copying or staging.
                </p>
                <div>
                  <label
                    htmlFor="editable-preview-subject"
                    className="block text-[11px] text-[color:var(--wm-ink-secondary)]"
                  >
                    Preview Subject
                  </label>
                  <input
                    id="editable-preview-subject"
                    type="text"
                    value={editablePreviewSubject}
                    onChange={(e) => setEditablePreviewSubject(e.target.value)}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editable-preview-body"
                    className="block text-[11px] text-[color:var(--wm-ink-secondary)]"
                  >
                    Preview Body
                  </label>
                  <textarea
                    id="editable-preview-body"
                    rows={11}
                    value={editablePreviewBody}
                    onChange={(e) => setEditablePreviewBody(e.target.value)}
                    className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-3 text-xs leading-relaxed text-[color:var(--wm-ink)]"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
