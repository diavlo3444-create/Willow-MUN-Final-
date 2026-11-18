import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLegacySafeExperienceField,
  buildStructuredAnswers,
  createEmptyDraft,
  decodeLegacyExperienceMeta,
  getRoleQuestionsForTrack,
  mapTrackToDepartmentSlug,
  MEDIA_QUESTIONS,
  PRESS_QUESTIONS,
  VOLUNTEER_QUESTIONS,
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
    uploadedAt: '2026-11-18T10:00:00.000Z',
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

  it('enforces Media 10-15 photo requirement and camera model on Step 2', () => {
    const draft = createEmptyDraft();
    populateValidBaseStep1(draft);

    draft.experience = 'Led school photography club and covered two regional conferences.';
    draft.cameraModel = '';
    draft.mediaPhotos = Array.from({ length: 9 }, (_, i) => makeDummyPhoto(i + 1));

    const errUnder10 = validateStep(2, draft, 'media');
    assert.ok(errUnder10.cameraModel);
    assert.ok(errUnder10.mediaPhotos);

    draft.cameraModel = 'Sony Alpha A7 IV';
    draft.mediaPhotos = Array.from({ length: 10 }, (_, i) => makeDummyPhoto(i + 1));
    assert.deepEqual(validateStep(2, draft, 'media'), {});

    draft.mediaPhotos = Array.from({ length: 16 }, (_, i) => makeDummyPhoto(i + 1));
    const errOver15 = validateStep(2, draft, 'media');
    assert.ok(errOver15.mediaPhotos);
  });

  it('validates all 5 role questions & conditional rehearsal day reason for Press and Volunteers', () => {
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
        draft.mediaPhotos = Array.from({ length: 12 }, (_, i) => makeDummyPhoto(i + 1));
      }

      const emptyQ = validateStep(3, draft, track);
      assert.ok(emptyQ.attendsAllDays);

      for (const q of getRoleQuestionsForTrack(track)) {
        draft.roleAnswers[q.id] =
          'Detailed thoughtful response explaining exactly how I work with diplomacy and accuracy.';
      }
      draft.attendsAllDays = 'no';
      draft.absenceReason = '';
      const missingAbsence = validateStep(3, draft, track);
      assert.ok(missingAbsence.absenceReason);

      draft.absenceReason = 'I have a morning chemistry exam on rehearsal day, arriving at 13:00.';
      assert.deepEqual(validateAllSteps(draft, track), {
        firstInvalidStep: null,
        errors: {},
      });

      const structured = buildStructuredAnswers(draft, track);
      assert.ok(structured.some((a) => a.questionId === 'attendance_confirmation'));

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
    }
  });
});
