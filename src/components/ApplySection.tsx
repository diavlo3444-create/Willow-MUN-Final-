import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const TRACK_DEPARTMENT_SLUG: Record<string, string> = { media: 'media', press: 'press', volunteer: 'volunteers', security: 'security' };
import {
  ATTENDANCE_QUESTION_LABEL,
  GRADE_OPTIONS,
  PUBLIC_APPLICATION_TRACKS,
  buildLegacySafeExperienceField,
  buildStructuredAnswers,
  createEmptyDraft,
  getResolvedPhones,
  getRoleQuestionsForTrack,
  validateAllSteps,
  validateStep,
  type ApplicationTrack,
  type FieldErrors,
  type TrackDraft,
  type UploadedApplicationFile,
} from '../utils/applicationForm';
import { ApplicationFileUploader } from './ApplicationFileUploader';
import { CountryPhoneInput } from './CountryPhoneInput';
import { RevealItem } from './MotionPrimitives';
import { RevealSection, SectionHeading } from './RevealSection';

interface TrackConfig {
  id: ApplicationTrack;
  index: string;
  title: string;
  wing: string;
  detail: string;
  deliverable: string;
}

const TRACKS: readonly TrackConfig[] = [
  {
    id: 'media',
    index: '01',
    title: 'Media',
    wing: 'Communications & Creative',
    detail:
      'Photography, videography, committee reels, and visual storytelling across every session of the conference.',
    deliverable: 'Camera gear details, 10–15 sample photographs & 5 role questions',
  },
  {
    id: 'press',
    index: '02',
    title: 'Press',
    wing: 'Communications & Creative',
    detail:
      'Committee reporting, delegate and chair interviews, diplomatic articles, and timely conference dispatches.',
    deliverable: 'Optional writing samples & 5 editorial reporting questions',
  },
  {
    id: 'volunteer',
    index: '03',
    title: 'Volunteers',
    wing: 'Delegate Affairs & Operations',
    detail:
      'Delegate reception, floor logistics, wayfinding, policy adherence, and calm coordination throughout the venue.',
    deliverable: 'Experience overview & 5 operational scenario questions',
  },
  {
    id: 'security',
    index: '04',
    title: 'Security',
    wing: 'Delegate Affairs & Operations',
    detail: 'Venue safety, access checks, responsibility, and clear communication.',
    deliverable: 'Experience summary and proof, plus 3 written questions and two yes/no disclosures',
  },
] as const;

const STEPS = [
  { id: 1 as const, num: '01', label: 'Personal Information', shortLabel: 'Personal' },
  { id: 2 as const, num: '02', label: 'Experience', shortLabel: 'Experience' },
  { id: 3 as const, num: '03', label: 'Role Questions', shortLabel: 'Questions' },
  { id: 4 as const, num: '04', label: 'Review & Submit', shortLabel: 'Review' },
];

const DRAFT_STORAGE_KEY = 'willow_mun_apply_draft_v2';
const SUBMITTED_STORAGE_KEY = 'willow_mun_submitted_pairs_v1';
const DRAFT_SESSION_KEY = 'willow_mun_upload_session_v1';

type DraftMap = Record<ApplicationTrack, TrackDraft>;

interface SubmittedReceipt {
  id: string;
  track: ApplicationTrack;
  trackTitle: string;
  applicantName: string;
  email: string;
  gender: 'male' | 'female';
  createdAt: string;
}

function createInitialDraftMap(): DraftMap {
  return {
    media: createEmptyDraft(),
    press: createEmptyDraft(),
    volunteer: createEmptyDraft(),
    security: createEmptyDraft(),
  };
}

function getOrCreateDraftSessionId(): string {
  if (typeof window === 'undefined') return `sess-${Date.now()}`;
  try {
    const existing = window.sessionStorage.getItem(DRAFT_SESSION_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(DRAFT_SESSION_KEY, created);
    return created;
  } catch {
    return `sess-${Date.now()}`;
  }
}

function sanitizeRestoredFiles(raw: unknown): UploadedApplicationFile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is UploadedApplicationFile => Boolean(f && typeof f === 'object' && f.id))
    .filter((f) => f.uploadStatus === 'uploaded' || f.uploadStatus === 'fallback_inline')
    .map((f) => ({
      ...f,
      // blob: URLs do not survive full page reloads cleanly; avoid broken preview links
      previewUrl:
        f.previewUrl && f.previewUrl.startsWith('blob:') ? undefined : f.previewUrl,
    }));
}

function loadStoredDrafts(): { drafts: DraftMap; activeTrack: ApplicationTrack } {
  const fallback = { drafts: createInitialDraftMap(), activeTrack: 'media' as ApplicationTrack };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as {
      activeTrack?: ApplicationTrack;
      drafts?: Partial<Record<ApplicationTrack, Partial<TrackDraft>>>;
    };
    const drafts = createInitialDraftMap();
    (Object.keys(drafts) as ApplicationTrack[]).forEach((t) => {
      const saved = parsed.drafts?.[t];
      if (saved && typeof saved === 'object') {
        drafts[t] = {
          ...createEmptyDraft(),
          ...saved,
          proofFiles: sanitizeRestoredFiles(saved.proofFiles),
          mediaPhotos: sanitizeRestoredFiles(saved.mediaPhotos),
          writingSamples: sanitizeRestoredFiles(saved.writingSamples),
          roleAnswers:
            saved.roleAnswers && typeof saved.roleAnswers === 'object'
              ? saved.roleAnswers
              : {},
        };
      }
    });
    const activeTrack =
      parsed.activeTrack && PUBLIC_APPLICATION_TRACKS.includes(parsed.activeTrack)
        ? parsed.activeTrack
        : 'media';
    return { drafts, activeTrack };
  } catch {
    return fallback;
  }
}

function loadSubmittedPairs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(SUBMITTED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function toSubmitFileMetadata(files: UploadedApplicationFile[]) {
  return files
    .filter((f) => f.uploadStatus === 'uploaded' || Boolean(f.storagePath))
    .map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      fileType: f.fileType,
      sizeBytes: f.sizeBytes,
      sizeLabel: f.sizeLabel,
      storageBucket: f.storageBucket || 'wm-application-files',
      storagePath: f.storagePath,
      uploadedAt: f.uploadedAt,
    }));
}

/**
 * Editorial Organizing-Team Application Desk + Smooth 4-Step Animated Modal Dossier
 * for Media, Press, and Volunteers.
 */
