import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OverrideDecisionModal } from './OverrideDecisionModal';

test('OverrideDecisionModal renders nothing when closed (application=null)', () => {
  const html = renderToStaticMarkup(
    createElement(OverrideDecisionModal, {
      application: null,
      onClose: () => undefined,
      onConfirm: async () => true,
    }),
  );
  assert.equal(html, '');
});

test('OverrideDecisionModal renders applicant details, all 4 decision statuses, reason input, and actions', () => {
  const html = renderToStaticMarkup(
    createElement(OverrideDecisionModal, {
      application: {
        id: 'app-123',
        applicantName: 'Layla Hassan',
        applicationCode: 'WM-2027-042',
        status: 'rejected',
      },
      onClose: () => undefined,
      onConfirm: async () => true,
    }),
  );

  assert.match(html, /Override Decision/);
  assert.match(html, /Layla Hassan/);
  assert.match(html, /WM-2027-042/);
  assert.match(html, /rejected/);
  assert.match(html, /value="pending"/);
  assert.match(html, /value="accepted"/);
  assert.match(html, /value="rejected"/);
  assert.match(html, /value="waitlisted"/);
  assert.match(html, /Override reason \(optional\)/);
  assert.match(html, /Confirm Override/);
  assert.match(html, /Cancel/);
});
