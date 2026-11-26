import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_CONFERENCE_DAY_IDS,
  ATTENDANCE_QUESTION_LABEL,
  CONFERENCE_DAYS,
  MEDIA_QUESTIONS,
  PRESS_QUESTIONS,
  PRIVACY_POLICY_VERSION,
  TERMS_AND_CONDITIONS_VERSION,
  VOLUNTEER_QUESTIONS,
  buildAvailabilitySummary,
  buildLegacySafeExperienceField,
  buildStructuredAnswers,
  createEmptyDraft,
  decodeLegacyExperienceMeta,
  getRoleQuestionsForTrack,
  mapTrackToDepartmentSlug,
  validateAllSteps,
  validateStep,
  type TrackDraft,
  type UploadedApplicationFile,
} from './applicationForm.ts';
import { findCountryByIso, formatAndValidatePhone } from '../data/countryCodes.ts';

function makeDummyPhoto(index: number): UploadedApplicationFile {
  return {
    id: `photo-${index}`,
    name: `sample-${index}.jpg`,
    category: 'photo',
    fileType: 'image/jpeg',
    sizeBytes: 120_000,
    sizeLabel: '117 KB',
    storageBucket: 'wm-application-files',
    storagePath: `media/session-1/media_photos/sample-${index}.jpg`,
    uploadedAt: '2027-11-18T10:00:00.000Z',
    uploadStatus: 'uploaded',
  };
}

function makeDummyVideo(index: number): UploadedApplicationFile {
  return {
    id: `video-${index}`,
    name: `edit-reel-${index}.mp4`,
    category: 'video',
    fileType: 'video/mp4',
    sizeBytes: 4_200_000,
    sizeLabel: '4.0 MB',
    storageBucket: 'wm-application-files',
    storagePath: `media/session-1/media_videos/edit-reel-${index}.mp4`,
    uploadedAt: '2027-11-18T10:00:00.000Z',
    uploadStatus: 'uploaded',
  };
}

function populateValidBaseStep1(draft: TrackDraft) {
  draft.applicant_name = 'Tariq Al-Mansoor';
  draft.email = 'tariq@example.com';
  draft.gender = 'male';
  draft.grade = 'Grade 11';
  draft.school = 'Al-Riyadh International School';
  draft.phoneCountryIso = 'SA';
  draft.phoneLocal = '0501234567';
  draft.guardianPhoneCountryIso = 'AE';
  draft.guardianPhoneLocal = '501234567';
  draft.hasMedicalCondition = 'no';
}

