import test from 'node:test';
import assert from 'node:assert/strict';
import membersData from '../data/members.json';
import {
  computeCenteredCameraTransform,
  computeDesktopGoldTravelPath,
  computeDesktopPedigreePaths,
  computeDesktopRootToMemberSegments,
  computeFlipCardToPanel,
  computeMobileGoldTravelPath,
  computeMobileRootToMemberSegments,
  computeMobileTreePaths,
  computeModalClipOrigin,
  computeZoomTransform,
  formatObjectPosition,
  generateLaurelWreathData,
  generateLeafParticles,
  generateTipLeafSpecs,
  organizeFamilyTree,
  resolveMemberFallbackSrc,
  resolveMemberPortraitSrc,
  resolveMemberThumbSrc,
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

  assert.equal(tree.orderedMembers.length, 32);
  assert.equal(tree.centerGroups.length, 1);
  assert.equal(tree.leftGroups.length, 5);
  assert.equal(tree.rightGroups.length, 6);

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
    'pr',
    'security',
    'it',
    'volunteers',
    'dcc',
    'logistics',
    'ceremonies',
  ]);

  assert.equal(tree.orderedMembers[0].id, 'lana-ahmed');
  assert.equal(tree.orderedMembers[1].id, 'loor-almasri');
  assert.equal(tree.orderedMembers[1].quote, "In the end, we'll all become stories.");

  const nayaIdx = tree.indexById['naya-almasr'];
  assert.equal(tree.orderedMembers[nayaIdx].name, 'Naya Almasri');
  assert.equal(tree.orderedMembers[nayaIdx].displayRole, 'Operation Director');
  assert.equal(tree.orderedMembers[nayaIdx].group, 'ceremonies');

  assert.equal(tree.orderedMembers[tree.indexById['bushra']].group, 'volunteers');
  assert.equal(tree.orderedMembers[tree.indexById['bushra']].displayRole, 'Head of Volunteers');
  assert.equal(tree.orderedMembers[tree.indexById['bushra']].photo, 'photos/bushra.jpg');
  assert.equal(tree.orderedMembers[tree.indexById['abdulhadi']].group, 'volunteers');
  assert.equal(tree.orderedMembers[tree.indexById['abdulhadi']].displayRole, 'Head of Volunteers');

  const nasserIdx = tree.indexById['nasser-alqassem'];
  assert.equal(typeof nasserIdx, 'number');
  assert.equal(tree.orderedMembers[nasserIdx].group, 'dcc');
  assert.equal(tree.orderedMembers[nasserIdx].displayRole, 'Head of DCC');
  assert.equal(tree.orderedMembers[tree.indexById['rayan-alsaoud']].group, 'dcc');
  assert.equal(tree.orderedMembers[tree.indexById['rayan-alsaoud']].displayRole, 'Head of DCC');
  assert.equal(tree.indexById['muaz-tagelsir'], undefined);
  assert.equal(tree.indexById['ahmed-jamiel'], undefined);
  assert.equal(tree.indexById['maria'], undefined);
  assert.equal(tree.indexById['lelas-almadi'], undefined);

  const lilyIdx = tree.indexById['lily-rabia'];
  assert.equal(typeof lilyIdx, 'number');
  assert.equal(tree.orderedMembers[lilyIdx].name, 'Lily Rabia');
  assert.equal(tree.orderedMembers[lilyIdx].displayRole, 'Head of PR');
  assert.equal(tree.orderedMembers[lilyIdx].group, 'pr');
  assert.equal(tree.orderedMembers[lilyIdx].quote, 'Dream big. Start small. Act daily.');
  assert.equal(tree.orderedMembers[lilyIdx].photo, 'photos/lily-rabia.jpg');

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

