import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLegalRouteKind, isAdminRoute, normalizePathname } from './router.ts';

describe('router helpers', () => {
  it('normalizes trailing slashes and missing leading slashes safely', () => {
    assert.equal(normalizePathname('/'), '/');
    assert.equal(normalizePathname(''), '/');
    assert.equal(normalizePathname('/privacy/'), '/privacy');
    assert.equal(normalizePathname('/terms///'), '/terms');
    assert.equal(normalizePathname('portal'), '/portal');
    assert.equal(normalizePathname('/admin/applications/'), '/admin/applications');
  });

  it('resolves legal routes for privacy and terms including trailing slashes', () => {
    assert.equal(getLegalRouteKind('/privacy'), 'privacy');
    assert.equal(getLegalRouteKind('/privacy/'), 'privacy');
    assert.equal(getLegalRouteKind('/terms'), 'terms');
    assert.equal(getLegalRouteKind('/terms/'), 'terms');
    assert.equal(getLegalRouteKind('/'), null);
    assert.equal(getLegalRouteKind('/portal'), null);
    assert.equal(getLegalRouteKind('/admin'), null);
  });

  it('identifies all portal, admin, login, and scanner routes accurately', () => {
    const adminPaths = [
      '/portal',
      '/portal/',
      '/admin',
      '/admin/applications',
      '/head',
      '/head/scanner',
      '/security',
      '/staff',
      '/super-admin',
      '/eb',
      '/admin-login',
      '/eb-login',
      '/head-login',
      '/super-admin-login',
      '/security-login',
      '/staff-login',
      '/eb-signup',
      '/team-signup',
      '/head-setup',
    ];

    for (const path of adminPaths) {
      assert.equal(isAdminRoute(path), true, `Expected ${path} to be recognized as an admin/staff route`);
    }

    assert.equal(isAdminRoute('/'), false);
    assert.equal(isAdminRoute('/privacy'), false);
    assert.equal(isAdminRoute('/terms'), false);
  });
});