describe('countryCodes and applicationForm helpers', () => {
  it('defaults to Saudi Arabia (+966) and validates international numbers cleanly', () => {
    const sa = findCountryByIso('');
    assert.equal(sa.iso2, 'SA');
    assert.equal(sa.dialCode, '+966');

    const localZeroRes = formatAndValidatePhone('SA', '050 123 4567');
    assert.equal(localZeroRes.valid, true);
    assert.equal(localZeroRes.e164, '+966501234567');

    const alreadyE164Res = formatAndValidatePhone('SA', '+966501234567');
    assert.equal(alreadyE164Res.valid, true);
    assert.equal(alreadyE164Res.e164, '+966501234567');

    const badRes = formatAndValidatePhone('SA', '1234');
    assert.equal(badRes.valid, false);
    assert.ok(badRes.error);
  });

  it('maps public tracks to exact backend department slugs', () => {
    assert.equal(mapTrackToDepartmentSlug('volunteer'), 'volunteers');
    assert.equal(mapTrackToDepartmentSlug('media'), 'media');
    assert.equal(mapTrackToDepartmentSlug('press'), 'press');
    assert.equal(mapTrackToDepartmentSlug('security'), 'security');
  });

  it('initializes legal consent checkboxes unchecked and exports policy/terms versions', () => {
    const draft = createEmptyDraft();
    assert.equal(draft.privacyAccepted, false);
    assert.equal(draft.termsAccepted, false);
    assert.deepEqual(draft.availableDays, []);
    assert.ok(PRIVACY_POLICY_VERSION.length >= 4);
    assert.ok(TERMS_AND_CONDITIONS_VERSION.length >= 4);
  });

  it('validates Step 1 personal details, phones, and medical selection', () => {
    const draft = createEmptyDraft();
    const errs = validateStep(1, draft, 'media');
    assert.ok(errs.applicant_name);
    assert.ok(errs.email);
    assert.ok(errs.gender);
    assert.ok(errs.grade);
    assert.ok(errs.school);
    assert.ok(errs.phoneLocal);
    assert.ok(errs.guardianPhoneLocal);
    assert.ok(errs.hasMedicalCondition);

    populateValidBaseStep1(draft);
    assert.deepEqual(validateStep(1, draft, 'media'), {});

    // Selecting "Yes" allows empty optional explanation
    draft.hasMedicalCondition = 'yes';
    draft.medicalDetails = '';
    assert.deepEqual(validateStep(1, draft, 'media'), {});
  });

  it('allows 0, 1, low numbers, or blank previous experience across every application track', () => {
    for (const experienceValue of ['', '   ', '0', '1', 'None']) {
      for (const track of ['media', 'press', 'volunteer', 'security'] as const) {
        const draft = createEmptyDraft();
        populateValidBaseStep1(draft);
        draft.experience = experienceValue;
        if (track === 'media') {
          draft.cameraModel = 'Sony Alpha A7 IV';
          draft.canEditVideos = 'yes';
          draft.mediaPhotos = Array.from({ length: 10 }, (_, i) => makeDummyPhoto(i + 1));
        }

        assert.deepEqual(
          validateStep(2, draft, track),
          {},
          `Expected Step 2 to allow experience="${experienceValue}" on track=${track}`,
        );

        for (const q of getRoleQuestionsForTrack(track)) {
          draft.roleAnswers[q.id] =
            track === 'security' && (q.id === 'security_q4' || q.id === 'security_q5')
              ? 'no'
              : 'Detailed thoughtful response explaining my motivation and approach.';
        }
        if (track !== 'security') {
          draft.attendsAllDays = 'yes';
          draft.availableDays = [...ALL_CONFERENCE_DAY_IDS];
        }
        draft.privacyAccepted = true;
        draft.termsAccepted = true;

        assert.deepEqual(
          validateAllSteps(draft, track),
          { firstInvalidStep: null, errors: {} },
          `Expected full validation to pass with experience="${experienceValue}" on track=${track}`,
        );

        const answers = buildStructuredAnswers(draft, track);
        if (track === 'press' || track === 'volunteer') {
          assert.ok(
            answers.length >= 5,
            `Expected >= 5 structured answers for ${track} even when experience is "${experienceValue}"`,
          );
        }
        if (experienceValue.trim() === '0' || experienceValue.trim() === '1') {
          const expAnswer = answers.find((a) => a.questionId === 'experience_summary');
          assert.equal(expAnswer?.answer, experienceValue.trim());
        }

        const encoded = buildLegacySafeExperienceField(draft, track);
        const decoded = decodeLegacyExperienceMeta(encoded);
        assert.equal(decoded.cleanExperience, experienceValue.trim());
      }
    }
  });

  it('requires camera model and video editing capability while keeping video uploads optional on Media Step 2', () => {
    const draft = createEmptyDraft();
    populateValidBaseStep1(draft);

    draft.experience = 'Led school photography club and covered regional conferences.';
    draft.cameraModel = '';
    draft.canEditVideos = '';
    draft.mediaVideos = [];

    const missingFields = validateStep(2, draft, 'media');
    assert.ok(missingFields.cameraModel);
    assert.ok(missingFields.canEditVideos);
    assert.equal(missingFields.mediaVideos, undefined);

    draft.cameraModel = 'Sony Alpha A7 IV';

    // Saying "No" with 0 uploaded video edits is valid
    draft.canEditVideos = 'no';
    assert.deepEqual(validateStep(2, draft, 'media'), {});

    // Saying "Yes" with 0 uploaded video edits is also valid (upload is NOT mandatory)
    draft.canEditVideos = 'yes';
    assert.deepEqual(validateStep(2, draft, 'media'), {});

    // Uploading up to 5 optional video edits is valid
    draft.mediaVideos = [makeDummyVideo(1), makeDummyVideo(2)];
    assert.deepEqual(validateStep(2, draft, 'media'), {});

    // Exceeding the 5-video upload cap triggers an error
    draft.mediaVideos = Array.from({ length: 6 }, (_, i) => makeDummyVideo(i + 1));
    const overLimit = validateStep(2, draft, 'media');
    assert.ok(overLimit.mediaVideos);
  });

  it('records can_edit_videos in structured answers and legacy meta without leaking medical data', () => {
    const draft = createEmptyDraft();
    populateValidBaseStep1(draft);
    draft.cameraModel = 'Canon EOS R6';
    draft.canEditVideos = 'yes';
    draft.mediaVideos = [makeDummyVideo(1)];

    const answers = buildStructuredAnswers(draft, 'media');
    const videoEntry = answers.find((a) => a.questionId === 'can_edit_videos');
    assert.deepEqual(videoEntry, {
      questionId: 'can_edit_videos',
      section: 'Experience & Equipment',
      label: 'Can you edit videos?',
      answer: 'Yes',
    });

    const encoded = buildLegacySafeExperienceField(draft, 'media');
    const decoded = decodeLegacyExperienceMeta(encoded);
    assert.equal(decoded.meta?.canEditVideos, 'yes');
    assert.equal(decoded.meta?.mediaVideos?.length, 1);
    assert.equal(decoded.meta?.mediaVideos?.[0]?.category, 'video');
  });

  it('enforces both Privacy Policy and Terms & Conditions checkboxes independently on Step 4', () => {
    const draft = createEmptyDraft();
    const bothMissing = validateStep(4, draft, 'volunteer');
    assert.ok(bothMissing.privacyAccepted);
    assert.ok(bothMissing.termsAccepted);

    draft.privacyAccepted = true;
    draft.termsAccepted = false;
    const onlyPrivacy = validateStep(4, draft, 'volunteer');
    assert.equal(onlyPrivacy.privacyAccepted, undefined);
    assert.ok(onlyPrivacy.termsAccepted);

    draft.privacyAccepted = false;
    draft.termsAccepted = true;
    const onlyTerms = validateStep(4, draft, 'volunteer');
    assert.ok(onlyTerms.privacyAccepted);
    assert.equal(onlyTerms.termsAccepted, undefined);

    draft.privacyAccepted = true;
    draft.termsAccepted = true;
    assert.deepEqual(validateStep(4, draft, 'volunteer'), {});
  });

  it('represents all three conference dates (March 18, 19, and 20, 2027) everywhere without 2-day references', () => {
    assert.equal(CONFERENCE_DAYS.length, 3);
    assert.deepEqual(
      CONFERENCE_DAYS.map((d) => d.id),
      ['2027-03-18', '2027-03-19', '2027-03-20'],
    );
    assert.match(ATTENDANCE_QUESTION_LABEL, /March 18, March 19, and March 20, 2027/);
    assert.equal(/two conference days|both conference days/i.test(ATTENDANCE_QUESTION_LABEL), false);

    const yesDraft = createEmptyDraft();
    yesDraft.attendsAllDays = 'yes';
    yesDraft.availableDays = [...ALL_CONFERENCE_DAY_IDS];
    const yesSummary = buildAvailabilitySummary(yesDraft);
    assert.match(yesSummary, /March 18/);
    assert.match(yesSummary, /March 19/);
    assert.match(yesSummary, /March 20/);
    assert.equal(/both|two conference/i.test(yesSummary), false);

    const partialDraft = createEmptyDraft();
    partialDraft.attendsAllDays = 'no';
    partialDraft.availableDays = ['2027-03-18', '2027-03-20'];
    partialDraft.absenceReason = 'School mock exam on the morning of March 19.';
    const partialSummary = buildAvailabilitySummary(partialDraft);
    assert.match(partialSummary, /March 18, 2027/);
    assert.match(partialSummary, /March 20, 2027/);
    assert.match(partialSummary, /School mock exam/);
  });

  it('validates all role questions, 3-day attendance, and Step 4 consent for full submission', () => {
    assert.equal(MEDIA_QUESTIONS.length, 4);
    assert.equal(PRESS_QUESTIONS.length, 4);
    assert.equal(VOLUNTEER_QUESTIONS.length, 4);
    for (const questions of [MEDIA_QUESTIONS, PRESS_QUESTIONS, VOLUNTEER_QUESTIONS]) {
      assert.equal(questions[0].minLength, 20, 'The first motivation answer must satisfy the backend minimum.');
    }

    for (const track of ['media', 'press', 'volunteer'] as const) {
      const draft = createEmptyDraft();
      populateValidBaseStep1(draft);
      draft.experience = 'Served as reporter and coordinator across three school events.';
      if (track === 'media') {
        draft.cameraModel = 'Canon EOS R6';
        draft.canEditVideos = 'no';
        draft.mediaPhotos = Array.from({ length: 12 }, (_, i) => makeDummyPhoto(i + 1));
      }

      const emptyQ = validateStep(3, draft, track);
      assert.ok(emptyQ.attendsAllDays);
      assert.match(emptyQ.attendsAllDays, /March 18, March 19, and March 20, 2027/);

      for (const q of getRoleQuestionsForTrack(track)) {
        draft.roleAnswers[q.id] =
          'Detailed thoughtful response explaining exactly how I work with diplomacy and accuracy.';
      }
      draft.attendsAllDays = 'no';
      draft.availableDays = ['2027-03-18', '2027-03-20'];
      draft.absenceReason = '';
      const missingAbsence = validateStep(3, draft, track);
      assert.ok(missingAbsence.absenceReason);
      assert.match(missingAbsence.absenceReason, /March 18–20, 2027/);

      draft.absenceReason = 'I have a morning chemistry exam on March 19, arriving at 13:00.';

      // Step 4 still rejects until both checkboxes are confirmed
      const missingConsent = validateAllSteps(draft, track);
      assert.equal(missingConsent.firstInvalidStep, 4);
      assert.ok(missingConsent.errors.privacyAccepted);
      assert.ok(missingConsent.errors.termsAccepted);

      draft.privacyAccepted = true;
      draft.termsAccepted = true;
      assert.deepEqual(validateAllSteps(draft, track), {
        firstInvalidStep: null,
        errors: {},
      });

      const structured = buildStructuredAnswers(draft, track);
      const attendanceEntry = structured.find((a) => a.questionId === 'attendance_confirmation');
      assert.ok(attendanceEntry);
      assert.match(attendanceEntry.answer, /March 18, 2027/);
      assert.match(attendanceEntry.answer, /March 20, 2027/);

      // Verify sensitive medical details NEVER leak into non-medical legacy meta serialization
      draft.hasMedicalCondition = 'yes';
      draft.medicalDetails = 'Severe peanut allergy — carries EpiPen';
      const legacyEncoded = buildLegacySafeExperienceField(draft, track);
      assert.equal(legacyEncoded.includes('peanut'), false);
      assert.equal(legacyEncoded.includes('EpiPen'), false);

      const decoded = decodeLegacyExperienceMeta(legacyEncoded);
      assert.equal(decoded.cleanExperience, draft.experience);
      assert.equal(decoded.meta?.grade, 'Grade 11');
      assert.equal(decoded.meta?.guardianPhone, '+971501234567');
      assert.deepEqual(decoded.meta?.availableDays, ['2027-03-18', '2027-03-20']);
    }
  });
});
