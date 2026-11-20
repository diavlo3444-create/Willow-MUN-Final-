export type GroupSide = 'center' | 'left' | 'right';

export interface FamilyGroup {
  id: string;
  label: string;
  side: GroupSide;
  cluster?: string;
}

export interface RawFamilyMember {
  id: string;
  name: string;
  role: string | null;
  group: string;
  quote: string;
  quoteBy: string | null;
  photo: string | null;
  focus: [number, number] | null;
}

export interface FamilyTreeData {
  groups: FamilyGroup[];
  members: RawFamilyMember[];
}

export interface OrderedMember extends RawFamilyMember {
  canonicalIndex: number;
  displayRole: string;
  groupLabel: string;
  side: GroupSide;
  objectPosition: string;
}

export interface GroupWithMembers {
  group: FamilyGroup;
  members: OrderedMember[];
}

export interface OrganizedFamilyTree {
  centerGroups: GroupWithMembers[];
  leftGroups: GroupWithMembers[];
  rightGroups: GroupWithMembers[];
  allGroupsInOrder: GroupWithMembers[];
  orderedMembers: OrderedMember[];
  indexById: Record<string, number>;
}

export interface RectBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface DesktopGroupMeasurement {
  groupId: string;
  side: 'left' | 'right';
  labelRect: RectBox | null;
  memberRects: RectBox[];
}

export interface MobileGroupMeasurement {
  groupId: string;
  labelRect: RectBox | null;
  memberRects: RectBox[];
}

export interface SvgConnectorPath {
  id: string;
  d: string;
  stageOrder: number;
}

/**
 * Resolves a member's displayed role, defaulting null/blank roles to "Executive Board".
 */
export function resolveRole(role: string | null | undefined): string {
  if (!role || role.trim().length === 0) {
    return 'Executive Board';
  }
  return role.trim();
}

/**
 * Converts a [x, y] percentage focus point into CSS object-position.
 */
export function formatObjectPosition(focus: [number, number] | null | undefined): string {
  if (!focus || focus.length < 2) {
    return '50% 35%';
  }
  const x = Math.max(0, Math.min(100, focus[0]));
  const y = Math.max(0, Math.min(100, focus[1]));
  return `${x}% ${y}%`;
}

/**
 * Builds canonical ordered member list & side partitions directly from members.json:
 * secretariat (center), then left groups top-to-bottom, then right groups top-to-bottom.
 */
export function organizeFamilyTree(data: FamilyTreeData): OrganizedFamilyTree {
  const centerRaw = data.groups.filter((g) => g.side === 'center');
  const leftRaw = data.groups.filter((g) => g.side === 'left');
  const rightRaw = data.groups.filter((g) => g.side === 'right');

  const canonicalGroups = [...centerRaw, ...leftRaw, ...rightRaw];
  const membersByGroup = new Map<string, RawFamilyMember[]>();

  for (const g of canonicalGroups) {
    membersByGroup.set(g.id, []);
  }
  for (const m of data.members) {
    const bucket = membersByGroup.get(m.group);
    if (bucket) {
      bucket.push(m);
    }
  }

  const orderedMembers: OrderedMember[] = [];
  const indexById: Record<string, number> = {};
  const groupMap = new Map<string, GroupWithMembers>();

  for (const group of canonicalGroups) {
    const rawList = membersByGroup.get(group.id) ?? [];
    const hydrated: OrderedMember[] = rawList.map((raw) => {
      const canonicalIndex = orderedMembers.length;
      const member: OrderedMember = {
        ...raw,
        canonicalIndex,
        displayRole: resolveRole(raw.role),
        groupLabel: group.label,
        side: group.side,
        objectPosition: formatObjectPosition(raw.focus),
      };
      orderedMembers.push(member);
      indexById[member.id] = canonicalIndex;
      return member;
    });

    groupMap.set(group.id, { group, members: hydrated });
  }

  const centerGroups = centerRaw.map((g) => groupMap.get(g.id)!);
  const leftGroups = leftRaw.map((g) => groupMap.get(g.id)!);
  const rightGroups = rightRaw.map((g) => groupMap.get(g.id)!);

  return {
    centerGroups,
    leftGroups,
    rightGroups,
    allGroupsInOrder: [...centerGroups, ...leftGroups, ...rightGroups],
    orderedMembers,
    indexById,
  };
}

