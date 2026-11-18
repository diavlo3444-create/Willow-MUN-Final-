import { DEFAULT_COUNTRY_ISO, formatAndValidatePhone } from '../data/countryCodes';

export type ApplicationTrack = 'media' | 'press' | 'volunteer' | 'security';

export const PUBLIC_APPLICATION_TRACKS: readonly ApplicationTrack[] = [
  'media',
  'press',
  'volunteer',
] as const;

export interface UploadedApplicationFile {
  id: string;
  name: string;
  category: 'photo' | 'cv' | 'portfolio' | 'id_document' | 'other';
  fileType: string;
  sizeBytes: number;
  sizeLabel: string;
  storageBucket?: string;
  storagePath?: string;
  previewUrl?: string;
  uploadedAt: string;
  uploadStatus?: 'uploading' | 'uploaded' | 'fallback_inline' | 'error';
  progress?: number;
  errorMessage?: string;
}

export interface RoleQuestionDefinition {
  id: string;
  label: string;
  placeholder: string;
  minLength: number;
}

export const ATTENDANCE_QUESTION_LABEL =
  'Will you be able to attend all three days of WILLOW MUN, including the two conference days and the additional rehearsal day? If not, explain why.';

export const MEDIA_QUESTIONS: readonly RoleQuestionDefinition[] = [
  {
    id: 'media_q1',
    label: 'Why do you want to join the Media team at WILLOW MUN?',
    placeholder:
      'Share your motivation for visually documenting the conference and working inside the Communications wing.',
    minLength: 20,
  },
  {
    id: 'media_q2',
    label: 'How do you ensure you capture the most important moments during the conference?',
    placeholder:
      'Describe how you plan shot coverage, stay ahead of key debates or ceremonies, and manage timing across rooms.',
    minLength: 15,
  },
  {
    id: 'media_q3',
    label: 'What sets you apart from other applicants?',
    placeholder:
      'Highlight your photographic eye, editing workflow, teamwork, or reliability under conference pace.',
    minLength: 15,
  },
  {
    id: 'media_q4',
    label:
      'How would you approach chairs during committee sessions to request permission to film a reel without disrupting the ongoing debate?',
    placeholder:
      'Explain how you time your entry, communicate silently or concisely with the dais, and preserve decorum.',
    minLength: 15,
  },
] as const;

export const PRESS_QUESTIONS: readonly RoleQuestionDefinition[] = [
  {
    id: 'press_q1',
    label: 'Why do you want to join the Press team at WILLOW MUN?',
    placeholder:
      'Share your interest in diplomatic journalism, conference reporting, and editorial storytelling.',
    minLength: 20,
  },
  {
    id: 'press_q2',
    label: 'What sets you apart from other applicants?',
    placeholder:
      'Highlight your writing style, research accuracy, ability to work on tight deadlines, or editorial background.',
    minLength: 15,
  },
  {
    id: 'press_q3',
    label:
      'How would you identify and report the most important moments and developments during committee sessions?',
    placeholder:
      'Describe how you track motions, blocs, resolutions, and shifting debate dynamics accurately.',
    minLength: 15,
  },
  {
    id: 'press_q4',
    label:
      'How would you approach delegates and chairs to collect quotes or conduct short interviews without disrupting committee proceedings?',
    placeholder:
      'Explain how you use unmoderated caucuses, breaks, or diplomatic notes while respecting formal debate.',
    minLength: 15,
  },
] as const;

export const VOLUNTEER_QUESTIONS: readonly RoleQuestionDefinition[] = [
  {
    id: 'volunteer_q1',
    label:
      'What sets you apart from other volunteer applicants, and what qualities or skills make you a strong candidate for this role?',
    placeholder:
      'Share your initiative, dependability, calm under pressure, communication skills, and teamwork.',
    minLength: 20,
  },
  {
    id: 'volunteer_q2',
    label:
      'What actions would you take if you discovered someone had brought prohibited items, such as nicotine products or dangerous objects, into the venue in violation of the Code of Conduct?',
    placeholder:
      'Walk through your immediate safety priority, non-confrontational approach, and exact escalation to Security/Heads.',
    minLength: 15,
  },
  {
    id: 'volunteer_q3',
    label:
      "An impatient EB member tells you to leave your busy shift to cover another volunteer's shift, leaving your assigned position empty without informing your head. What would you do?",
    placeholder:
      'Explain how you handle authority respectfully while ensuring operational accountability and notifying your Volunteer Head.',
    minLength: 15,
  },
  {
    id: 'volunteer_q4',
    label:
      'How would you handle a situation where a chair, delegate, guest, or fellow team member becomes involved in a tense argument?',
    placeholder:
      'Describe your de-escalation steps, keeping people safe and calm, and knowing when to involve leadership.',
    minLength: 15,
  },
] as const;

