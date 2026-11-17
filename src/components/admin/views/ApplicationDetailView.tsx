import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Calendar,
  Copy,
  FileText,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageSquarePlus,
  Phone,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type {
  Application,
  ApplicationStatus,
  RecommendationDecision,
  UploadedDocument,
} from '../../../types/admin';
import {
  canAccessApplication,
  canReviewFinalDecision,
  canSubmitRecommendation,
  canViewConfidentialApplicantInfo,
  getRoleLabel,
  hasPermission,
} from '../../../utils/adminPermissions';
import { ConfirmDialog } from '../ConfirmDialog';
import { RecommendationBadge, RoleBadge, StatusBadge } from '../StatusBadge';

interface ApplicationDetailViewProps {
  application: Application | undefined;
  onClose: () => void;
  onPrepareEmail?: (applicationId: string) => void;
  isStandaloneRoute?: boolean;
  actingUserOverride?: ReturnType<typeof useAdminStore>['testModeHeadUser'];
}

const FINAL_STATUSES: Array<{ value: ApplicationStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export function ApplicationDetailView({
  application,
  onClose,
  onPrepareEmail,
  isStandaloneRoute = false,
  actingUserOverride = null,
}: ApplicationDetailViewProps) {
  const {
    currentUser,
    data,
    pushToast,
    updateApplicationStatus,
    submitHeadRecommendation,
    addApplicationNote,
    generateSignupLink,
    revokeSignupLink,
    recordSecurityViolation,
  } = useAdminStore();

  const effectiveActor = actingUserOverride ?? currentUser;

  const [noteInput, setNoteInput] = useState('');
  const [headRecNote, setHeadRecNote] = useState(application?.headNotes ?? '');
  const [finalNoteInput, setFinalNoteInput] = useState(application?.adminDecisionNotes ?? '');
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ApplicationStatus | null>(null);
  const loggedAppViolationRef = useRef<string | null>(null);

  useEffect(() => {
    setHeadRecNote(application?.headNotes ?? '');
    setFinalNoteInput(application?.adminDecisionNotes ?? '');
  }, [application?.id, application?.headNotes, application?.adminDecisionNotes]);

  const isUnauthorizedApp = Boolean(application && !canAccessApplication(effectiveActor, application));

  useEffect(() => {
    if (isUnauthorizedApp && application && effectiveActor) {
      const key = `${effectiveActor.id}:${application.id}`;
      if (loggedAppViolationRef.current === key) return;
      loggedAppViolationRef.current = key;
      recordSecurityViolation(
        'application_route',
        application.id,
        `Blocked unauthorized access to application ${application.applicationCode} (${application.departmentId}).`,
      );
    } else {
      loggedAppViolationRef.current = null;
    }
  }, [application, effectiveActor, isUnauthorizedApp, recordSecurityViolation]);

  if (!application) {
    return (
      <div className="wm-surface-panel p-8 text-center">
        <p className="text-base font-semibold text-[color:var(--wm-ink)]">Application Not Found</p>
        <p className="mt-1 text-sm text-[color:var(--wm-ink-secondary)]">
          The requested application ID does not exist in the conference database.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Applications
        </button>
      </div>
    );
  }

  if (!canAccessApplication(effectiveActor, application)) {
    return (
      <div
        role="alert"
        className="rounded-md border border-rose-400/35 bg-rose-500/[0.08] p-8 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/35 bg-rose-500/15 text-rose-200">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-rose-100">Department Access Restricted</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--wm-ink-secondary)]">
          Security isolation prevents viewing applications outside your assigned department.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex min-h-[38px] items-center gap-2 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to My Department Queue
        </button>
      </div>
    );
  }

  const department = data.departments.find((d) => d.id === application.departmentId);
  const canViewConfidential = canViewConfidentialApplicantInfo(effectiveActor, application);
  const canDoFinalDecision = canReviewFinalDecision(effectiveActor, application);
  const canRecommend = canSubmitRecommendation(effectiveActor, application);
  const canAddNotes = hasPermission(effectiveActor, 'applications.notes');
  const canManageLinks =
    hasPermission(effectiveActor, 'applications.signup_links') &&
    effectiveActor?.role !== 'department_head';

  const handleNoteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    if (addApplicationNote(application.id, noteInput)) setNoteInput('');
  };

  const handleRecommend = (decision: RecommendationDecision) => {
    submitHeadRecommendation(application.id, decision, headRecNote);
  };

  const handleCopySignupLink = () => {
    if (!application.signupLinkToken) return;
    const url = `${window.location.origin}/portal?invite=${application.signupLinkToken}`;
    navigator.clipboard?.writeText(url).catch(() => undefined);
    pushToast({
      tone: 'success',
      title: 'Signup link copied',
      description: url,
    });
  };

  const handleConfirmFinalStatus = () => {
    if (!pendingStatus) return;
    updateApplicationStatus(application.id, pendingStatus, finalNoteInput);
    setPendingStatus(null);
  };

  return (
    <div className="space-y-6">
      {/* Editorial Dossier Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--wm-hairline)] pb-5">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer shrink-0 transition-colors duration-150"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>{isStandaloneRoute ? 'Back to List' : 'Close'}</span>
          </button>

          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--wm-accent)]">
              {application.applicationCode} · {application.category}
            </p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[color:var(--wm-ink)]">
              {application.applicantName}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-[color:var(--wm-ink-secondary)]">
              {department?.name ?? application.departmentId} · {application.position}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={application.status} />
          <RecommendationBadge decision={application.headRecommendation} />
          {onPrepareEmail && effectiveActor?.role !== 'department_head' && (
            <button
              type="button"
              onClick={() => onPrepareEmail(application.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
            >
              <Mail className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <span>Email Applicant</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Editorial Dossier Split: Reading Column (8 cols) | Evaluation Sidebar (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Identity Dossier */}
          <section className="wm-surface-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)]">
              <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Applicant Dossier
              </h3>
            </div>
            {canViewConfidential ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-[color:var(--wm-hairline)] text-xs">
                <div className="flex items-start gap-3 p-4 sm:border-b sm:border-r border-[color:var(--wm-hairline)]">
                  <Mail className="h-4 w-4 text-[color:var(--wm-accent)] mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="wm-section-kicker">Email Address</dt>
                    <dd className="mt-1 font-mono text-xs text-[color:var(--wm-ink)] break-all">
                      {application.email}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 sm:border-b border-[color:var(--wm-hairline)]">
                  <Phone className="h-4 w-4 text-[color:var(--wm-accent)] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <dt className="wm-section-kicker">Phone Number</dt>
                    <dd className="mt-1 font-mono text-xs text-[color:var(--wm-ink)] tabular-nums">
                      {application.phone}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 sm:border-b sm:border-r border-[color:var(--wm-hairline)]">
                  <User className="h-4 w-4 text-[color:var(--wm-accent)] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <dt className="wm-section-kicker">Institution & Standing</dt>
                    <dd className="mt-1 font-medium text-[color:var(--wm-ink)]">
                      {application.schoolOrUniversity} · {application.gradeOrYear} (Age{' '}
                      {application.age})
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 sm:border-b border-[color:var(--wm-hairline)]">
                  <MapPin className="h-4 w-4 text-[color:var(--wm-accent)] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <dt className="wm-section-kicker">Location & Experience</dt>
                    <dd className="mt-1 font-medium text-[color:var(--wm-ink)]">
                      {application.city}, {application.country} · {application.experienceLevel}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 sm:col-span-2">
                  <Calendar className="h-4 w-4 text-[color:var(--wm-accent)] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <dt className="wm-section-kicker">Emergency Contact & Submission Timestamp</dt>
                    <dd className="mt-1 font-medium text-[color:var(--wm-ink)]">
                      {application.emergencyContact} · Submitted{' '}
                      <span className="font-mono text-[color:var(--wm-ink-secondary)]">
                        {new Date(application.submittedAt).toLocaleString()}
                      </span>
                    </dd>
                  </div>
                </div>
              </dl>
            ) : (
              <div className="m-5 flex items-center gap-3 rounded border border-amber-400/30 bg-amber-500/[0.08] p-4 text-xs text-amber-100">
                <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Confidential contact fields restricted by your permission profile.</span>
              </div>
            )}
          </section>

          {/* Submitted Responses (Rule-divided editorial Q&A without nested boxes) */}
          <section className="wm-surface-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)]">
              <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Submitted Responses
              </h3>
            </div>
            {application.answers.length === 0 ? (
              <p className="p-5 text-xs text-[color:var(--wm-ink-muted)]">
                Standard profile and departmental track metadata recorded above.
              </p>
            ) : (
              <div className="divide-y divide-[color:var(--wm-hairline)]">
                {application.answers.map((ans) => (
                  <div key={ans.questionId} className="p-5 space-y-1.5">
                    <p className="wm-section-kicker text-[color:var(--wm-accent)]">{ans.section}</p>
                    <p className="text-xs font-semibold text-[color:var(--wm-ink)]">{ans.label}</p>
                    <p className="pt-1 text-sm leading-relaxed text-[color:var(--wm-ink-secondary)]">
                      {ans.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Uploaded Documents & Portfolios */}
          <section className="wm-surface-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)]">
              <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Uploaded Documents & Portfolios
              </h3>
            </div>
            {application.documents.length === 0 ? (
              <p className="p-5 text-xs text-[color:var(--wm-ink-muted)]">
                No attached documents on this record.
              </p>
            ) : (
              <div className="divide-y divide-[color:var(--wm-hairline)]">
                {application.documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-[#ede6ca]/[0.03] transition-colors duration-150 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText
                        className="h-4 w-4 shrink-0 text-[color:var(--wm-accent)]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[color:var(--wm-ink)] truncate">
                          {doc.name}
                        </p>
                        <p className="font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                          {doc.category.toUpperCase()} · {doc.sizeLabel}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[color:var(--wm-accent)]">
                      Preview
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sticky Evaluation & Decision Column */}
        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">
          {/* Stage 1 Recommendation */}
          <section className="wm-surface-panel p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[color:var(--wm-hairline)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wm-accent)]">
                Stage 1 · Dept Recommendation
              </p>
              <RecommendationBadge decision={application.headRecommendation} />
            </div>

            {application.recommendedBy && (
              <p className="text-xs text-[color:var(--wm-ink-secondary)]">
                Reviewed by <strong className="text-[color:var(--wm-ink)]">{application.recommendedBy}</strong>{' '}
                on{' '}
                <span className="font-mono">
                  {new Date(application.recommendedAt ?? application.updatedAt).toLocaleDateString()}
                </span>
              </p>
            )}

            {canRecommend ? (
              <div className="space-y-2.5">
                <textarea
                  rows={2}
                  value={headRecNote}
                  onChange={(e) => setHeadRecNote(e.target.value)}
                  placeholder="Department Head rationale for Stage 2 leadership..."
                  className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]/60 focus:border-[color:var(--wm-focal)] focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRecommend('recommend_accept')}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-emerald-400/35 bg-emerald-500/15 px-3 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 cursor-pointer"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Recommend Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecommend('recommend_reject')}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-rose-400/35 bg-rose-500/15 px-3 text-xs font-medium text-rose-100 hover:bg-rose-500/25 cursor-pointer"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Recommend Reject</span>
                  </button>
                  {application.headRecommendation !== 'none' && (
                    <button
                      type="button"
                      onClick={() => handleRecommend('none')}
                      className="h-8 rounded px-2.5 text-xs text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ) : (
              application.headNotes && (
                <p className="border-l-2 border-[color:var(--wm-accent)] pl-3 text-xs text-[color:var(--wm-ink-secondary)]">
                  {application.headNotes}
                </p>
              )
            )}
          </section>

          {/* Stage 2 Final Administrative Decision */}
          <section className="wm-surface-panel p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[color:var(--wm-hairline)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wm-ink)]">
                Stage 2 · Final Decision
              </p>
              <StatusBadge status={application.status} />
            </div>

            {canDoFinalDecision ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={finalNoteInput}
                  onChange={(e) => setFinalNoteInput(e.target.value)}
                  placeholder="Final administrative decision note..."
                  className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]/60 focus:border-[color:var(--wm-focal)] focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  {FINAL_STATUSES.map((st) => {
                    const isCurrent = application.status === st.value;
                    return (
                      <button
                        key={st.value}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => {
                          if (st.value === 'rejected' || st.value === 'withdrawn') {
                            setPendingStatus(st.value);
                          } else {
                            updateApplicationStatus(application.id, st.value, finalNoteInput);
                          }
                        }}
                        className={`h-8 rounded border px-3 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                          isCurrent
                            ? 'border-[color:var(--wm-focal)] bg-[color:var(--wm-focal)] text-[#12170c]'
                            : 'border-[color:var(--wm-hairline-strong)] bg-transparent text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[color:var(--wm-ink-muted)]">
                Stage 2 final acceptance or rejection is restricted to Super Admin or Admin leadership.
              </p>
            )}

            {application.status === 'accepted' && canManageLinks && (
              <div className="border-t border-[color:var(--wm-hairline)] pt-3 space-y-2">
                <p className="text-[11px] font-semibold text-emerald-200 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Signup Invite ({application.signupLinkStatus.toUpperCase()})</span>
                </p>
                <p className="font-mono text-[11px] text-[color:var(--wm-ink)] break-all">
                  {application.signupLinkToken ?? 'Not generated yet'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {application.signupLinkToken && application.signupLinkStatus === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={handleCopySignupLink}
                        className="inline-flex h-7 items-center gap-1 rounded bg-[color:var(--wm-focal)] px-2.5 text-[11px] font-semibold text-[#12170c] cursor-pointer"
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeSignupLink(application.id)}
                        className="h-7 rounded border border-rose-400/35 px-2.5 text-[11px] text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                      >
                        Revoke
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => generateSignupLink(application.id)}
                    className="h-7 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                  >
                    {application.signupLinkToken ? 'Regenerate' : 'Generate Link'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Internal Evaluation Notes */}
          <section className="wm-surface-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)]">
              <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Internal Evaluation Notes ({application.notes.length})
              </h3>
            </div>
            {canAddNotes && (
              <form
                onSubmit={handleNoteSubmit}
                className="p-4 border-b border-[color:var(--wm-hairline)] space-y-2"
              >
                <textarea
                  rows={2}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Record confidential evaluation observation..."
                  className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]/60 focus:border-[color:var(--wm-focal)] focus:outline-none resize-y"
                />
                <button
                  type="submit"
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Save Evaluation Note</span>
                </button>
              </form>
            )}
            <div className="divide-y divide-[color:var(--wm-hairline)] max-h-64 overflow-y-auto">
              {application.notes.length === 0 ? (
                <p className="p-4 text-xs text-[color:var(--wm-ink-muted)]">No notes recorded yet.</p>
              ) : (
                application.notes.map((n) => (
                  <div key={n.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[color:var(--wm-ink)]">
                        {n.authorName}
                      </span>
                      <RoleBadge role={n.authorRole} />
                    </div>
                    <p className="text-xs text-[color:var(--wm-ink-secondary)] leading-relaxed">
                      {n.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Processing Timeline */}
          <section className="wm-surface-panel p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[color:var(--wm-ink)] pb-2.5 border-b border-[color:var(--wm-hairline)]">
              Processing Timeline
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {application.history.map((item) => (
                <div
                  key={item.id}
                  className="border-l-2 border-[color:var(--wm-accent)]/40 pl-3 space-y-0.5"
                >
                  <p className="text-xs font-medium text-[color:var(--wm-ink)]">{item.summary}</p>
                  <p className="text-[11px] text-[color:var(--wm-ink-secondary)]">
                    {item.actorName} ({getRoleLabel(item.actorRole)})
                  </p>
                  <p className="font-mono text-[10px] text-[color:var(--wm-ink-muted)] tabular-nums">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {previewDoc && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
        >
          <div className="w-full max-w-2xl rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--wm-ink)]">
                  {previewDoc.name}
                </p>
                <p className="font-mono text-xs text-[color:var(--wm-ink-muted)]">
                  {previewDoc.fileType} · {previewDoc.sizeLabel}
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
              <img src={previewDoc.previewUrl} alt={previewDoc.name} className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingStatus !== null}
        title={`Confirm ${pendingStatus?.toUpperCase()} Decision`}
        description={`Are you sure you want to mark ${application.applicantName} (${application.applicationCode}) as ${pendingStatus}?`}
        confirmLabel={`Mark ${pendingStatus ?? ''}`}
        tone="danger"
        onConfirm={handleConfirmFinalStatus}
        onCancel={() => setPendingStatus(null)}
      />
    </div>
  );
}