function centerY(rect: RectBox): number {
  return rect.top + rect.height / 2;
}

function centerX(rect: RectBox): number {
  return rect.left + rect.width / 2;
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Computes orthogonal pedigree bracket and trunk SVG path descriptors from real DOM rects (>= 900px).
 */
export function computeDesktopPedigreePaths(
  centerMemberRects: RectBox[],
  sideGroups: DesktopGroupMeasurement[],
  fallbackTrunkX: number,
): SvgConnectorPath[] {
  const paths: SvgConnectorPath[] = [];

  const trunkX =
    centerMemberRects.length > 0
      ? centerMemberRects.reduce((acc, r) => acc + centerX(r), 0) / centerMemberRects.length
      : fallbackTrunkX;

  const branchYs: number[] = [];
  for (const g of sideGroups) {
    if (g.labelRect) {
      branchYs.push(centerY(g.labelRect));
    }
  }

  // Center vertical trunk: connects secretariat nodes vertically and extends to reach lowest/highest branches
  if (centerMemberRects.length > 0 || branchYs.length > 0) {
    const centerTop =
      centerMemberRects.length > 0
        ? Math.min(...centerMemberRects.map((r) => centerY(r)))
        : Math.min(...branchYs);
    const centerBottom =
      centerMemberRects.length > 0
        ? Math.max(...centerMemberRects.map((r) => centerY(r)))
        : Math.max(...branchYs);

    const minY = Math.min(centerTop, ...(branchYs.length > 0 ? branchYs : [centerTop]));
    const maxY = Math.max(centerBottom, ...(branchYs.length > 0 ? branchYs : [centerBottom]));

    if (maxY > minY) {
      paths.push({
        id: 'desktop-trunk',
        d: `M ${r1(trunkX)} ${r1(minY)} V ${r1(maxY)}`,
        stageOrder: 0,
      });
    }
  }

  // Side group horizontal branches -> label -> bracket spine -> member box ticks
  sideGroups.forEach((group, groupIdx) => {
    const { groupId, side, labelRect, memberRects } = group;
    if (!labelRect || memberRects.length === 0) return;

    const labelCy = centerY(labelRect);
    const baseOrder = 1 + groupIdx;

    if (side === 'left') {
      // Branch from central trunk leftwards to label's right edge
      if (trunkX > labelRect.right) {
        paths.push({
          id: `branch-${groupId}`,
          d: `M ${r1(trunkX)} ${r1(labelCy)} H ${r1(labelRect.right)}`,
          stageOrder: baseOrder,
        });
      }

      const maxMemberRight = Math.max(...memberRects.map((r) => r.right));
      const spineX = maxMemberRight + (labelRect.left - maxMemberRight) * 0.5;
      const memberCys = memberRects.map(centerY);
      const minCy = Math.min(...memberCys);
      const maxCy = Math.max(...memberCys);
      const bracketMidY = (minCy + maxCy) / 2;

      // Stem from label left edge to bracket spine
      if (Math.abs(labelCy - bracketMidY) < 1.5) {
        paths.push({
          id: `stem-${groupId}`,
          d: `M ${r1(labelRect.left)} ${r1(labelCy)} H ${r1(spineX)}`,
          stageOrder: baseOrder + 1,
        });
      } else {
        paths.push({
          id: `stem-${groupId}`,
          d: `M ${r1(labelRect.left)} ${r1(labelCy)} H ${r1((labelRect.left + spineX) / 2)} V ${r1(bracketMidY)} H ${r1(spineX)}`,
          stageOrder: baseOrder + 1,
        });
      }

      // Vertical bracket spine spanning top-to-bottom member centers
      if (maxCy - minCy > 1) {
        paths.push({
          id: `spine-${groupId}`,
          d: `M ${r1(spineX)} ${r1(minCy)} V ${r1(maxCy)}`,
          stageOrder: baseOrder + 2,
        });
      }

      // Horizontal ticks into each member box's right edge
      memberRects.forEach((mRect, mIdx) => {
        const cy = centerY(mRect);
        paths.push({
          id: `tick-${groupId}-${mIdx}`,
          d: `M ${r1(spineX)} ${r1(cy)} H ${r1(mRect.right)}`,
          stageOrder: baseOrder + 3 + mIdx * 0.25,
        });
      });
    } else {
      // side === 'right': Branch from central trunk rightwards to label's left edge
      if (labelRect.left > trunkX) {
        paths.push({
          id: `branch-${groupId}`,
          d: `M ${r1(trunkX)} ${r1(labelCy)} H ${r1(labelRect.left)}`,
          stageOrder: baseOrder,
        });
      }

      const minMemberLeft = Math.min(...memberRects.map((r) => r.left));
      const spineX = labelRect.right + (minMemberLeft - labelRect.right) * 0.5;
      const memberCys = memberRects.map(centerY);
      const minCy = Math.min(...memberCys);
      const maxCy = Math.max(...memberCys);
      const bracketMidY = (minCy + maxCy) / 2;

      if (Math.abs(labelCy - bracketMidY) < 1.5) {
        paths.push({
          id: `stem-${groupId}`,
          d: `M ${r1(labelRect.right)} ${r1(labelCy)} H ${r1(spineX)}`,
          stageOrder: baseOrder + 1,
        });
      } else {
        paths.push({
          id: `stem-${groupId}`,
          d: `M ${r1(labelRect.right)} ${r1(labelCy)} H ${r1((labelRect.right + spineX) / 2)} V ${r1(bracketMidY)} H ${r1(spineX)}`,
          stageOrder: baseOrder + 1,
        });
      }

      if (maxCy - minCy > 1) {
        paths.push({
          id: `spine-${groupId}`,
          d: `M ${r1(spineX)} ${r1(minCy)} V ${r1(maxCy)}`,
          stageOrder: baseOrder + 2,
        });
      }

      memberRects.forEach((mRect, mIdx) => {
        const cy = centerY(mRect);
        paths.push({
          id: `tick-${groupId}-${mIdx}`,
          d: `M ${r1(spineX)} ${r1(cy)} H ${r1(mRect.left)}`,
          stageOrder: baseOrder + 3 + mIdx * 0.25,
        });
      });
    }
  });

  return paths;
}

/**
 * Computes mobile (< 900px) single-trunk SVG paths with L-shaped elbow connectors from DOM rects.
 */
export function computeMobileTreePaths(
  groups: MobileGroupMeasurement[],
  trunkX = 10,
): SvgConnectorPath[] {
  const paths: SvgConnectorPath[] = [];
  const labelCys: number[] = [];

  for (const g of groups) {
    if (g.labelRect) {
      labelCys.push(centerY(g.labelRect));
    }
  }

  if (labelCys.length >= 2) {
    const minY = Math.min(...labelCys);
    const maxY = Math.max(...labelCys);
    paths.push({
      id: 'mobile-trunk',
      d: `M ${r1(trunkX)} ${r1(minY)} V ${r1(maxY)}`,
      stageOrder: 0,
    });
  }

  groups.forEach((group, groupIdx) => {
    const { groupId, labelRect, memberRects } = group;
    if (!labelRect) return;

    const labelCy = centerY(labelRect);
    const baseOrder = 1 + groupIdx * 0.5;

    // Horizontal branch from main left trunk to group label left edge
    if (labelRect.left > trunkX) {
      paths.push({
        id: `mobile-branch-${groupId}`,
        d: `M ${r1(trunkX)} ${r1(labelCy)} H ${r1(labelRect.left)}`,
        stageOrder: baseOrder,
      });
    }

    if (memberRects.length === 0) return;

    // Vertical sub-trunk drops below label left edge and connects via L-shaped elbows to each member
    const minMemberLeft = Math.min(...memberRects.map((r) => r.left));
    const subX = Math.max(trunkX + 12, Math.min(minMemberLeft - 12, labelRect.left + 10));
    const lastMemberCy = centerY(memberRects[memberRects.length - 1]);

    if (lastMemberCy > labelRect.bottom) {
      paths.push({
        id: `mobile-subtrunk-${groupId}`,
        d: `M ${r1(subX)} ${r1(labelRect.bottom)} V ${r1(lastMemberCy)}`,
        stageOrder: baseOrder + 0.2,
      });
    }

    memberRects.forEach((mRect, mIdx) => {
      const mCy = centerY(mRect);
      paths.push({
        id: `mobile-l-${groupId}-${mIdx}`,
        d: `M ${r1(subX)} ${r1(mCy)} H ${r1(mRect.left)}`,
        stageOrder: baseOrder + 0.4 + mIdx * 0.15,
      });
    });
  });

  return paths;
}

/**
 * Computes a smooth zoom transform anchored on a target box while keeping it comfortably framed.
 */
export function computeZoomTransform(
  boxRect: RectBox,
  stageWidth: number,
  stageHeight: number,
  scale = 1.5,
): { transform: string; transformOrigin: string } {
  const bx = centerX(boxRect);
  const by = centerY(boxRect);

  // Pull slightly toward horizontal center so edge columns remain cleanly inside viewport at 1.5x
  const nudgeX = (stageWidth / 2 - bx) * 0.25;
  const nudgeY = Math.max(-80, Math.min(80, (stageHeight / 2 - by) * 0.12));

  return {
    transformOrigin: `${r1(bx)}px ${r1(by)}px`,
    transform: `translate3d(${r1(nudgeX)}px, ${r1(nudgeY)}px, 0) scale(${scale})`,
  };
}

/**
 * Traces one continuous SVG path from a clicked desktop card back through its group bracket
 * and central trunk into the SECRETARIAT node header/top.
 */
export function computeDesktopGoldTravelPath(
  memberRect: RectBox,
  side: GroupSide,
  groupId: string,
  centerMemberRects: RectBox[],
  secretariatLabelRect: RectBox | null,
  sideGroups: DesktopGroupMeasurement[],
  fallbackTrunkX: number,
): string {
  const trunkX =
    centerMemberRects.length > 0
      ? centerMemberRects.reduce((acc, r) => acc + centerX(r), 0) / centerMemberRects.length
      : fallbackTrunkX;

  const targetY = secretariatLabelRect
    ? secretariatLabelRect.bottom
    : centerMemberRects.length > 0
      ? Math.min(...centerMemberRects.map((r) => centerY(r)))
      : memberRect.top;

  const mCy = centerY(memberRect);

  if (side === 'center') {
    const startY = mCy > targetY ? mCy : memberRect.bottom;
    return `M ${r1(trunkX)} ${r1(startY)} V ${r1(targetY)}`;
  }

  const group = sideGroups.find((g) => g.groupId === groupId);
  if (!group || !group.labelRect || group.memberRects.length === 0) {
    const startX = side === 'left' ? memberRect.right : memberRect.left;
    return `M ${r1(startX)} ${r1(mCy)} H ${r1(trunkX)} V ${r1(targetY)}`;
  }

  const { labelRect, memberRects } = group;
  const labelCy = centerY(labelRect);
  const memberCys = memberRects.map(centerY);
  const bracketMidY = (Math.min(...memberCys) + Math.max(...memberCys)) / 2;

  if (side === 'left') {
    const maxMemberRight = Math.max(...memberRects.map((r) => r.right));
    const spineX = maxMemberRight + (labelRect.left - maxMemberRight) * 0.5;
    const segments: string[] = [`M ${r1(memberRect.right)} ${r1(mCy)}`, `H ${r1(spineX)}`];

    if (Math.abs(mCy - bracketMidY) >= 1) {
      segments.push(`V ${r1(bracketMidY)}`);
    }

    if (Math.abs(labelCy - bracketMidY) < 1.5) {
      segments.push(`H ${r1(trunkX)}`);
    } else {
      segments.push(
        `H ${r1((labelRect.left + spineX) / 2)}`,
        `V ${r1(labelCy)}`,
        `H ${r1(trunkX)}`,
      );
    }

    if (Math.abs(labelCy - targetY) >= 1) {
      segments.push(`V ${r1(targetY)}`);
    }

    return segments.join(' ');
  }

  // side === 'right'
  const minMemberLeft = Math.min(...memberRects.map((r) => r.left));
  const spineX = labelRect.right + (minMemberLeft - labelRect.right) * 0.5;
  const segments: string[] = [`M ${r1(memberRect.left)} ${r1(mCy)}`, `H ${r1(spineX)}`];

  if (Math.abs(mCy - bracketMidY) >= 1) {
    segments.push(`V ${r1(bracketMidY)}`);
  }

  if (Math.abs(labelCy - bracketMidY) < 1.5) {
    segments.push(`H ${r1(trunkX)}`);
  } else {
    segments.push(
      `H ${r1((labelRect.right + spineX) / 2)}`,
      `V ${r1(labelCy)}`,
      `H ${r1(trunkX)}`,
    );
  }

  if (Math.abs(labelCy - targetY) >= 1) {
    segments.push(`V ${r1(targetY)}`);
  }

  return segments.join(' ');
}

/**
 * Traces one continuous SVG path from a clicked mobile card back through its group sub-trunk
 * and main vertical trunk into the SECRETARIAT header.
 */
export function computeMobileGoldTravelPath(
  memberRect: RectBox,
  groupId: string,
  mobileGroups: MobileGroupMeasurement[],
  trunkX = 10,
): string {
  const secretariatGroup = mobileGroups[0];
  const targetY = secretariatGroup?.labelRect ? centerY(secretariatGroup.labelRect) : 20;
  const mCy = centerY(memberRect);

  const group = mobileGroups.find((g) => g.groupId === groupId);
  if (!group || !group.labelRect || group.memberRects.length === 0) {
    return `M ${r1(memberRect.left)} ${r1(mCy)} H ${r1(trunkX)} V ${r1(targetY)}`;
  }

  const { labelRect, memberRects } = group;
  const labelCy = centerY(labelRect);
  const minMemberLeft = Math.min(...memberRects.map((r) => r.left));
  const subX = Math.max(trunkX + 12, Math.min(minMemberLeft - 12, labelRect.left + 10));

  const segments: string[] = [
    `M ${r1(memberRect.left)} ${r1(mCy)}`,
    `H ${r1(subX)}`,
    `V ${r1(labelCy)}`,
    `H ${r1(trunkX)}`,
  ];

  if (Math.abs(labelCy - targetY) >= 1) {
    segments.push(`V ${r1(targetY)}`);
  }

  return segments.join(' ');
}

/**
 * Computes fixed modal dimensions (width: min(92vw, 460px), height: min(86dvh, 620px)),
 * maps a viewport coordinate into the modal-local clip-path origin (X, Y),
 * and calculates fullRadiusPx so the expanded circle covers all four corners.
 */
export function computeModalClipOrigin(
  viewportPoint: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number; fullRadiusPx: number } {
  const modalW = Math.min(viewportWidth * 0.92, 460);
  const modalH = Math.min(viewportHeight * 0.86, 620);
  const modalLeft = (viewportWidth - modalW) / 2;
  const modalTop = (viewportHeight - modalH) / 2;

  const x = Math.round(viewportPoint.x - modalLeft);
  const y = Math.round(viewportPoint.y - modalTop);
  const dxMax = Math.max(Math.abs(x), Math.abs(modalW - x));
  const dyMax = Math.max(Math.abs(y), Math.abs(modalH - y));
  const fullRadiusPx = Math.ceil(Math.hypot(dxMax, dyMax)) + 24;

  return { x, y, fullRadiusPx };
}

export interface LaurelLeafNode {
  id: string;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  orderIndex: number;
}

export interface LaurelWreathGeometry {
  leftBranchPath: string;
  rightBranchPath: string;
  leftLeaves: LaurelLeafNode[];
  rightLeaves: LaurelLeafNode[];
}

/**
 * Generates two curved olive branch SVG paths around a 200x200 circular portrait frame
 * plus evenly distributed leaves along each branch (8-12 per branch).
 */
export function generateLaurelWreathData(leavesPerBranch = 10): LaurelWreathGeometry {
  const clampedCount = Math.max(8, Math.min(12, leavesPerBranch));
  const cx = 100;
  const cy = 100;
  const radius = 82;

  const degToRad = (deg: number) => (deg * Math.PI) / 180;
  const ptOnCircle = (deg: number) => {
    const rad = degToRad(deg);
    return {
      x: r1(cx + radius * Math.cos(rad)),
      y: r1(cy + radius * Math.sin(rad)),
    };
  };

  // Left branch: bottom-left (103deg) sweeping clockwise through left (180deg) to top-left (256deg)
  const leftStartDeg = 103;
  const leftEndDeg = 256;
  const ls = ptOnCircle(leftStartDeg);
  const le = ptOnCircle(leftEndDeg);
  const leftBranchPath = `M ${ls.x} ${ls.y} A ${radius} ${radius} 0 0 1 ${le.x} ${le.y}`;

  // Right branch: bottom-right (77deg) sweeping counter-clockwise through right (0deg) to top-right (-76deg)
  const rightStartDeg = 77;
  const rightEndDeg = -76;
  const rs = ptOnCircle(rightStartDeg);
  const re = ptOnCircle(rightEndDeg);
  const rightBranchPath = `M ${rs.x} ${rs.y} A ${radius} ${radius} 0 0 0 ${re.x} ${re.y}`;

  const leftLeaves: LaurelLeafNode[] = [];
  const rightLeaves: LaurelLeafNode[] = [];

  for (let i = 0; i < clampedCount; i += 1) {
    const t = (i + 0.55) / clampedCount;
    const sideFlip = i % 2 === 0 ? 1 : -1;
    const scale = r1(0.88 + Math.sin(t * Math.PI) * 0.24);

    // Left branch point + upward-following tangent angle
    const lDeg = leftStartDeg + (leftEndDeg - leftStartDeg) * t;
    const lp = ptOnCircle(lDeg);
    const lTangentDeg = lDeg + 90;
    leftLeaves.push({
      id: `left-leaf-${i}`,
      x: lp.x,
      y: lp.y,
      rotate: r1(lTangentDeg + sideFlip * 28),
      scale,
      orderIndex: i,
    });

    // Right branch point + upward-following tangent angle
    const rDeg = rightStartDeg + (rightEndDeg - rightStartDeg) * t;
    const rp = ptOnCircle(rDeg);
    const rTangentDeg = rDeg - 90;
    rightLeaves.push({
      id: `right-leaf-${i}`,
      x: rp.x,
      y: rp.y,
      rotate: r1(rTangentDeg - sideFlip * 28),
      scale,
      orderIndex: i,
    });
  }

  return {
    leftBranchPath,
    rightBranchPath,
    leftLeaves,
    rightLeaves,
  };
}

export interface LeafParticleSpec {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  gravityDy: number;
  rotateStart: number;
  rotateEnd: number;
  scale: number;
  delay: number;
  duration: number;
}

/**
 * Generates 8-10 outward-flying olive-leaf particle trajectories with slight gravity.
 */
export function generateLeafParticles(
  origin: { x: number; y: number },
  count = 9,
  seed = 1,
): LeafParticleSpec[] {
  const clamped = Math.max(8, Math.min(10, count));
  const particles: LeafParticleSpec[] = [];

  for (let i = 0; i < clamped; i += 1) {
    const hash = Math.sin((seed + 1) * 12.9898 + (i + 1) * 78.233) * 43758.5453;
    const rand = hash - Math.floor(hash);
    const hash2 = Math.sin((seed + 3) * 45.164 + (i + 7) * 19.13) * 19283.17;
    const rand2 = hash2 - Math.floor(hash2);

    const baseAngle = (Math.PI * 2 * i) / clamped + (rand - 0.5) * 0.45;
    const speed = 58 + rand2 * 56;
    const dx = r1(Math.cos(baseAngle) * speed);
    const initialDy = Math.sin(baseAngle) * speed - 22;
    const gravityDy = r1(initialDy + 48 + rand * 26);

    particles.push({
      id: `leaf-p-${seed}-${i}`,
      x: Math.round(origin.x),
      y: Math.round(origin.y),
      dx,
      dy: r1(initialDy),
      gravityDy,
      rotateStart: Math.round((rand - 0.5) * 80),
      rotateEnd: Math.round((rand - 0.5) * 80 + (i % 2 === 0 ? 190 : -190)),
      scale: r1(0.75 + rand2 * 0.45),
      delay: r1(i * 0.015),
      duration: 0.9,
    });
  }

  return particles;
}