export const SECURITY_QUESTIONS: readonly RoleQuestionDefinition[] = [
  {
    id: 'security_q1',
    label: 'Why do you want to join the Security Corps at WILLOW MUN?',
    placeholder: 'Share why you want to support venue order, badge verification, and delegate safety.',
    minLength: 15,
  },
  {
    id: 'security_q2',
    label: 'What sets you apart from other applicants?',
    placeholder: 'Describe your composure, vigilance, communication skills, and teamwork.',
    minLength: 15,
  },
  {
    id: 'security_q3',
    label: 'How do you handle access control or policy violations calmly?',
    placeholder: 'Explain how you uphold rules respectfully without escalating conflict.',
    minLength: 15,
  },
  {
    id: 'security_q4',
    label: 'How would you coordinate with Volunteer and Secretariat teams during peak transitions?',
    placeholder: 'Describe your communication approach at checkpoints and hallways.',
    minLength: 15,
  },
] as const;

export function getRoleQuestionsForTrack(track: ApplicationTrack): readonly RoleQuestionDefinition[] {
  switch (track) {
    case 'media':
      return MEDIA_QUESTIONS;
    case 'press':
      return PRESS_QUESTIONS;
    case 'volunteer':
      return VOLUNTEER_QUESTIONS;
    case 'security':
      return SECURITY_QUESTIONS;
  }
}

export const GRADE_OPTIONS: readonly string[] = [
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
  'University / Foundation',
  'Graduate / Gap Year',
] as const;

export interface TrackDraft {
  // Step 1: Personal Information
  applicant_name: string;
  email: string;
  gender: 'male' | 'female' | '';
  grade: string;
  school: string;
  phoneCountryIso: string;
  phoneLocal: string;
  guardianPhoneCountryIso: string;
  guardianPhoneLocal: string;
  hasMedicalCondition: 'yes' | 'no' | '';
  medicalDetails: string;

  // Step 2: Experience & Uploads
  experience: string;
  proofFiles: UploadedApplicationFile[];
  cameraModel: string;
  mediaPhotos: UploadedApplicationFile[];
  writingSamples: UploadedApplicationFile[];
  portfolio_url: string;

  // Step 3: Role Questions
  roleAnswers: Record<string, string>;
  attendsAllDays: 'yes' | 'no' | '';
  absenceReason: string;
}

export function createEmptyDraft(): TrackDraft {
  return {
    applicant_name: '',
    email: '',
    gender: '',
    grade: '',
    school: '',
    phoneCountryIso: DEFAULT_COUNTRY_ISO,
    phoneLocal: '',
    guardianPhoneCountryIso: DEFAULT_COUNTRY_ISO,
    guardianPhoneLocal: '',
    hasMedicalCondition: '',
    medicalDetails: '',

    experience: '',
    proofFiles: [],
    cameraModel: '',
    mediaPhotos: [],
    writingSamples: [],
    portfolio_url: '',

    roleAnswers: {},
    attendsAllDays: '',
    absenceReason: '',
  };
}

export function mapTrackToDepartmentSlug(track: ApplicationTrack): string {
  switch (track) {
    case 'volunteer':
      return 'volunteers';
    case 'media':
    case 'press':
      return track === 'media' ? 'media' : 'press';
    case 'security':
      return 'security';
  }
}

export type DraftErrorKey =
  | keyof TrackDraft
  | `role_${string}`
  | 'general';

export type FieldErrors = Partial<Record<DraftErrorKey, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidOptionalUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getResolvedPhones(draft: TrackDraft): {
  phoneE164: string;
  guardianPhoneE164: string;
} {
  const p1 = formatAndValidatePhone(draft.phoneCountryIso, draft.phoneLocal);
  const p2 = formatAndValidatePhone(draft.guardianPhoneCountryIso, draft.guardianPhoneLocal);
  return {
    phoneE164: p1.valid ? p1.e164 : `${draft.phoneLocal.trim()}`,
    guardianPhoneE164: p2.valid ? p2.e164 : `${draft.guardianPhoneLocal.trim()}`,
  };
}