export function ApplySection() {
  const initialStored = useMemo(() => loadStoredDrafts(), []);
  const draftSessionId = useMemo(() => getOrCreateDraftSessionId(), []);
  const [selectedTrack, setSelectedTrack] = useState<ApplicationTrack>(initialStored.activeTrack);
  const [drafts, setDrafts] = useState<DraftMap>(initialStored.drafts);

  const [modalOpen, setModalOpen] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [highestStep, setHighestStep] = useState<1 | 2 | 3 | 4>(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);
  const [submittedPairs, setSubmittedPairs] = useState<string[]>(() => loadSubmittedPairs());
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<Record<string, boolean>>({});
  const [registrationStatusLoaded, setRegistrationStatusLoaded] = useState(false);

  const inFlightRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const loadRegistrationStatus = async () => {
      const { data, error } = await supabase
        .from('wm_departments')
        .select('slug,registration_open')
        .in('slug', ['media', 'press', 'volunteers', 'security']);
      if (!active) return;
      if (!error && data) {
        const next: Record<string, boolean> = {};
        for (const row of data) next[row.slug] = row.registration_open === true;
        setRegistrationStatus(next);
      }
      setRegistrationStatusLoaded(true);
    };
    void loadRegistrationStatus();
    const refreshId = window.setInterval(() => void loadRegistrationStatus(), 30000);
    return () => { active = false; window.clearInterval(refreshId); };
  }, []);

  // Persist non-medical draft progress locally across reloads (avoid keeping sensitive medical text unencrypted if preferred, or keep in sessionStorage only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const serializableDrafts = {} as Record<ApplicationTrack, Partial<TrackDraft>>;
      (Object.keys(drafts) as ApplicationTrack[]).forEach((t) => {
        const d = drafts[t];
        const compactFiles = (list: UploadedApplicationFile[]) =>
          list.map((f) => ({
            ...f,
            // Don't bloat sessionStorage with large inline data URLs
            previewUrl:
              f.previewUrl && f.previewUrl.startsWith('data:') && f.previewUrl.length > 4000
                ? undefined
                : f.previewUrl && f.previewUrl.startsWith('blob:')
                  ? undefined
                  : f.previewUrl,
          }));
        serializableDrafts[t] = {
          ...d,
          proofFiles: compactFiles(d.proofFiles),
          mediaPhotos: compactFiles(d.mediaPhotos),
          writingSamples: compactFiles(d.writingSamples),
        };
      });
      window.sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ activeTrack: selectedTrack, drafts: serializableDrafts }),
      );
    } catch {
      // Ignore storage quota issues
    }
  }, [selectedTrack, drafts]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const currentTrackConfig =
    TRACKS.find((t) => t.id === selectedTrack) ?? TRACKS[0];
  const currentDraft = drafts[selectedTrack];
  const roleQuestions = useMemo(
    () => getRoleQuestionsForTrack(selectedTrack),
    [selectedTrack],
  );

  const normalizedPairKey = useMemo(() => {
    const email = currentDraft.email.trim().toLowerCase();
    return email ? `${selectedTrack}::${email}` : '';
  }, [selectedTrack, currentDraft.email]);

  const hasDuplicateInSession =
    normalizedPairKey !== '' && submittedPairs.includes(normalizedPairKey);

  const scrollBodyTop = () => {
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openModalForTrack = (
    track: ApplicationTrack,
    triggerEl?: HTMLButtonElement | null,
  ) => {
    const departmentSlug = TRACK_DEPARTMENT_SLUG[track];
    if (departmentSlug && (!registrationStatusLoaded || registrationStatus[departmentSlug] !== true)) return;
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (triggerEl) {
      lastTriggerRef.current = triggerEl;
    }
    setSelectedTrack(track);
    setReceipt(null);
    setErrors({});
    setDuplicateConfirmed(false);
    setStep(1);
    setHighestStep(1);
    setIsClosingModal(false);
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    if (!modalOpen || isClosingModal || busy) return;
    setIsClosingModal(true);
    closeTimerRef.current = window.setTimeout(() => {
      setModalOpen(false);
      setIsClosingModal(false);
      closeTimerRef.current = null;
      lastTriggerRef.current?.focus();
    }, 200);
  }, [modalOpen, isClosingModal, busy]);

  useEffect(() => {
    if (!modalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalOpen, closeModal]);

  const updateField = <K extends keyof TrackDraft>(key: K, value: TrackDraft[K]) => {
    setDrafts((prev) => ({
      ...prev,
      [selectedTrack]: {
        ...prev[selectedTrack],
        [key]: value,
      },
    }));
    if (errors[key] || errors.general) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        delete next.general;
        return next;
      });
    }
    if (key === 'email') {
      setDuplicateConfirmed(false);
    }
  };

  const updateFilesField = (
    key: 'proofFiles' | 'mediaPhotos' | 'writingSamples',
    updater: (prev: UploadedApplicationFile[]) => UploadedApplicationFile[],
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [selectedTrack]: {
        ...prev[selectedTrack],
        [key]: updater(prev[selectedTrack][key]),
      },
    }));
    if (errors[key] || errors.general) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        delete next.general;
        return next;
      });
    }
  };

  const updateRoleAnswer = (questionId: string, val: string) => {
    setDrafts((prev) => ({
      ...prev,
      [selectedTrack]: {
        ...prev[selectedTrack],
        roleAnswers: {
          ...prev[selectedTrack].roleAnswers,
          [questionId]: val,
        },
      },
    }));
    const errKey = `role_${questionId}` as const;
    if (errors[errKey] || errors.general) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        delete next.general;
        return next;
      });
    }
  };

  const handleNextStep = () => {
    const stepErrors = validateStep(step, currentDraft, selectedTrack);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      scrollBodyTop();
      return;
    }
    setErrors({});
    const nextStep = Math.min(4, step + 1) as 1 | 2 | 3 | 4;
    setStep(nextStep);
    setHighestStep((prev) => (nextStep > prev ? nextStep : prev));
    scrollBodyTop();
  };

  const handleJumpStep = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep === step) return;
    if (targetStep < step || targetStep <= highestStep) {
      setErrors({});
      setStep(targetStep);
      scrollBodyTop();
      return;
    }
    // Validate sequential steps up to target
    for (let s = step; s < targetStep; s++) {
      const stepErrs = validateStep(s as 1 | 2 | 3 | 4, currentDraft, selectedTrack);
      if (Object.keys(stepErrs).length > 0) {
        setErrors(stepErrs);
        setStep(s as 1 | 2 | 3 | 4);
        scrollBodyTop();
        return;
      }
    }
    setErrors({});
    setStep(targetStep);
    setHighestStep((prev) => (targetStep > prev ? targetStep : prev));
    scrollBodyTop();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlightRef.current || busy) return;

    const { firstInvalidStep, errors: allErrors } = validateAllSteps(
      currentDraft,
      selectedTrack,
    );
    if (firstInvalidStep !== null) {
      setErrors(allErrors);
      setStep(firstInvalidStep);
      scrollBodyTop();
      return;
    }

    if (hasDuplicateInSession && !duplicateConfirmed) {
      setDuplicateConfirmed(true);
      setErrors({
        general:
          'You have already submitted an application for this track with this email during this session. Click "Confirm & Submit Again" only if you intend to send an updated dossier.',
      });
      return;
    }

    inFlightRef.current = true;
    setBusy(true);
    setErrors({});

    const { phoneE164, guardianPhoneE164 } = getResolvedPhones(currentDraft);
    const structuredAnswers = buildStructuredAnswers(currentDraft, selectedTrack);
    const primaryMotivation =
      structuredAnswers.find((a) => a.questionId.endsWith('_q1'))?.answer ||
      currentDraft.experience.trim();

    const usesFallbackFiles = [
      ...currentDraft.proofFiles,
      ...currentDraft.mediaPhotos,
      ...currentDraft.writingSamples,
    ].some((f) => f.uploadStatus === 'fallback_inline');

    const safeExperienceValue = usesFallbackFiles
      ? buildLegacySafeExperienceField(currentDraft, selectedTrack)
      : currentDraft.experience.trim();

    const payloadBody = {
      action: 'submit',
      application_type: selectedTrack,
      applicant_name: currentDraft.applicant_name.trim(),
      gender: currentDraft.gender,
      email: currentDraft.email.trim().toLowerCase(),
      phone: phoneE164,
      guardian_phone: guardianPhoneE164,
      grade: currentDraft.grade.trim(),
      school: currentDraft.school.trim(),
      has_medical_condition: currentDraft.hasMedicalCondition === 'yes',
      medical_details:
        currentDraft.hasMedicalCondition === 'yes'
          ? currentDraft.medicalDetails.trim() || null
          : null,
      availability:
        currentDraft.attendsAllDays === 'yes'
          ? 'Both conference days + extra rehearsal day'
          : `Conflict on conference/rehearsal schedule: ${currentDraft.absenceReason.trim()}`,
      attends_all_days: currentDraft.attendsAllDays === 'yes',
      absence_reason:
        currentDraft.attendsAllDays === 'no' ? currentDraft.absenceReason.trim() : null,
      motivation: primaryMotivation,
      experience: safeExperienceValue,
      camera_model: selectedTrack === 'media' ? currentDraft.cameraModel.trim() : null,
      portfolio_url:
        selectedTrack === 'media' || selectedTrack === 'press'
          ? currentDraft.portfolio_url.trim() || null
          : null,
      answers: structuredAnswers,
      proof_files: toSubmitFileMetadata(currentDraft.proofFiles),
      media_photos:
        selectedTrack === 'media' ? toSubmitFileMetadata(currentDraft.mediaPhotos) : [],
      writing_samples:
        selectedTrack === 'press' ? toSubmitFileMetadata(currentDraft.writingSamples) : [],
    };

    try {
      let { data, error: invokeError } = await supabase.functions.invoke('willow-applications', {
        body: payloadBody,
      });

      // Pre-migration fallback retry if remote Edge Function requires clean non-storage experience payload
      if ((invokeError || data?.error) && !usesFallbackFiles) {
        const msg = String(data?.error || invokeError?.message || '').toLowerCase();
        if (msg.includes('column') || msg.includes('schema') || msg.includes('unexpected')) {
          const fallbackBody = {
            ...payloadBody,
            experience: buildLegacySafeExperienceField(currentDraft, selectedTrack),
          };
          const retryRes = await supabase.functions.invoke('willow-applications', {
            body: fallbackBody,
          });
          data = retryRes.data;
          invokeError = retryRes.error;
        }
      }

      if (invokeError || data?.error) {
        const message =
          data?.error ||
          invokeError?.message ||
          'Could not submit application. Please review your details and try again.';
        setErrors({ general: message });
        return;
      }

      const returned = data?.application as
        | {
            id?: string;
            application_type?: string;
            applicant_name?: string;
            gender?: 'male' | 'female';
            created_at?: string;
          }
        | undefined;

      const pair = `${selectedTrack}::${currentDraft.email.trim().toLowerCase()}`;
      setSubmittedPairs((prev) => {
        const updated = prev.includes(pair) ? prev : [...prev, pair];
        try {
          window.sessionStorage.setItem(SUBMITTED_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage quota errors
        }
        return updated;
      });

      setReceipt({
        id: returned?.id || `WM-${Date.now().toString(36).toUpperCase()}`,
        track: selectedTrack,
        trackTitle: currentTrackConfig.title,
        applicantName: returned?.applicant_name || currentDraft.applicant_name.trim(),
        email: currentDraft.email.trim().toLowerCase(),
        gender: (returned?.gender || currentDraft.gender || 'male') as 'male' | 'female',
        createdAt: returned?.created_at || new Date().toISOString(),
      });

      setDrafts((prev) => ({
        ...prev,
        [selectedTrack]: createEmptyDraft(),
      }));
      setDuplicateConfirmed(false);
    } catch (err) {
      setErrors({
        general:
          err instanceof Error
            ? err.message
            : 'Network error while transmitting your dossier. Please try again.',
      });
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const resolvedPhones = getResolvedPhones(currentDraft);
  const structuredPreviewAnswers = buildStructuredAnswers(currentDraft, selectedTrack);

  return (
    <RevealSection id="apply" ariaLabelledBy="apply-heading">
      <div className="mb-8 sm:mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-[#ede6ca]/16 pb-6">
        <SectionHeading
          id="apply-heading"
          indexLabel="06"
          label="Join the organizing team"
          prefix="Team"
          italicWord="Applications"
        />
        <RevealItem staggerIndex={1} className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-sm text-[#c9c2a6] max-w-[44ch]">
            Select Media, Press, or Volunteers below to complete our guided four-step application dossier.
          </p>
          <button
            type="button"
            disabled={registrationStatusLoaded && registrationStatus[TRACK_DEPARTMENT_SLUG[selectedTrack]] === false}
            onClick={(e) => openModalForTrack(selectedTrack, e.currentTarget)}
            className="mun-btn-interactive group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] bg-[#ede6ca] px-5 py-2.5 text-sm font-semibold text-[#181c0d] hover:bg-[#dad3b4] cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Open Application Dossier</span>
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </RevealItem>
      </div>

      {/* Editorial 3-Track Directory (Media, Press, Volunteers) */}
      <RevealItem staggerIndex={2} className="willow-folio rounded-[3px] grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:gap-px bg-[#ede6ca]/14 border border-[#ede6ca]/16 overflow-hidden">
        {TRACKS.map((item) => {
          const draft = drafts[item.id];
          const hasDraft = Boolean(
            draft.applicant_name.trim() ||
              draft.email.trim() ||
              draft.experience.trim() ||
              draft.mediaPhotos.length > 0 ||
              Object.values(draft.roleAnswers).some((v) => v.trim()),
          );

          return (
            <article
              key={item.id}
              className="group bg-[#12160a]/95 p-6 sm:p-8 flex flex-col justify-between gap-6 transition-colors duration-200 hover:bg-[#171c0e]"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs tracking-[0.14em] text-[#a9b47e] tabular-nums">
                    TRACK {item.index} · {item.wing.toUpperCase()}
                  </span>
                  <span className={`font-mono text-[11px] uppercase tracking-[0.12em] ${registrationStatus[TRACK_DEPARTMENT_SLUG[item.id]] === false ? 'text-rose-300' : 'text-[#a9b47e]'}`}>
                    {!registrationStatusLoaded ? 'Checking...' : registrationStatus[TRACK_DEPARTMENT_SLUG[item.id]] === true ? (hasDraft ? 'Draft Saved' : 'Open') : 'Applications Closed'}
                  </span>
                </div>

                <h3 className="font-serif text-3xl sm:text-[34px] font-medium leading-tight text-[#ede6ca]">
                  {item.title}
                </h3>

                <p className="text-sm leading-[1.7] text-[#c9c2a6]">
                  {item.detail}
                </p>
              </div>

              <div className="border-t border-[#ede6ca]/12 pt-4 flex flex-col sm:flex-row lg:flex-col xl:flex-row xl:items-center justify-between gap-4">
                <span className="text-xs text-[#c9c2a6]/85">
                  {item.deliverable}
                </span>

                <button
                  type="button"
                  disabled={!registrationStatusLoaded || registrationStatus[TRACK_DEPARTMENT_SLUG[item.id]] !== true}
                  onClick={(e) => openModalForTrack(item.id, e.currentTarget)}
                  className="mun-btn-interactive inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-[#ede6ca]/32 bg-transparent px-4 py-2 text-xs font-semibold text-[#ede6ca] hover:bg-[#ede6ca] hover:text-[#181c0d] hover:border-[#ede6ca] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>
                    {!registrationStatusLoaded ? 'Checking...' : registrationStatus[TRACK_DEPARTMENT_SLUG[item.id]] !== true ? 'Applications Closed' : hasDraft ? `Resume ${item.title}` : `Apply for ${item.title}`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </RevealItem>

      {/* Animated Guided 4-Step Application Modal */}
      {modalOpen && typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-[4px] p-0 sm:p-5 ${
              isClosingModal ? 'mun-modal-backdrop-out' : 'mun-modal-backdrop-in'
            }`}
            onClick={closeModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="apply-modal-title"
              className={`relative flex w-full sm:max-w-[780px] max-h-[95dvh] sm:max-h-[90dvh] flex-col rounded-t-[6px] sm:rounded-[4px] border border-[#ede6ca]/24 bg-[#12160a] text-[#ede6ca] shadow-2xl overflow-hidden ${
                isClosingModal ? 'mun-modal-panel-out' : 'mun-modal-panel-in'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Sticky Header + 4-Step Progress */}
              <div className="shrink-0 border-b border-[#ede6ca]/16 bg-[#171c0d] px-4 sm:px-7 pt-4 sm:pt-5 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-[#a9b47e]">
                      WILLOW MUN Application Dossier
                    </p>
                    <h3
                      id="apply-modal-title"
                      className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-[#ede6ca] truncate"
                    >
                      {receipt
                        ? `${receipt.trackTitle} Dossier Recorded`
                        : `${currentTrackConfig.title} Application`}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={busy}
                    aria-label="Close application modal"
                    className="mun-btn-interactive inline-flex h-11 w-11 items-center justify-center rounded-[2px] border border-[#ede6ca]/22 text-[#cfc8aa] hover:border-[#ede6ca] hover:text-[#ede6ca] disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {!receipt && (
                  <div className="mt-4 space-y-2.5">
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2" role="tablist" aria-label="Application steps">
                      {STEPS.map((s) => {
                        const active = step === s.id;
                        const done = step > s.id;
                        const reachable = s.id <= highestStep || s.id < step;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => handleJumpStep(s.id)}
                            className={`px-2 sm:px-3 py-2 text-left rounded-[2px] border transition-colors duration-150 cursor-pointer ${
                              active
                                ? 'border-[#ede6ca]/50 bg-[#ede6ca]/[0.09] text-[#ede6ca]'
                                : done || reachable
                                  ? 'border-[#a9b47e]/35 bg-[#12160a]/75 text-[#a9b47e] hover:border-[#ede6ca]/35'
                                  : 'border-[#ede6ca]/12 bg-[#12160a]/40 text-[#c9c2a6]/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 font-mono text-[10px] tracking-[0.1em] tabular-nums">
                              <span>{s.num}</span>
                              {done && <Check className="h-3 w-3 text-[#a9b47e]" aria-hidden="true" />}
                            </div>
                            <p className="mt-0.5 text-[11px] sm:text-xs font-medium truncate">
                              <span className="sm:hidden">{s.shortLabel}</span>
                              <span className="hidden sm:inline">{s.label}</span>
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="h-[2px] w-full bg-[#ede6ca]/12 overflow-hidden">
                      <div
                        className="h-full bg-[#a9b47e] transition-all duration-300 ease-out"
                        style={{ width: `${(step / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Scrollable Body */}
              <div ref={modalBodyRef} className="flex-1 overflow-y-auto px-4 sm:px-7 py-5 sm:py-6">
                {receipt ? (
                  <div className="mun-step-enter space-y-6 py-2">
                    <div className="flex items-start gap-4 border-b border-[#ede6ca]/14 pb-5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-[#a9b47e]/45 bg-[#a9b47e]/10 text-[#a9b47e]">
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#a9b47e]">
                          Submission Confirmed
                        </p>
                        <h4 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-[#ede6ca]">
                          Thank you, {receipt.applicantName}
                        </h4>
                        <p className="mt-1.5 text-sm leading-relaxed text-[#c9c2a6]">
                          Your {receipt.trackTitle} application dossier has been saved securely and routed
                          for departmental review. Medical disclosures remain restricted to authorized senior
                          administrators.
                        </p>
                      </div>
                    </div>

                    <dl className="willow-folio-inset rounded-[3px] grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-[#ede6ca]/12 border border-[#ede6ca]/14 overflow-hidden text-sm">
                      <div className="bg-[#161b0c] px-4 py-3.5">
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                          Dossier Reference
                        </dt>
                        <dd className="mt-1 font-mono text-xs text-[#ede6ca] break-all tabular-nums">
                          {receipt.id}
                        </dd>
                      </div>
                      <div className="bg-[#161b0c] px-4 py-3.5">
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                          Track & Status
                        </dt>
                        <dd className="mt-1 text-[#ede6ca]">
                          {receipt.trackTitle} · Pending Review
                        </dd>
                      </div>
                      <div className="bg-[#161b0c] px-4 py-3.5">
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                          Applicant Email
                        </dt>
                        <dd className="mt-1 text-[#ede6ca] break-all">{receipt.email}</dd>
                      </div>
                      <div className="bg-[#161b0c] px-4 py-3.5">
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                          Recorded At
                        </dt>
                        <dd className="mt-1 font-mono text-xs text-[#cfc8aa] tabular-nums">
                          {new Date(receipt.createdAt).toLocaleString()}
                        </dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReceipt(null);
                          setStep(1);
                          setHighestStep(1);
                        }}
                        className="mun-btn-interactive inline-flex min-h-[44px] items-center justify-center rounded-[2px] border border-[#ede6ca]/32 px-4 py-2 text-xs font-medium text-[#ede6ca] hover:border-[#ede6ca] cursor-pointer"
                      >
                        Apply to another track
                      </button>

                      <button
                        type="button"
                        onClick={closeModal}
                        className="mun-btn-interactive inline-flex min-h-[44px] items-center justify-center rounded-[2px] bg-[#ede6ca] px-6 py-2 text-xs font-semibold text-[#181c0d] hover:bg-[#dad3b4] cursor-pointer"
                      >
                        Return to conference page
                      </button>
                    </div>
                  </div>
                ) : (
                  <form id="willow-application-form" onSubmit={handleSubmit} noValidate>
                    {/* STEP 1: PERSONAL INFORMATION */}
                    {step === 1 && (
                      <div key={`${selectedTrack}-step1`} className="mun-step-enter space-y-5">
                        <div>
                          <span className="mb-2 block text-xs font-medium text-[#c9c2a6]">
                            Application Track
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {TRACKS.map((t) => {
                              const active = selectedTrack === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTrack(t.id);
                                    setErrors({});
                                    setDuplicateConfirmed(false);
                                  }}
                                  className={`min-h-[44px] rounded-[2px] border px-3 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                                    active
                                      ? 'border-[#ede6ca] bg-[#ede6ca] text-[#181c0d] font-semibold'
                                      : 'border-[#ede6ca]/20 bg-[#0e1208] text-[#c9c2a6] hover:border-[#ede6ca]/45 hover:text-[#ede6ca]'
                                  }`}
                                >
                                  {t.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="apply-full-name"
                              className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                            >
                              Full name *
                            </label>
                            <input
                              id="apply-full-name"
                              type="text"
                              autoComplete="name"
                              required
                              value={currentDraft.applicant_name}
                              onChange={(e) => updateField('applicant_name', e.target.value)}
                              placeholder="First and last name"
                              className="h-11 w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
                            />
                            {errors.applicant_name && (
                              <p role="alert" className="mt-1.5 text-xs text-rose-300">
                                {errors.applicant_name}
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="apply-email"
                              className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                            >
                              Email address *
                            </label>
                            <input
                              id="apply-email"
                              type="email"
                              autoComplete="email"
                              required
                              value={currentDraft.email}
                              onChange={(e) => updateField('email', e.target.value)}
                              placeholder="you@example.com"
                              className="h-11 w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
                            />
                            {errors.email && (
                              <p role="alert" className="mt-1.5 text-xs text-rose-300">
                                {errors.email}
                              </p>
                            )}
                          </div>
                        </div>

                        {selectedTrack !== 'security' && (
                        <div>
                          <span
                            id="apply-gender-label"
                            className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                          >
                            Gender *{' '}
                            <span className="font-normal text-[#c9c2a6]/70">
                              (assigns Male/Female department review division)
                            </span>
                          </span>
                          <div
                            role="radiogroup"
                            aria-labelledby="apply-gender-label"
                            className="grid grid-cols-2 gap-2.5"
                          >
                            {(['male', 'female'] as const).map((option) => {
                              const selected = currentDraft.gender === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() => updateField('gender', option)}
                                  className={`min-h-[44px] rounded-[2px] border px-4 py-2 text-sm font-medium capitalize transition-colors duration-150 cursor-pointer flex items-center justify-between ${
                                    selected
                                      ? 'border-[#ede6ca] bg-[#ede6ca]/[0.12] text-[#ede6ca]'
                                      : 'border-[#ede6ca]/22 bg-[#0e1208] text-[#c9c2a6] hover:border-[#ede6ca]/45'
                                  }`}
                                >
                                  <span>{option}</span>
                                  <span
                                    aria-hidden="true"
                                    className={`h-3 w-3 rounded-full border ${
                                      selected
                                        ? 'border-[#ede6ca] bg-[#ede6ca]'
                                        : 'border-[#ede6ca]/35 bg-transparent'
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>
                          {errors.gender && (
                            <p role="alert" className="mt-1.5 text-xs text-rose-300">
                              {errors.gender}
                            </p>
                          )}
                        </div>

                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="apply-grade"
                              className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                            >
                              Grade *
                            </label>
                            <select
                              id="apply-grade"
                              required
                              value={currentDraft.grade}
                              onChange={(e) => updateField('grade', e.target.value)}
                              className="h-11 w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3 text-sm text-[#ede6ca] outline-none focus:border-[#ede6ca]"
                            >
                              <option value="">Select your current grade</option>
                              {GRADE_OPTIONS.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                            {errors.grade && (
                              <p role="alert" className="mt-1.5 text-xs text-rose-300">
                                {errors.grade}
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="apply-school"
                              className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                            >
                              School *
                            </label>
                            <input
                              id="apply-school"
                              type="text"
                              autoComplete="organization"
                              required
                              value={currentDraft.school}
                              onChange={(e) => updateField('school', e.target.value)}
                              placeholder="Your school or university name"
                              className="h-11 w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
                            />
                            {errors.school && (
                              <p role="alert" className="mt-1.5 text-xs text-rose-300">
                                {errors.school}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Phone Numbers with Saudi Arabia (+966) default & searchable picker */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <CountryPhoneInput
                            id="apply-phone"
                            label="Phone number"
                            required
                            countryIso={currentDraft.phoneCountryIso}
                            localNumber={currentDraft.phoneLocal}
                            onCountryChange={(iso) => updateField('phoneCountryIso', iso)}
                            onLocalNumberChange={(val) => updateField('phoneLocal', val)}
                            error={errors.phoneLocal}
                            autoComplete="tel-national"
                          />

                          <CountryPhoneInput
                            id="apply-guardian-phone"
                            label="Guardian's phone number"
                            required
                            countryIso={currentDraft.guardianPhoneCountryIso}
                            localNumber={currentDraft.guardianPhoneLocal}
                            onCountryChange={(iso) => updateField('guardianPhoneCountryIso', iso)}
                            onLocalNumberChange={(val) => updateField('guardianPhoneLocal', val)}
                            error={errors.guardianPhoneLocal}
                            autoComplete="off"
                          />
                        </div>

                        {/* Medical Condition Disclosure (Private / Admin Restricted) */}
                        {selectedTrack !== 'security' && (
                        <div className="willow-folio-inset rounded-[3px] p-4 sm:p-5 space-y-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              id="apply-medical-label"
                              className="text-xs sm:text-[13px] font-medium leading-relaxed text-[#ede6ca]"
                            >
                              Do you have any medical conditions or take any regular medication we should be aware of? *
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#a9b47e]">
                              <Lock className="h-3 w-3" aria-hidden="true" />
                              Private
                            </span>
                          </div>

                          <div
                            role="radiogroup"
                            aria-labelledby="apply-medical-label"
                            className="grid grid-cols-2 gap-2.5"
                          >
                            {([
                              ['no', 'No'],
                              ['yes', 'Yes'],
                            ] as const).map(([val, text]) => {
                              const selected = currentDraft.hasMedicalCondition === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() => updateField('hasMedicalCondition', val)}
                                  className={`min-h-[44px] rounded-[2px] border px-4 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer flex items-center justify-between ${
                                    selected
                                      ? 'border-[#ede6ca] bg-[#ede6ca]/[0.12] text-[#ede6ca]'
                                      : 'border-[#ede6ca]/22 bg-[#0e1208] text-[#c9c2a6] hover:border-[#ede6ca]/45'
                                  }`}
                                >
                                  <span>{text}</span>
                                  <span
                                    aria-hidden="true"
                                    className={`h-3 w-3 rounded-full border ${
                                      selected
                                        ? 'border-[#ede6ca] bg-[#ede6ca]'
                                        : 'border-[#ede6ca]/35 bg-transparent'
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>

                          {errors.hasMedicalCondition && (
                            <p role="alert" className="text-xs text-rose-300">
                              {errors.hasMedicalCondition}
                            </p>
                          )}

                          {currentDraft.hasMedicalCondition === 'yes' && (
                            <div className="mun-step-enter space-y-1.5 pt-1">
                              <label
                                htmlFor="apply-medical-details"
                                className="block text-xs font-medium text-[#c9c2a6]"
                              >
                                Briefly explain{' '}
                                <span className="font-normal text-[#c9c2a6]/70">(optional)</span>
                              </label>
                              <textarea
                                id="apply-medical-details"
                                rows={3}
                                value={currentDraft.medicalDetails}
                                onChange={(e) => updateField('medicalDetails', e.target.value)}
                                placeholder="Mention any allergies, asthma inhalers, diabetes, or regular medication for emergency readiness."
                                className="w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 py-2.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca] resize-y"
                              />
                            </div>
                          )}

                          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#c9c2a6]/80">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#a9b47e]" aria-hidden="true" />
                            <span>
                              Medical disclosures are encrypted in transit and restricted strictly to authorized conference administrators for safety preparedness.
                            </span>
                          </p>
                        </div>
                        )}

                      </div>
                    )}

                    {/* STEP 2: EXPERIENCE & PORTFOLIO / UPLOADS */}
                    {step === 2 && (
                      <div key={`${selectedTrack}-step2`} className="mun-step-enter space-y-5">
                        <div>
                          <label
                            htmlFor="apply-experience"
                            className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                          >
                            Previous experience *
                          </label>
                          <textarea
                            id="apply-experience"
                            rows={4}
                            required
                            value={currentDraft.experience}
                            onChange={(e) => updateField('experience', e.target.value)}
                            placeholder="Summarize past MUN conferences, photography/writing clubs, leadership positions, or events you supported. If this is your first time, share relevant school skills."
                            className="w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 py-2.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca] resize-y"
                          />
                          {errors.experience && (
                            <p role="alert" className="mt-1.5 text-xs text-rose-300">
                              {errors.experience}
                            </p>
                          )}
                        </div>

                        <ApplicationFileUploader
                          id="apply-proof-files"
                          track={selectedTrack}
                          fieldKind="proof_files"
                          draftSessionId={draftSessionId}
                          files={currentDraft.proofFiles}
                          onFilesChange={(updater) => updateFilesField('proofFiles', updater)}
                          title="Proof of previous experience"
                          description="Upload up to 20 supporting files, including certificates, letters, event badges, or screenshots. Experience listed without supporting proof will not be counted during evaluation."
                          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,.heic,.heif"
                          acceptedFormatsLabel="PDF, DOC, DOCX, TXT, JPG, PNG, WEBP, HEIC"
                          category="other"
                          maxFiles={20}
                          required={false}
                        />

                        {selectedTrack === 'media' && (
                          <div className="border-t border-[#ede6ca]/14 pt-5 space-y-5">
                            <div>
                              <label
                                htmlFor="apply-camera-model"
                                className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#c9c2a6]"
                              >
                                <Camera className="h-3.5 w-3.5 text-[#a9b47e]" aria-hidden="true" />
                                <span>Camera model / equipment type *</span>
                              </label>
                              <input
                                id="apply-camera-model"
                                type="text"
                                required
                                value={currentDraft.cameraModel}
                                onChange={(e) => updateField('cameraModel', e.target.value)}
                                placeholder="e.g. Sony A7 IV + 24–70mm f/2.8, Canon R6, or iPhone 15 Pro"
                                className="h-11 w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
                              />
                              {errors.cameraModel && (
                                <p role="alert" className="mt-1.5 text-xs text-rose-300">
                                  {errors.cameraModel}
                                </p>
                              )}
                            </div>

                            <ApplicationFileUploader
                              id="apply-media-photos"
                              track="media"
                              fieldKind="media_photos"
                              draftSessionId={draftSessionId}
                              files={currentDraft.mediaPhotos}
                              onFilesChange={(updater) => updateFilesField('mediaPhotos', updater)}
                              title="Upload 10–15 examples of photographs you have taken previously"
                              description="Showcase event coverage, portraits, lighting control, or candid framing you shot yourself. You can add images in batches, replace any photo, or remove shots before continuing."
                              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                              acceptedFormatsLabel="JPG, PNG, WEBP, HEIC"
                              category="photo"
                              isImageGallery
                              minFiles={10}
                              maxFiles={15}
                              required
                              error={errors.mediaPhotos}
                            />

                            <div>
                              <label
                                htmlFor="apply-portfolio"
                                className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                              >
                                Portfolio or reel link{' '}
                                <span className="font-normal text-[#c9c2a6]/70">(optional)</span>
                              </label>
                              <input
                                id="apply-portfolio"
                                type="url"
                                value={currentDraft.portfolio_url}
                                onChange={(e) => updateField('portfolio_url', e.target.value)}
                                placeholder="https://"
                                className="h-11 w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
                              />
                              {errors.portfolio_url && (
                                <p role="alert" className="mt-1.5 text-xs text-rose-300">
                                  {errors.portfolio_url}
                                </p>
                              )}
                            </div>
                          </div>
                        )}


                      </div>
                    )}

                    {/* STEP 3: ROLE-SPECIFIC QUESTIONS + ATTENDANCE QUESTION */}
                    {step === 3 && (
                      <div key={`${selectedTrack}-step3`} className="mun-step-enter space-y-5">
                        {roleQuestions.map((q, idx) => {
                          const answer = currentDraft.roleAnswers[q.id] || '';
                          const errKey = `role_${q.id}` as const;
                          const errMsg = errors[errKey];
                          const met = answer.trim().length >= q.minLength;
                          return (
                            <div key={q.id}>
                              {selectedTrack === 'security' && (q.id === 'security_q4' || q.id === 'security_q5') ? (
                                <div className="willow-folio-inset rounded-[3px] p-4 space-y-3">
                                  <span className="block text-xs sm:text-[13px] font-medium text-[#ede6ca]">{q.label}</span>
                                  <div className="grid grid-cols-2 gap-2">
                                    {(['yes', 'no'] as const).map((choice) => {
                                      const selected = answer === 'no' ? choice === 'no' : answer.startsWith('yes:') ? choice === 'yes' : false;
                                      return (
                                        <button key={choice} type="button" onClick={() => updateRoleAnswer(q.id, choice === 'no' ? 'no' : 'yes:')} className={`min-h-[44px] rounded-[2px] border px-4 py-2 text-sm font-medium capitalize flex items-center justify-between ${selected ? 'border-[#ede6ca] bg-[#ede6ca]/[0.12] text-[#ede6ca]' : 'border-[#ede6ca]/22 bg-[#0e1208] text-[#c9c2a6]'}`}>
                                          <span>{choice}</span><span aria-hidden="true" className={`h-3 w-3 rounded-full border ${selected ? 'border-[#ede6ca] bg-[#ede6ca]' : 'border-[#ede6ca]/35'}`} />
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {answer.startsWith('yes:') && (
                                    <textarea rows={2} value={answer.slice(4)} onChange={(e) => updateRoleAnswer(q.id, `yes:${e.target.value}`)} placeholder={q.placeholder} className="w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 py-2.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca] resize-y" />
                                  )}
                                  {errMsg && <p role="alert" className="text-xs text-rose-300">{errMsg}</p>}
                                </div>
                              ) : (
                              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                                <label
                                  htmlFor={`apply-${q.id}`}
                                  className="text-xs sm:text-[13px] font-medium leading-snug text-[#ede6ca]"
                                >
                                  <span className="mr-1.5 font-mono text-[11px] text-[#a9b47e]">
                                    0{idx + 1}.
                                  </span>
                                  {q.label} *
                                </label>
                                <span
                                  className={`shrink-0 font-mono text-[10px] tabular-nums ${
                                    met ? 'text-[#a9b47e]' : 'text-[#c9c2a6]/70'
                                  }`}
                                >
                                  {answer.trim().length}/{q.minLength}+ chars
                                </span>
                              </div>
                              <textarea
                                id={`apply-${q.id}`}
                                rows={3}
                                required
                                value={answer}
                                onChange={(e) => updateRoleAnswer(q.id, e.target.value)}
                                placeholder={q.placeholder}
                                className="w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 py-2.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca] resize-y"
                              />
                              {errMsg && (
                                <p role="alert" className="mt-1.5 text-xs text-rose-300">
                                  {errMsg}
                                </p>
                              )}
                            </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Question 5: Attendance including extra rehearsal day */}
                        {selectedTrack !== 'security' && (
                        <div className="willow-folio-inset rounded-[3px] p-4 sm:p-5 space-y-3.5">
                          <span
                            id="apply-attendance-label"
                            className="block text-xs sm:text-[13px] font-medium leading-snug text-[#ede6ca]"
                          >
                            <span className="mr-1.5 font-mono text-[11px] text-[#a9b47e]">05.</span>
                            {ATTENDANCE_QUESTION_LABEL} *
                          </span>

                          <div
                            role="radiogroup"
                            aria-labelledby="apply-attendance-label"
                            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                          >
                            {([
                              ['yes', 'Yes, I can attend all 3 days (including rehearsal)'],
                              ['no', 'No, I may miss part of it'],
                            ] as const).map(([val, label]) => {
                              const selected = currentDraft.attendsAllDays === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() => updateField('attendsAllDays', val)}
                                  className={`min-h-[44px] rounded-[2px] border px-3.5 py-2 text-left text-xs sm:text-sm font-medium transition-colors duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                                    selected
                                      ? 'border-[#ede6ca] bg-[#ede6ca]/[0.12] text-[#ede6ca]'
                                      : 'border-[#ede6ca]/22 bg-[#0e1208] text-[#c9c2a6] hover:border-[#ede6ca]/45'
                                  }`}
                                >
                                  <span>{label}</span>
                                  <span
                                    aria-hidden="true"
                                    className={`h-3 w-3 shrink-0 rounded-full border ${
                                      selected
                                        ? 'border-[#ede6ca] bg-[#ede6ca]'
                                        : 'border-[#ede6ca]/35 bg-transparent'
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>

                          {errors.attendsAllDays && (
                            <p role="alert" className="text-xs text-rose-300">
                              {errors.attendsAllDays}
                            </p>
                          )}

                          {currentDraft.attendsAllDays === 'no' && (
                            <div className="mun-step-enter space-y-1.5 pt-1">
                              <label
                                htmlFor="apply-absence-reason"
                                className="block text-xs font-medium text-[#c9c2a6]"
                              >
                                Explain why you cannot attend *
                              </label>
                              <textarea
                                id="apply-absence-reason"
                                rows={3}
                                required
                                value={currentDraft.absenceReason}
                                onChange={(e) => updateField('absenceReason', e.target.value)}
                                placeholder="Specify which day or hours conflict and why."
                                className="w-full rounded-[2px] border border-[#ede6ca]/24 bg-[#0e1208] px-3.5 py-2.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca] resize-y"
                              />
                              {errors.absenceReason && (
                                <p role="alert" className="mt-1.5 text-xs text-rose-300">
                                  {errors.absenceReason}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        )}

                      </div>
                    )}

                    {/* STEP 4: REVIEW & SUBMIT */}
                    {step === 4 && (
                      <div key={`${selectedTrack}-step4`} className="mun-step-enter space-y-5">
                        <div className="border-b border-[#ede6ca]/14 pb-3">
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                            Final Verification
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[#c9c2a6]">
                            Review your complete {currentTrackConfig.title} dossier below. Use Edit on any
                            section to make changes before submitting.
                          </p>
                        </div>

                        {/* Section 1 Review */}
                        <section className="willow-folio-inset rounded-[3px] p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2 border-b border-[#ede6ca]/12 pb-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                              01 · Personal Information
                            </span>
                            <button
                              type="button"
                              onClick={() => handleJumpStep(1)}
                              className="text-xs font-medium text-[#ede6ca] underline underline-offset-4 hover:text-[#a9b47e] cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>

                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                            <div>
                              <dt className="text-[#c9c2a6]/75">Applicant</dt>
                              <dd className="text-[#ede6ca] font-medium mt-0.5 capitalize">
                                {currentDraft.applicant_name}{selectedTrack !== 'security' ? ` (${currentDraft.gender})` : ''}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[#c9c2a6]/75">Email</dt>
                              <dd className="text-[#ede6ca] mt-0.5 break-all">{currentDraft.email}</dd>
                            </div>
                            <div>
                              <dt className="text-[#c9c2a6]/75">School & Grade</dt>
                              <dd className="text-[#ede6ca] mt-0.5">
                                {currentDraft.school} · {currentDraft.grade}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[#c9c2a6]/75">Phone / Guardian Phone</dt>
                              <dd className="font-mono text-[11px] text-[#ede6ca] mt-0.5 tabular-nums">
                                {resolvedPhones.phoneE164} · Guardian: {resolvedPhones.guardianPhoneE164}
                              </dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-[#c9c2a6]/75">Medical Disclosure</dt>
                              <dd className="text-[#ede6ca] mt-0.5">
                                {currentDraft.hasMedicalCondition === 'yes'
                                  ? currentDraft.medicalDetails.trim()
                                    ? 'Yes — confidential medical notes attached (visible to senior admins only)'
                                    : 'Yes — no additional notes entered'
                                  : 'No medical conditions or regular medication declared'}
                              </dd>
                            </div>
                          </dl>
                        </section>

                        {/* Section 2 Review */}
                        <section className="willow-folio-inset rounded-[3px] p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2 border-b border-[#ede6ca]/12 pb-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                              02 · Experience & Attachments
                            </span>
                            <button
                              type="button"
                              onClick={() => handleJumpStep(2)}
                              className="text-xs font-medium text-[#ede6ca] underline underline-offset-4 hover:text-[#a9b47e] cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>

                          <div className="space-y-3 text-xs">
                            <div>
                              <p className="text-[#c9c2a6]/75">Previous Experience</p>
                              <p className="mt-1 whitespace-pre-wrap text-[#ede6ca] leading-relaxed">
                                {currentDraft.experience}
                              </p>
                            </div>

                            {selectedTrack === 'media' && (
                              <div>
                                <p className="text-[#c9c2a6]/75">Camera Equipment</p>
                                <p className="mt-0.5 font-medium text-[#ede6ca]">
                                  {currentDraft.cameraModel}
                                </p>
                              </div>
                            )}

                            {selectedTrack === 'media' && currentDraft.mediaPhotos.length > 0 && (
                              <div>
                                <p className="text-[#c9c2a6]/75 mb-2">
                                  Sample Photography ({currentDraft.mediaPhotos.length} photos)
                                </p>
                                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                                  {currentDraft.mediaPhotos.map((photo, idx) => (
                                    <div
                                      key={photo.id}
                                      className="aspect-square overflow-hidden rounded-[2px] border border-[#ede6ca]/18 bg-[#0e1208]"
                                    >
                                      {photo.previewUrl ? (
                                        <img
                                          src={photo.previewUrl}
                                          alt={`Sample ${idx + 1}`}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full items-center justify-center font-mono text-[10px] text-[#c9c2a6]">
                                          #{idx + 1}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {currentDraft.proofFiles.length > 0 && (
                              <div>
                                <p className="text-[#c9c2a6]/75 mb-1">
                                  Proof of Experience ({currentDraft.proofFiles.length})
                                </p>
                                <ul className="space-y-1">
                                  {currentDraft.proofFiles.map((f) => (
                                    <li key={f.id} className="flex items-center gap-2 text-[#ede6ca]">
                                      <FileText className="h-3.5 w-3.5 text-[#a9b47e]" aria-hidden="true" />
                                      <span className="truncate">{f.name}</span>
                                      <span className="font-mono text-[10px] text-[#c9c2a6]/70">
                                        ({f.sizeLabel})
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {selectedTrack === 'press' && currentDraft.writingSamples.length > 0 && (
                              <div>
                                <p className="text-[#c9c2a6]/75 mb-1">
                                  Writing Samples ({currentDraft.writingSamples.length})
                                </p>
                                <ul className="space-y-1">
                                  {currentDraft.writingSamples.map((f) => (
                                    <li key={f.id} className="flex items-center gap-2 text-[#ede6ca]">
                                      <FileText className="h-3.5 w-3.5 text-[#a9b47e]" aria-hidden="true" />
                                      <span className="truncate">{f.name}</span>
                                      <span className="font-mono text-[10px] text-[#c9c2a6]/70">
                                        ({f.sizeLabel})
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {currentDraft.portfolio_url.trim() && (
                              <div>
                                <p className="text-[#c9c2a6]/75">Portfolio Link</p>
                                <p className="mt-0.5 text-[#a9b47e] break-all">
                                  {currentDraft.portfolio_url}
                                </p>
                              </div>
                            )}
                          </div>
                        </section>

                        {/* Section 3 Review */}
                        <section className="willow-folio-inset rounded-[3px] p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2 border-b border-[#ede6ca]/12 pb-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                              03 · Role Questions & Attendance
                            </span>
                            <button
                              type="button"
                              onClick={() => handleJumpStep(3)}
                              className="text-xs font-medium text-[#ede6ca] underline underline-offset-4 hover:text-[#a9b47e] cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>

                          <div className="space-y-3 text-xs">
                            {structuredPreviewAnswers
                              .filter(
                                (a) =>
                                  a.section === 'Role Questions' ||
                                  a.section === 'Attendance',
                              )
                              .map((a) => (
                                <div key={a.questionId}>
                                  <p className="font-medium text-[#c9c2a6]">{a.label}</p>
                                  <p className="mt-1 whitespace-pre-wrap text-[#ede6ca] leading-relaxed">
                                    {a.answer}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </section>
                      </div>
                    )}

                    {errors.general && (
                      <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-[2px] border border-rose-400/35 bg-rose-950/35 px-4 py-3 text-xs leading-relaxed text-rose-200"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-300" aria-hidden="true" />
                        <span>{errors.general}</span>
                      </div>
                    )}
                  </form>
                )}
              </div>

              {/* Modal Sticky Footer Controls */}
              {!receipt && (
                <div className="shrink-0 border-t border-[#ede6ca]/16 bg-[#171c0d] px-4 sm:px-7 py-3.5 sm:py-4 flex items-center justify-between gap-3">
                  {step > 1 ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setErrors({});
                        setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);
                        scrollBodyTop();
                      }}
                      className="mun-btn-interactive inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[2px] border border-[#ede6ca]/28 px-4 py-2 text-xs font-medium text-[#ede6ca] hover:border-[#ede6ca] disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Back</span>
                    </button>
                  ) : (
                    <span className="text-[11px] sm:text-xs text-[#c9c2a6]">Draft auto-saved</span>
                  )}

                  {step < 4 ? (
                    <button
                      key="btn-next"
                      type="button"
                      onClick={handleNextStep}
                      className="mun-btn-interactive inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] bg-[#ede6ca] px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold text-[#181c0d] hover:bg-[#dad3b4] cursor-pointer whitespace-nowrap"
                    >
                      <span>Continue to Step 0{step + 1}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      key="btn-submit"
                      type="submit"
                      form="willow-application-form"
                      disabled={busy}
                      className="mun-btn-interactive inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] bg-[#ede6ca] px-6 py-2.5 text-xs sm:text-sm font-semibold text-[#181c0d] hover:bg-[#dad3b4] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          <span>Submitting dossier…</span>
                        </>
                      ) : duplicateConfirmed ? (
                        <span>Confirm &amp; Submit Again</span>
                      ) : (
                        <span>Submit Application</span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </RevealSection>
  );
}