test('computeDesktopPedigreePaths creates trunk, branches, bracket spines, ticks, levels, and tips', () => {
  const centerRects = [box(400, 100, 200, 60), box(400, 180, 200, 60)];
  const sideGroups = [
    {
      groupId: 'media',
      side: 'left' as const,
      labelRect: box(260, 130, 80, 28),
      memberRects: [box(20, 90, 200, 56), box(20, 160, 200, 56)],
      memberIds: ['alya-ismail', 'yousef-saifi'],
    },
    {
      groupId: 'security',
      side: 'right' as const,
      labelRect: box(660, 130, 80, 28),
      memberRects: [box(780, 90, 200, 56), box(780, 160, 200, 56)],
      memberIds: ['wed', 'ward'],
    },
  ];

  const paths = computeDesktopPedigreePaths(centerRects, sideGroups, 500, {
    centerMemberIds: ['naya-almasr', 'lana-ahmed'],
    secretariatLabelRect: box(440, 50, 120, 24),
  });
  const byId = new Map(paths.map((p) => [p.id, p]));

  assert.equal(byId.get('desktop-trunk')?.d, 'M 500 74 V 210');
  assert.equal(byId.get('desktop-trunk')?.level, 0);
  assert.equal(byId.get('branch-media')?.d, 'M 500 144 H 340');
  assert.equal(byId.get('branch-media')?.level, 1);
  assert.equal(byId.get('spine-media')?.d, 'M 240 118 V 188');
  assert.equal(byId.get('tick-media-0')?.d, 'M 240 118 H 220');
  assert.equal(byId.get('tick-media-0')?.level, 2);
  assert.equal(byId.get('tick-media-0')?.tip?.memberId, 'alya-ismail');
  assert.equal(byId.get('tick-media-0')?.tip?.x, 220);
  assert.equal(byId.get('tick-media-0')?.tip?.direction, -1);

  assert.equal(byId.get('branch-security')?.d, 'M 500 144 H 660');
  assert.equal(byId.get('spine-security')?.d, 'M 760 118 V 188');
  assert.equal(byId.get('tick-security-0')?.d, 'M 760 118 H 780');
  assert.equal(byId.get('tick-security-0')?.tip?.direction, 1);
});