export function validateStep(
  step: 1 | 2 | 3 | 4,
  draft: TrackDraft,
  track: ApplicationTrack,
): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (draft.applicant_name.trim().length < 2) {
      errors.applicant_name = 'Please enter your full name (at least 2 characters).';
    }
    if (!isValidEmail(draft.email)) {
      errors.email = 'Please enter a valid email address (for example, name@example.com).';
    }
    if (draft.gender !== 'male' && draft.gender !== 'female') {
      errors.gender = 'Please select your gender.';
    }
    if (!draft.grade.trim()) {
      errors.grade = 'Please select or enter your current grade.';
    }
    if (draft.school.trim().length < 2) {
      errors.school = 'Please enter your school or institution name.';
    }

    const phoneRes = formatAndValidatePhone(draft.phoneCountryIso, draft.phoneLocal);
    if (!phoneRes.valid) {
      errors.phoneLocal = phoneRes.error || 'Please enter a valid phone number.';
    }

    const guardianRes = formatAndValidatePhone(
      draft.guardianPhoneCountryIso,
      draft.guardianPhoneLocal,
    );
    if (!guardianRes.valid) {
      errors.guardianPhoneLocal =
        guardianRes.error || "Please enter a valid guardian's phone number.";
    }

    if (draft.hasMedicalCondition !== 'yes' && draft.hasMedicalCondition !== 'no') {
      errors.hasMedicalCondition =
        'Please select Yes or No regarding medical conditions or regular medication.';
    }
  }

  if (step === 2) {
    if (draft.experience.trim().length < 5) {
      errors.experience =
        'Please describe your previous experience (or note if this is your first MUN/organizing role).';
    }

    const uploadingAny = [
      ...draft.proofFiles,
      ...draft.mediaPhotos,
      ...draft.writingSamples,
    ].some((f) => f.uploadStatus === 'uploading');
    if (uploadingAny) {
      errors.general = 'Please wait until all file uploads finish before continuing.';
    }

    const errorAny = [
      ...draft.proofFiles,
      ...draft.mediaPhotos,
      ...draft.writingSamples,
    ].some((f) => f.uploadStatus === 'error');
    if (errorAny) {
      errors.general = 'Please remove or replace any files that failed to upload.';
    }

    if (track === 'media') {
      if (draft.cameraModel.trim().length < 2) {
        errors.cameraModel = 'Please enter the camera model or equipment you will use.';
      }
      if (draft.mediaPhotos.length < 10) {
        errors.mediaPhotos = `Please upload at least 10 photography examples (${draft.mediaPhotos.length} of 10–15 uploaded).`;
      } else if (draft.mediaPhotos.length > 15) {
        errors.mediaPhotos = 'You can upload up to 15 photography examples maximum.';
      }
    }

    if ((track === 'media' || track === 'press') && !isValidOptionalUrl(draft.portfolio_url)) {
      errors.portfolio_url = 'Please enter a complete URL starting with http:// or https://.';
    }
  }

  if (step === 3) {
    const questions = getRoleQuestionsForTrack(track);
    for (const q of questions) {
      const answer = (draft.roleAnswers[q.id] || '').trim();
      if (answer.length < q.minLength) {
        errors[`role_${q.id}`] = `Please write at least ${q.minLength} characters for this question.`;
      }
    }

    if (draft.attendsAllDays !== 'yes' && draft.attendsAllDays !== 'no') {
      errors.attendsAllDays =
        'Please indicate whether you can attend both conference days and the extra rehearsal day.';
    } else if (draft.attendsAllDays === 'no' && draft.absenceReason.trim().length < 5) {
      errors.absenceReason =
        'Please explain why you are unable to attend both conference days and the rehearsal day.';
    }
  }

  return errors;
}

export function validateAllSteps(
  draft: TrackDraft,
  track: ApplicationTrack,
): { firstInvalidStep: 1 | 2 | 3 | null; errors: FieldErrors } {
  const s1 = validateStep(1, draft, track);
  if (Object.keys(s1).length > 0) return { firstInvalidStep: 1, errors: s1 };
  const s2 = validateStep(2, draft, track);
  if (Object.keys(s2).length > 0) return { firstInvalidStep: 2, errors: s2 };
  const s3 = validateStep(3, draft, track);
  if (Object.keys(s3).length > 0) return { firstInvalidStep: 3, errors: s3 };
  return { firstInvalidStep: null, errors: {} };
}

export interface StructuredAnswerEntry {
  questionId: string;
  section: string;
  label: string;
  answer: string;
}

