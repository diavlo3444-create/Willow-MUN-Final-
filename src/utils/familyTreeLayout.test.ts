import test from 'node:test';
import assert from 'node:assert/strict';
import membersData from '../data/members.json';
import {
  computeDesktopGoldTravelPath,
  computeDesktopPedigreePaths,
  computeMobileGoldTravelPath,
  computeMobileTreePaths,
  computeModalClipOrigin,
  computeZoomTransform,
  formatObjectPosition,
  generateLaurelWreathData,
  generateLeafParticles,
  organizeFamilyTree,
  resolveRole,
  type FamilyTreeData,
  type RectBox,
} from './familyTreeLayout';

function box(left: number, top: number, width: number, height: number): RectBox {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

test('resolveRole falls back to Executive Board on null or whitespace', () => {
  assert.equal(resolveRole(null), 'Executive Board');
  assert.equal(resolveRole(''), 'Executive Board');
  assert.equal(resolveRole('   '), 'Executive Board');
  assert.equal(resolveRole('Head of IT'), 'Head of IT');
});

test('formatObjectPosition handles focus array and null defaults cleanly', () => {
  assert.equal(formatObjectPosition([25, 45]), '25% 45%');
  assert.equal(formatObjectPosition([120, -10]), '100% 0%');
  assert.equal(formatObjectPosition(null), '50% 35%');
});

test('organizeFamilyTree orders secretariat -> left groups -> right groups canonically', () => {
  const tree = organizeFamilyTree(membersData as FamilyTreeData);

  assert.equal(tree.orderedMembers.length, 31);
  assert.equal(tree.centerGroups.length, 1);
  assert.equal(tree.leftGroups.length, 4);
  assert.equal(tree.rightGroups.length, 8);

  // Check exact group traversal order across orderedMembers
  const seenGroups: string[] = [];
  for (const m of tree.orderedMembers) {
    if (seenGroups[seenGroups.length - 1] !== m.group) {
      seenGroups.push(m.group);
    }
  }
  assert.deepEqual(seenGroups, [
    'secretariat',
    'media',
    'press',
    'marketing',
    'design',
    'security',
    'it',
    'hr',
    'delegate-affairs',
    'volunteers',
    'dcc',
    'logistics',
    'ceremonies',
  ]);

  // Three Secretary-Generals appear first at the top of secretariat
  assert.equal(tree.orderedMembers[0].id, 'naya-almasr');
  assert.equal(tree.orderedMembers[1].id, 'lana-ahmed');
  assert.equal(tree.orderedMembers[2].id, 'loor-almasri');

  // Nasser Alqassem (role: null) receives fallback displayRole "Executive Board"
  const nasserIdx = tree.indexById['nasser-alqassem'];
  assert.equal(typeof nasserIdx, 'number');
  assert.equal(tree.orderedMembers[nasserIdx].displayRole, 'Executive Board');

  // Newly added and existing member photos/metadata
  assert.equal(tree.orderedMembers[tree.indexById['loor-almasri']].photo, 'photos/loor-almasri.jpg');
  assert.equal(tree.orderedMembers[tree.indexById['ward-ajaj']].photo, 'photos/ward-ajaj.jpg');
  assert.equal(tree.orderedMembers[tree.indexById['leila-krayani']].photo, 'photos/leila-krayani.jpg');
  assert.equal(tree.orderedMembers[tree.indexById['rayyan-sharshoh']].photo, 'photos/rayyan-sharshoh.jpg');
  assert.equal(tree.orderedMembers[tree.indexById['rayyan-sharshoh']].group, 'ceremonies');
  assert.equal(tree.orderedMembers[tree.indexById['jad-yassin']].photo, 'photos/jad-yassin.jpg');
  assert.equal(tree.orderedMembers[tree.indexById['jad-yassin']].objectPosition, '50% 35%');
  assert.equal(tree.orderedMembers[tree.indexById['ahmed-magdi']].photo, 'photos/ahmed-magdi.jpg');
  assert.equal(tree.orderedMembers[tree.indexById['ahmed-magdi']].quoteBy, 'Sun Tzu');
  assert.equal(tree.indexById['abdalrahman-abdallah'], undefined);
  assert.equal(tree.orderedMembers[tree.indexById['saleh-samaha']].photo, null);
});

test('computeDesktopPedigreePaths creates trunk, branches, bracket spines, and ticks', () => {
  const centerRects = [box(400, 100, 200, 60), box(400, 180, 200, 60)];
  const sideGroups = [
    {
      groupId: 'media',
      side: 'left' as const,
      labelRect: box(260, 130, 80, 28),
      memberRects: [box(20, 90, 200, 56), box(20, 160, 200, 56)],
    },
    {
      groupId: 'security',
      side: 'right' as const,
      labelRect: box(660, 130, 80, 28),
      memberRects: [box(780, 90, 200, 56), box(780, 160, 200, 56)],
    },
  ];

  const paths = computeDesktopPedigreePaths(centerRects, sideGroups, 500);
  const byId = new Map(paths.map((p) => [p.id, p]));

  assert.equal(byId.get('desktop-trunk')?.d, 'M 500 130 V 210');
  // Left group: trunk at 500 -> label right 340
  assert.equal(byId.get('branch-media')?.d, 'M 500 144 H 340');
  // Left spine at 220 + (260 - 220)*0.5 = 240, minCy = 118, maxCy = 188
  assert.equal(byId.get('spine-media')?.d, 'M 240 118 V 188');
  assert.equal(byId.get('tick-media-0')?.d, 'M 240 118 H 220');
  assert.equal(byId.get('tick-media-1')?.d, 'M 240 188 H 220');

  // Right group: trunk at 500 -> label left 660; spine at 740 + (780 - 740)*0.5 = 760
  assert.equal(byId.get('branch-security')?.d, 'M 500 144 H 660');
  assert.equal(byId.get('spine-security')?.d, 'M 760 118 V 188');
  assert.equal(byId.get('tick-security-0')?.d, 'M 760 118 H 780');
});

test('computeMobileTreePaths generates trunk, group branch, sub-trunk, and L-elbows', () => {
  const paths = computeMobileTreePaths(
    [
      {
        groupId: 'secretariat',
        labelRect: box(32, 20, 100, 24),
        memberRects: [box(64, 54, 240, 56), box(64, 120, 240, 56)],
      },
      {
        groupId: 'media',
        labelRect: box(32, 200, 80, 24),
        memberRects: [box(64, 234, 240, 56)],
      },
    ],
    10,
  );
  const byId = new Map(paths.map((p) => [p.id, p]));

  assert.equal(byId.get('mobile-trunk')?.d, 'M 10 32 V 212');
  assert.equal(byId.get('mobile-branch-secretariat')?.d, 'M 10 32 H 32');
  assert.equal(byId.get('mobile-subtrunk-secretariat')?.d, 'M 42 44 V 148');
  assert.equal(byId.get('mobile-l-secretariat-0')?.d, 'M 42 82 H 64');
  assert.equal(byId.get('mobile-l-secretariat-1')?.d, 'M 42 148 H 64');
});

test('computeZoomTransform anchors origin at box center and scales 1.5x', () => {
  const res = computeZoomTransform(box(100, 200, 200, 60), 1000, 800, 1.5);
  assert.equal(res.transformOrigin, '200px 230px');
  assert.ok(res.transform.includes('scale(1.5)'));
});

test('computeDesktopGoldTravelPath & computeMobileGoldTravelPath trace from card toward SECRETARIAT', () => {
  const centerRects = [box(400, 100, 200, 60), box(400, 180, 200, 60)];
  const secretariatBadge = box(440, 50, 120, 24);
  const sideGroups = [
    {
      groupId: 'media',
      side: 'left' as const,
      labelRect: box(260, 130, 80, 28),
      memberRects: [box(20, 90, 200, 56), box(20, 160, 200, 56)],
    },
    {
      groupId: 'security',
      side: 'right' as const,
      labelRect: box(660, 130, 80, 28),
      memberRects: [box(780, 90, 200, 56), box(780, 160, 200, 56)],
    },
  ];

  const leftPath = computeDesktopGoldTravelPath(
    sideGroups[0].memberRects[0],
    'left',
    'media',
    centerRects,
    secretariatBadge,
    sideGroups,
    500,
  );
  assert.ok(leftPath.startsWith('M 220 118 H 240'));
  assert.ok(leftPath.endsWith('V 74'));

  const rightPath = computeDesktopGoldTravelPath(
    sideGroups[1].memberRects[1],
    'right',
    'security',
    centerRects,
    secretariatBadge,
    sideGroups,
    500,
  );
  assert.ok(rightPath.startsWith('M 780 188 H 760'));
  assert.ok(rightPath.endsWith('V 74'));

  const mobilePath = computeMobileGoldTravelPath(
    box(64, 234, 240, 56),
    'media',
    [
      {
        groupId: 'secretariat',
        labelRect: box(32, 20, 100, 24),
        memberRects: [box(64, 54, 240, 56)],
      },
      {
        groupId: 'media',
        labelRect: box(32, 200, 80, 24),
        memberRects: [box(64, 234, 240, 56)],
      },
    ],
    10,
  );
  assert.equal(mobilePath, 'M 64 262 H 42 V 212 H 10 V 32');
});

test('computeModalClipOrigin maps viewport click point relative to fixed centered modal', () => {
  // Desktop 1440x900: modal is 460x620 -> left=490, top=140
  const origin = computeModalClipOrigin({ x: 540, y: 200 }, 1440, 900);
  assert.equal(origin.x, 50);
  assert.equal(origin.y, 60);
  assert.ok(origin.fullRadiusPx > Math.hypot(410, 560));

  // Corner/side click outside modal still reaches opposite corner
  const sideClick = computeModalClipOrigin({ x: 247, y: 93 }, 1440, 900);
  assert.ok(sideClick.fullRadiusPx >= Math.hypot(460 - sideClick.x, 620 - sideClick.y));

  // Mobile 360x700: modal is 331.2x602 -> left=14.4, top=49
  const mobileOrigin = computeModalClipOrigin({ x: 180, y: 350 }, 360, 700);
  assert.equal(mobileOrigin.x, 166);
  assert.equal(mobileOrigin.y, 301);
});

test('generateLaurelWreathData and generateLeafParticles stay within bounds', () => {
  const wreath = generateLaurelWreathData(10);
  assert.equal(wreath.leftLeaves.length, 10);
  assert.equal(wreath.rightLeaves.length, 10);
  assert.ok(wreath.leftBranchPath.startsWith('M '));
  assert.ok(wreath.rightBranchPath.startsWith('M '));

  const particles = generateLeafParticles({ x: 300, y: 400 }, 9, 42);
  assert.equal(particles.length, 9);
  for (const p of particles) {
    assert.equal(p.duration, 0.9);
    assert.ok(p.gravityDy > p.dy);
  }
});
