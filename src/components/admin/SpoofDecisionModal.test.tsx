import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpoofDecisionModal } from './SpoofDecisionModal';

test('SpoofDecisionModal renders nothing when closed (application=null)', () => {
  const html = renderToStaticMarkup(
    createElement(SpoofDecisionModal, {
      application: null,
      assignableAdmins: [],
      onClose: () => undefined,
      onConfirm: async () => true,
    }),
  );
  assert.equal(html, '');
});

test('SpoofDecisionModal renders applicant details, current attribution, decision choices, and Admin picker', () => {
  const html = renderToStaticMarkup(
    createElement(SpoofDecisionModal, {
      application: {
        id: 'app-456',
        applicantName: 'Omar Farooq',
        applicationCode: 'WM-2027-088',
        status: 'accepted',
        finalDecisionBy: 'Ahmed Magdi',
      },
      assignableAdmins: [
        {
          userId: 'adm-1',
          fullName: 'Layla Hassan',
          email: 'layla@willowmun.org',
          role: 'admin',
          title: 'Director of Operations',
        },
        {
          userId: 'adm-2',
          fullName: 'Ahmed Magdi',
          email: 'ahmed@willowmun.org',
          role: 'admin',
          title: 'Admin',
        },
      ],
      onClose: () => undefined,
      onConfirm: async () => true,
    }),
  );

  assert.match(html, /Spoof Decision/);
  assert.match(html, /Omar Farooq/);
  assert.match(html, /WM-2027-088/);
  assert.match(html, /Accepted by Ahmed Magdi/);
  assert.match(html, /Layla Hassan \(Admin\)/);
  assert.match(html, /value="accepted"/);
  assert.match(html, /value="rejected"/);
  assert.match(html, /value="waitlisted"/);
  assert.match(html, /value="pending"/);
  assert.match(html, /Apply Spoof/);
  assert.match(html, /without sending any automated decision email/);
});

test('SpoofDecisionModal strips legacy Super Admin attribution tag from current status display', () => {
  const html = renderToStaticMarkup(
    createElement(SpoofDecisionModal, {
      application: {
        id: 'app-789',
        applicantName: 'Nadia Karim',
        applicationCode: 'WM-2027-099',
        status: 'rejected',
        finalDecisionBy: 'Lana (attributed by Super Admin: Mohammed Magdi)',
      },
      assignableAdmins: [
        {
          userId: 'adm-lana',
          fullName: 'Lana',
          email: 'lana@willowmun.org',
          role: 'admin',
          title: 'Admin',
        },
      ],
      onClose: () => undefined,
      onConfirm: async () => true,
    }),
  );

  assert.match(html, /Rejected by Lana/);
  assert.doesNotMatch(html, /attributed by Super Admin/i);
  assert.doesNotMatch(html, /Mohammed Magdi/);
});