export function buildStructuredAnswers(
  draft: TrackDraft,
  track: ApplicationTrack,
): StructuredAnswerEntry[] {
  const questions = getRoleQuestionsForTrack(track);
  const items: StructuredAnswerEntry[] = [];

  if (track === 'media' && draft.cameraModel.trim()) {
    items.push({
      questionId: 'camera_model',
      section: 'Experience & Equipment',
      label: 'Camera Model / Equipment Type',
      answer: draft.cameraModel.trim(),
    });
  }

  items.push({
    questionId: 'experience_summary',
    section: 'Experience',
    label: 'Previous Experience',
    answer: draft.experience.trim(),
  });

  if (draft.portfolio_url.trim()) {
    items.push({
      questionId: 'portfolio_url',
      section: 'Experience',
      label: 'Portfolio / Work Link',
      answer: draft.portfolio_url.trim(),
    });
  }

  questions.forEach((q, idx) => {
    const val = (draft.roleAnswers[q.id] || '').trim();
    if (val) {
      items.push({
        questionId: q.id,
        section: 'Role Questions',
        label: `Q${idx + 1}. ${q.label}`,
        answer: val,
      });
    }
  });

  if (draft.attendsAllDays === 'yes' || draft.attendsAllDays === 'no') {
    const answerText =
      draft.attendsAllDays === 'yes'
        ? 'Yes — available for both conference days and the extra rehearsal day.'
        : `No — ${draft.absenceReason.trim()}`;
    items.push({
      questionId: 'attendance_confirmation',
      section: 'Attendance',
      label: `Q5. ${ATTENDANCE_QUESTION_LABEL}`,
      answer: answerText,
    });
  }

  return items;
}

export const WM_META_PREFIX = '[WM_META_V2]';
export const WM_META_SUFFIX = '[/WM_META_V2]';

export interface EncodedNonMedicalMeta {
  v: 2;
  grade: string;
  guardianPhone: string;
  cameraModel?: string | null;
  attendsAllDays?: boolean | null;
  absenceReason?: string | null;
  answers: StructuredAnswerEntry[];
  proofFiles?: UploadedApplicationFile[];
  mediaPhotos?: UploadedApplicationFile[];
  writingSamples?: UploadedApplicationFile[];
}

/**
 * Encodes strictly non-medical structured details cleanly inside `experience` ONLY as a backup
 * when communicating with pre-migration backend schemas. NEVER includes private medical data.
 */
export function buildLegacySafeExperienceField(
  draft: TrackDraft,
  track: ApplicationTrack,
): string {
  const { guardianPhoneE164 } = getResolvedPhones(draft);
  const stripLocalBlob = (files: UploadedApplicationFile[]): UploadedApplicationFile[] =>
    files.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      fileType: f.fileType,
      sizeBytes: f.sizeBytes,
      sizeLabel: f.sizeLabel,
      storageBucket: f.storageBucket,
      storagePath: f.storagePath,
      // Only preserve compact inline data URLs if upload used fallback; never serialize blob: URLs
      previewUrl:
        f.previewUrl && f.previewUrl.startsWith('data:') ? f.previewUrl : undefined,
      uploadedAt: f.uploadedAt,
      uploadStatus: f.uploadStatus,
    }));

  const meta: EncodedNonMedicalMeta = {
    v: 2,
    grade: draft.grade.trim(),
    guardianPhone: guardianPhoneE164,
    cameraModel: track === 'media' ? draft.cameraModel.trim() : null,
    attendsAllDays:
      draft.attendsAllDays === 'yes'
        ? true
        : draft.attendsAllDays === 'no'
          ? false
          : null,
    absenceReason:
      draft.attendsAllDays === 'no' ? draft.absenceReason.trim() : null,
    answers: buildStructuredAnswers(draft, track),
    proofFiles: stripLocalBlob(draft.proofFiles),
    mediaPhotos: track === 'media' ? stripLocalBlob(draft.mediaPhotos) : [],
    writingSamples: track === 'press' ? stripLocalBlob(draft.writingSamples) : [],
  };

  return `${draft.experience.trim()}\n\n${WM_META_PREFIX}${JSON.stringify(meta)}${WM_META_SUFFIX}`;
}

export function decodeLegacyExperienceMeta(rawExperience: string | null | undefined): {
  cleanExperience: string;
  meta: EncodedNonMedicalMeta | null;
} {
  const raw = String(rawExperience || '');
  const start = raw.indexOf(WM_META_PREFIX);
  const end = raw.indexOf(WM_META_SUFFIX);
  if (start === -1 || end === -1 || end <= start) {
    return { cleanExperience: raw, meta: null };
  }

  const cleanExperience = raw.slice(0, start).trim();
  const jsonText = raw.slice(start + WM_META_PREFIX.length, end);
  try {
    const parsed = JSON.parse(jsonText) as EncodedNonMedicalMeta;
    if (parsed && parsed.v === 2) {
      return { cleanExperience, meta: parsed };
    }
  } catch {
    // Ignore malformed legacy envelope
  }
  return { cleanExperience, meta: null };
}