test('computeMobileTreePaths generates trunk, group branch, sub-trunk, L-elbows, and tips', () => {
  const paths = computeMobileTreePaths(
    [
      {
        groupId: 'secretariat',
        labelRect: box(32, 20, 100, 24),
        memberRects: [box(64, 54, 240, 56), box(64, 120, 240, 56)],
        memberIds: ['naya-almasr', 'lana-ahmed'],
      },
      {
        groupId: 'media',
        labelRect: box(32, 200, 80, 24),
        memberRects: [box(64, 234, 240, 56)],
        memberIds: ['alya-ismail'],
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
  assert.equal(byId.get('mobile-l-media-0')?.tip?.memberId, 'alya-ismail');
});

test('computeZoomTransform anchors origin at box center and scales 1.5x', () => {
  const res = computeZoomTransform(box(100, 200, 200, 60), 1000, 800, 1.5);
  assert.equal(res.transformOrigin, '200px 230px');
  assert.ok(res.transform.includes('scale(1.5)'));
});

test('computeDesktopRootToMemberSegments & computeMobileRootToMemberSegments trace from SECRETARIAT root down to card edge', () => {
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

  const leftSeg = computeDesktopRootToMemberSegments(
    sideGroups[0].memberRects[0],
    'left',
    'media',
    centerRects,
    secretariatBadge,
    sideGroups,
    500,
  );
  assert.equal(leftSeg.rootToLabelD, 'M 500 74 V 144 H 340');
  assert.ok(leftSeg.labelToCardD.startsWith('M 260 144'));
  assert.ok(leftSeg.labelToCardD.endsWith('V 118 H 220'));

  const rightSeg = computeDesktopRootToMemberSegments(
    sideGroups[1].memberRects[1],
    'right',
    'security',
    centerRects,
    secretariatBadge,
    sideGroups,
    500,
  );
  assert.equal(rightSeg.rootToLabelD, 'M 500 74 V 144 H 660');
  assert.ok(rightSeg.labelToCardD.startsWith('M 740 144'));
  assert.ok(rightSeg.labelToCardD.endsWith('V 188 H 780'));

  // Legacy wrappers still return non-empty combined root-to-card strings
  const legacyDesktop = computeDesktopGoldTravelPath(
    sideGroups[0].memberRects[0],
    'left',
    'media',
    centerRects,
    secretariatBadge,
    sideGroups,
    500,
  );
  assert.ok(legacyDesktop.startsWith('M 500 74'));

  const mobileSeg = computeMobileRootToMemberSegments(
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
  assert.equal(mobileSeg.rootToLabelD, 'M 10 32 V 212 H 32');
  assert.equal(mobileSeg.labelToCardD, 'M 42 224 V 262 H 64');
  assert.ok(computeMobileGoldTravelPath(box(64, 234, 240, 56), 'media', [], 10).includes('H 64'));
});

test('computeModalClipOrigin maps viewport click point relative to fixed centered modal', () => {
  const origin = computeModalClipOrigin({ x: 540, y: 200 }, 1440, 900);
  assert.equal(origin.x, 50);
  assert.equal(origin.y, 60);
  assert.ok(origin.fullRadiusPx > Math.hypot(410, 560));

  const sideClick = computeModalClipOrigin({ x: 247, y: 93 }, 1440, 900);
  assert.ok(sideClick.fullRadiusPx >= Math.hypot(460 - sideClick.x, 620 - sideClick.y));

  const mobileOrigin = computeModalClipOrigin({ x: 180, y: 350 }, 360, 700);
  assert.equal(mobileOrigin.x, 166);
  assert.equal(mobileOrigin.y, 301);
});

test('generateLaurelWreathData, generateTipLeafSpecs, and generateLeafParticles stay within bounds', () => {
  const wreath = generateLaurelWreathData(10);
  assert.equal(wreath.leftLeaves.length, 10);
  assert.equal(wreath.rightLeaves.length, 10);
  assert.ok(wreath.leftBranchPath.startsWith('M '));
  assert.ok(wreath.rightBranchPath.startsWith('M '));

  const tipLeaves = generateTipLeafSpecs({ x: 220, y: 118, direction: -1, memberId: 'alya-ismail' });
  assert.ok(tipLeaves.length >= 2 && tipLeaves.length <= 3);

  const particles = generateLeafParticles({ x: 300, y: 400 }, 12, 42);
  assert.equal(particles.length, 12);
  for (const p of particles) {
    assert.equal(p.duration, 1.05);
    assert.ok(p.gravityDy > p.dy);
  }
});

test('WebP photo resolvers map member jpg paths to 96x96 thumbs and 240x240 portraits', () => {
  assert.equal(resolveMemberThumbSrc('photos/loor-almasri.jpg'), '/photos/thumbs/loor-almasri.webp');
  assert.equal(resolveMemberPortraitSrc('/photos/loor-almasri.jpg'), '/photos/portraits/loor-almasri.webp');
  assert.equal(resolveMemberFallbackSrc('photos/loor-almasri.jpg'), '/photos/loor-almasri.jpg');
  assert.equal(resolveMemberThumbSrc(null), null);
  assert.equal(resolveMemberPortraitSrc(''), null);
});

test('computeCenteredCameraTransform centers target card in viewport with transform-origin 0 0', () => {
  // baseChartLeft = 140, baseChartTop = 200, card local center = (580, 150)
  const cam = computeCenteredCameraTransform({
    cardRect: box(140 + 480, 200 + 120, 200, 60),
    chartRect: { left: 140, top: 200 },
    viewportWidth: 1440,
    viewportHeight: 900,
    targetScale: 1.5,
  });
  assert.equal(cam.scale, 1.5);
  assert.equal(cam.tx, -290);
  assert.equal(cam.ty, 25);
  assert.equal(cam.transform, 'translate3d(-290px, 25px, 0) scale(1.5)');

  // Verify gliding from an already zoomed camera state computes identical target coordinates
  const glideCam = computeCenteredCameraTransform({
    cardRect: { left: 140 - 290 + 480 * 1.5, top: 200 + 25 + 120 * 1.5, width: 200 * 1.5, height: 60 * 1.5 },
    chartRect: { left: 140 - 290, top: 200 + 25 },
    viewportWidth: 1440,
    viewportHeight: 900,
    currentTx: -290,
    currentTy: 25,
    currentScale: 1.5,
    targetScale: 1.5,
  });
  assert.equal(glideCam.tx, -290);
  assert.equal(glideCam.ty, 25);
});

test('computeFlipCardToPanel calculates exact center-origin FLIP translation and scale ratios', () => {
  const flip = computeFlipCardToPanel(
    box(200, 100, 230, 62),
    box(490, 140, 460, 620),
  );
  assert.equal(flip.dx, -405);
  assert.equal(flip.dy, -319);
  assert.equal(flip.sx, 0.5);
  assert.equal(flip.sy, 0.1);
  assert.equal(flip.panelFromTransform, 'translate3d(-405px, -319px, 0) scale(0.5, 0.1)');
  assert.equal(flip.panelToTransform, 'translate3d(0, 0, 0) scale(1, 1)');
  assert.equal(flip.cloneToTransform, 'translate3d(405px, 319px, 0) scale(2, 10)');
});

