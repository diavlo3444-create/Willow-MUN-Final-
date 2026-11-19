import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_PLACEHOLDERS,
  SAMPLE_EMAIL_APPLICANTS,
  renderEmailPreview,
} from './sampleData';

test('EMAIL_TEMPLATE_PLACEHOLDERS lists all 7 supported tokens', () => {
  assert.deepEqual(
    EMAIL_TEMPLATE_PLACEHOLDERS.map((p) => p.token),
    [
      '{{applicant_name}}',
      '{{name}}',
      '{{department}}',
      '{{position}}',
      '{{signup_link}}',
      '{{signupUrl}}',
      '{{decision}}',
    ],
  );
});

test('renderEmailPreview interpolates all supported placeholders cleanly', () => {
  const applicant = SAMPLE_EMAIL_APPLICANTS[0];
  const raw =
    'Hello {{applicant_name}} ({{name}}) | {{department}} | {{position}} | {{signup_link}} | {{signupUrl}} | {{decision}}';

  const renderedAccepted = renderEmailPreview(raw, applicant, 'accepted');
  assert.match(renderedAccepted, /Layla Al-Mansoor \(Layla Al-Mansoor\)/);
  assert.match(renderedAccepted, /Media/);
  assert.match(renderedAccepted, /Lead Event Photographer/);
  assert.match(renderedAccepted, /https:\/\/willowmun\.org\/hr-signup\?token=sample-layla-101/);
  assert.match(renderedAccepted, /Accepted/);

  const renderedRejected = renderEmailPreview(
    DEFAULT_EMAIL_TEMPLATES.rejected.body,
    applicant,
    'rejected',
  );
  assert.match(renderedRejected, /Layla Al-Mansoor/);
  assert.match(renderedRejected, /Rejected/);
});
