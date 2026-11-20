import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminUser, Department } from '../types/admin';
import { buildPermissionMap } from './adminPermissions';
import {
  ALYA_DIALOGUE_BEATS,
  ALYA_EASTER_EGG_IMAGE_URL,
  clearAlyaIntroSession,
  hasSeenAlyaIntroInSession,
  isAlyaAccount,
  markAlyaIntroSeenInSession,
  shouldShowAlyaLoginEasterEgg,
  type StorageLike,
} from './alyaEasterEgg';

const DEPARTMENTS: Department[] = [
  {
    id: 'dept-media-uuid',
    slug: 'media',
    name: 'Media',
    cluster: 'Communications & Creative',
    description: '',
    headUserIds: [],
    registrationOpen: true,
    capacity: 20,
    positions: [],
    instructions: '',
    updatedAt: '2027-11-18T00:00:00Z',
  },
  {
    id: 'dept-press-uuid',
    slug: 'press',
    name: 'Press',
    cluster: 'Communications & Creative',
    description: '',
    headUserIds: [],
    registrationOpen: true,
    capacity: 20,
    positions: [],
    instructions: '',
    updatedAt: '2027-11-18T00:00:00Z',
  },
  {
    id: 'dept-sec-uuid',
    slug: 'security',
    name: 'Security',
    cluster: 'Delegate Affairs & Operations',
    description: '',
    headUserIds: [],
    registrationOpen: true,
    capacity: 20,
    positions: [],
    instructions: '',
    updatedAt: '2027-11-18T00:00:00Z',
  },
];

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-generic-1',
    fullName: 'Generic User',
    email: 'generic@willowmun.org',
    role: 'department_head',
    roleDefinitionId: 'department_head',
    title: 'Department Head',
    departmentId: 'dept-media-uuid',
    departmentSlug: 'media',
    division: 'female',
    avatarUrl: null,
    isActive: true,
    status: 'active',
    invitationStatus: 'accepted',
    invitationToken: null,
    lastPasswordResetAt: null,
    permissions: buildPermissionMap({ 'applications.view': true }),
    createdAt: '2027-11-18T00:00:00Z',
    lastActiveAt: '2027-11-18T00:00:00Z',
    ...overrides,
  };
}

function makeMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
  };
}

describe('Alya login Easter egg identity matching', () => {
  it('uses the uploaded character image asset directly', () => {
    assert.equal(ALYA_EASTER_EGG_IMAGE_URL, '/assets/aistudio/images__1__63a869f3.jpg');
    assert.ok(ALYA_DIALOGUE_BEATS.length >= 3);
    assert.match(ALYA_DIALOGUE_BEATS[0].text, /Alya/i);
  });

  it('matches Alya Ismail Supabase EB / Media Head profile via unique roster anchor', () => {
    const alyaLiveEb = makeUser({
      id: '9e2d88f1-2c13-4b7b-9d1a-000000000001',
      fullName: 'Alya Ismail',
      email: 'alya.personal@example.com',
      role: 'executive_board',
      title: 'Head of Media',
      departmentId: 'dept-media-uuid',
      avatarUrl: 'photos/alya-ismail.jpg',
    });
    assert.equal(isAlyaAccount(alyaLiveEb, DEPARTMENTS), true);

    const alyaWithoutAvatar = makeUser({
      id: '9e2d88f1-2c13-4b7b-9d1a-000000000002',
      fullName: 'Alya Ismail',
      email: 'alya.ismail@example.com',
      role: 'department_head',
      title: 'Head of Media',
      departmentId: 'dept-media-uuid',
      avatarUrl: null,
    });
    assert.equal(isAlyaAccount(alyaWithoutAvatar, DEPARTMENTS), true);
  });

  it('matches explicit UUID/email overrides and legacy Alya ID', () => {
    const customUuidUser = makeUser({
      id: 'uuid-custom-alya',
      fullName: 'Alya',
      role: 'executive_board',
      departmentId: 'dept-media-uuid',
    });
    assert.equal(
      isAlyaAccount(customUuidUser, DEPARTMENTS, { userIds: ['uuid-custom-alya'] }),
      true,
    );
    assert.equal(
      isAlyaAccount(
        makeUser({ id: 'other', email: 'ALYA@CustomDomain.com' }),
        DEPARTMENTS,
        { emails: ['alya@customdomain.com'] },
      ),
      true,
    );
    assert.equal(
      isAlyaAccount(makeUser({ id: 'usr-head-media', fullName: 'Alya Ismail' }), DEPARTMENTS),
      true,
    );
  });

  it('does NOT trigger for other users, admins, security, staff, Yousef Saifi, or spoofed first names', () => {
    // Co-Head of Media
    const yousef = makeUser({
      id: 'uuid-yousef',
      fullName: 'Yousef Saifi',
      email: 'yousef@willowmun.org',
      role: 'executive_board',
      title: 'Head of Media',
      departmentId: 'dept-media-uuid',
      avatarUrl: 'photos/yousef-saifi.jpg',
    });
    assert.equal(isAlyaAccount(yousef, DEPARTMENTS), false);

    // Arbitrary staff or security account happens to share first name "Alya"
    const randomStaffAlya = makeUser({
      id: 'uuid-staff-alya',
      fullName: 'Alya',
      role: 'staff',
      departmentId: 'dept-sec-uuid',
      departmentSlug: 'security',
    });
    assert.equal(isAlyaAccount(randomStaffAlya, DEPARTMENTS), false);

    // Generic Media account with just first name "Alya" (not Alya Ismail's full identity/avatar/ID)
    const spoofedFirstNameMedia = makeUser({
      id: 'uuid-other-media',
      fullName: 'Alya',
      role: 'department_head',
      departmentId: 'dept-media-uuid',
    });
    assert.equal(isAlyaAccount(spoofedFirstNameMedia, DEPARTMENTS), false);

    // Admin or Super Admin
    const superAdmin = makeUser({
      id: 'uuid-naya',
      fullName: 'Naya Barakat',
      role: 'super_admin',
      departmentId: null,
      departmentSlug: null,
    });
    assert.equal(isAlyaAccount(superAdmin, DEPARTMENTS), false);

    // Suspended Alya account
    const suspendedAlya = makeUser({
      id: 'usr-head-media',
      fullName: 'Alya Ismail',
      isActive: false,
      status: 'suspended',
    });
    assert.equal(isAlyaAccount(suspendedAlya, DEPARTMENTS), false);
  });
});

describe('Alya login Easter egg session deduplication', () => {
  it('shows once after login, does not repeat during session, and resets on sign-out', () => {
    const storage = makeMemoryStorage();
    const alya = makeUser({
      id: '9e2d88f1-2c13-4b7b-9d1a-000000000001',
      fullName: 'Alya Ismail',
      role: 'executive_board',
      departmentId: 'dept-media-uuid',
      avatarUrl: 'photos/alya-ismail.jpg',
    });

    assert.equal(hasSeenAlyaIntroInSession(alya.id, storage), false);
    assert.equal(
      shouldShowAlyaLoginEasterEgg({ user: alya, departments: DEPARTMENTS, storage }),
      true,
    );

    // After dismissal or completion
    markAlyaIntroSeenInSession(alya.id, storage);
    assert.equal(hasSeenAlyaIntroInSession(alya.id, storage), true);
    assert.equal(
      shouldShowAlyaLoginEasterEgg({ user: alya, departments: DEPARTMENTS, storage }),
      false,
    );

    // Also suppressed if Super Admin is previewing in Department Testing Mode
    assert.equal(
      shouldShowAlyaLoginEasterEgg({
        user: alya,
        testModeHeadUser: alya,
        departments: DEPARTMENTS,
        storage: makeMemoryStorage(),
      }),
      false,
    );

    // Sign-out clears session flag so next login plays again cleanly
    clearAlyaIntroSession(undefined, storage);
    assert.equal(hasSeenAlyaIntroInSession(alya.id, storage), false);
    assert.equal(
      shouldShowAlyaLoginEasterEgg({ user: alya, departments: DEPARTMENTS, storage }),
      true,
    );
  });
});
