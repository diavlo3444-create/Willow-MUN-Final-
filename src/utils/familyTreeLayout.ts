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

export interface BranchTipPoint {
  x: number;
  y: number;
  direction: -1 | 0 | 1;
  memberId: string;
}

export interface SvgConnectorPath {
  id: string;
  d: string;
  stageOrder: number;
  level: 0 | 1 | 2;
  groupId: string;
  memberId?: string;
  swayDuration: number;
  swayDelay: number;
  swayOrigin: { x: number; y: number };
  tip?: BranchTipPoint;
}

export interface DesktopGroupMeasurement {
  groupId: string;
  side: 'left' | 'right';
  labelRect: RectBox | null;
  memberRects: RectBox[];
  memberIds?: string[];
}

export interface MobileGroupMeasurement {
  groupId: string;
  labelRect: RectBox | null;
  memberRects: RectBox[];
  memberIds?: string[];
}

export interface DesktopPedigreeOptions {
  centerMemberIds?: string[];
  secretariatLabelRect?: RectBox | null;
}

export interface RootToMemberSegments {
  /** Path from SECRETARIAT root down trunk and out to the department label edge */
  rootToLabelD: string;
  /** Path from opposite department label edge through bracket spine and tick to the card edge */
  labelToCardD: string;
  /** Timing split ratio (0..1) so sap flows seamlessly across the label gap */
  splitRatio: number;
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

function normalizePhotoPath(photo: string | null | undefined): string | null {
  if (!photo || photo.trim().length === 0) return null;
  const trimmed = photo.trim();
  return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
}

/**
 * Maps `photos/<slug>.jpg` to the pre-encoded 96x96 WebP thumbnail (`/photos/thumbs/<slug>.webp`).
 */
export function resolveMemberThumbSrc(photo: string | null | undefined): string | null {
  const norm = normalizePhotoPath(photo);
  if (!norm) return null;
  const file = norm.split('/').pop() ?? norm;
  const base = file.replace(/\.[^.]+$/, '');
  return `/photos/thumbs/${base}.webp`;
}

/**
 * Maps `photos/<slug>.jpg` to the pre-encoded 240x240 WebP portrait (`/photos/portraits/<slug>.webp`).
 */
export function resolveMemberPortraitSrc(photo: string | null | undefined): string | null {
  const norm = normalizePhotoPath(photo);
  if (!norm) return null;
  const file = norm.split('/').pop() ?? norm;
  const base = file.replace(/\.[^.]+$/, '');
  return `/photos/portraits/${base}.webp`;
}

/**
 * Fallback original asset URL (`/photos/<slug>.jpg`).
 */
export function resolveMemberFallbackSrc(photo: string | null | undefined): string | null {
  const norm = normalizePhotoPath(photo);
  return norm ? `/${norm}` : null;
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

  const centerGroups = centerRaw
    .map((g) => groupMap.get(g.id)!)
    .filter((gw) => gw.members.length > 0);
  const leftGroups = leftRaw
    .map((g) => groupMap.get(g.id)!)
    .filter((gw) => gw.members.length > 0);
  const rightGroups = rightRaw
    .map((g) => groupMap.get(g.id)!)
    .filter((gw) => gw.members.length > 0);

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

function seededUnit(seed: number): number {
  const raw = Math.sin(seed * 91.3458 + 17.13) * 47453.5453;
  return raw - Math.floor(raw);
}

/**
 * Computes orthogonal pedigree bracket and trunk SVG path descriptors from real DOM rects (>= 900px)
 * with grow-in hierarchy levels, deterministic idle sway timings, and branch-tip leaf coordinates.
 */
export function computeDesktopPedigreePaths(
  centerMemberRects: RectBox[],
  sideGroups: DesktopGroupMeasurement[],
  fallbackTrunkX: number,
  options?: DesktopPedigreeOptions,
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

  const secretariatLabelRect = options?.secretariatLabelRect ?? null;
  const rootAnchorY = secretariatLabelRect
    ? secretariatLabelRect.bottom
    : centerMemberRects.length > 0
      ? Math.min(...centerMemberRects.map((r) => centerY(r)))
      : branchYs.length > 0
        ? Math.min(...branchYs)
        : 0;

  // Center vertical trunk: grows outward from SECRETARIAT root node
  if (centerMemberRects.length > 0 || branchYs.length > 0) {
    const centerTop =
      centerMemberRects.length > 0
        ? Math.min(...centerMemberRects.map((r) => centerY(r)))
        : Math.min(...branchYs);
    const centerBottom =
      centerMemberRects.length > 0
        ? Math.max(...centerMemberRects.map((r) => centerY(r)))
        : Math.max(...branchYs);

    const minY = Math.min(
      centerTop,
      ...(branchYs.length > 0 ? branchYs : [centerTop]),
      ...(secretariatLabelRect ? [rootAnchorY] : []),
    );
    const maxY = Math.max(
      centerBottom,
      ...(branchYs.length > 0 ? branchYs : [centerBottom]),
      ...(secretariatLabelRect ? [rootAnchorY] : []),
    );

    if (maxY > minY) {
      const startY = secretariatLabelRect ? Math.max(minY, Math.min(maxY, rootAnchorY)) : minY;
      const trunkD =
        secretariatLabelRect && startY > minY + 1
          ? `M ${r1(trunkX)} ${r1(startY)} V ${r1(minY)} M ${r1(trunkX)} ${r1(startY)} V ${r1(maxY)}`
          : `M ${r1(trunkX)} ${r1(minY)} V ${r1(maxY)}`;

      paths.push({
        id: 'desktop-trunk',
        d: trunkD,
        stageOrder: 0,
        level: 0,
        groupId: 'secretariat',
        swayDuration: 6.2,
        swayDelay: 0.2,
        swayOrigin: { x: r1(trunkX), y: r1(startY) },
      });
    }
  }

  // Optional subtle center ticks / tip anchor points for center Secretariat members
  const centerMemberIds = options?.centerMemberIds ?? [];
  centerMemberRects.forEach((mRect, idx) => {
    const mId = centerMemberIds[idx];
    if (!mId) return;
    paths.push({
      id: `tick-secretariat-${idx}`,
      d: `M ${r1(trunkX)} ${r1(Math.max(rootAnchorY, mRect.top - 10))} V ${r1(mRect.top)}`,
      stageOrder: 0.45 + idx * 0.12,
      level: 2,
      groupId: 'secretariat',
      memberId: mId,
      swayDuration: 5.4,
      swayDelay: idx * 0.35,
      swayOrigin: { x: r1(trunkX), y: r1(mRect.top) },
      tip: {
        x: r1(trunkX),
        y: r1(mRect.top),
        direction: 0,
        memberId: mId,
      },
    });
  });

  // Side group horizontal branches -> label -> bracket spine -> member box ticks
  sideGroups.forEach((group, groupIdx) => {
    const { groupId, side, labelRect, memberRects, memberIds } = group;
    if (!labelRect || memberRects.length === 0) return;

    const labelCy = centerY(labelRect);
    const swayDuration = r1(4.2 + seededUnit(groupIdx + 3) * 2.6);
    const swayDelay = r1(seededUnit(groupIdx + 19) * 2.4);
    const swayOrigin = { x: r1(trunkX), y: r1(labelCy) };
    const baseOrder = 1 + groupIdx;

    if (side === 'left') {
      if (trunkX > labelRect.right) {
        paths.push({
          id: `branch-${groupId}`,
          d: `M ${r1(trunkX)} ${r1(labelCy)} H ${r1(labelRect.right)}`,
          stageOrder: baseOrder,
          level: 1,
          groupId,
          swayDuration,
          swayDelay,
          swayOrigin,
        });
      }

      const maxMemberRight = Math.max(...memberRects.map((r) => r.right));
      const spineX = maxMemberRight + (labelRect.left - maxMemberRight) * 0.5;
      const memberCys = memberRects.map(centerY);
      const minCy = Math.min(...memberCys);
      const maxCy = Math.max(...memberCys);
      const bracketMidY = (minCy + maxCy) / 2;

      if (Math.abs(labelCy - bracketMidY) < 1.5) {
        paths.push({
          id: `stem-${groupId}`,
          d: `M ${r1(labelRect.left)} ${r1(labelCy)} H ${r1(spineX)}`,
          stageOrder: baseOrder + 1,
          level: 2,
          groupId,
          swayDuration,
          swayDelay,
          swayOrigin,
        });
      } else {
        paths.push({
          id: `stem-${groupId}`,
          d: `M ${r1(labelRect.left)} ${r1(labelCy)} H ${r1((labelRect.left + spineX) / 2)} V ${r1(bracketMidY)} H ${r1(spineX)}`,
          stageOrder: baseOrder + 1,
          level: 2,
          groupId,
          swayDuration,
          swayDelay,
          swayOrigin,
        });
      }

      if (maxCy - minCy > 1) {
        paths.push({
          id: `spine-${groupId}`,
          d: `M ${r1(spineX)} ${r1(minCy)} V ${r1(maxCy)}`,
          stageOrder: baseOrder + 1.4,
          level: 2,
          groupId,
          swayDuration,
          swayDelay,
          swayOrigin,
        });
      }

      memberRects.forEach((mRect, mIdx) => {
        const cy = centerY(mRect);
        const mId = memberIds?.[mIdx];
        paths.push({
          id: `tick-${groupId}-${mIdx}`,
          d: `M ${r1(spineX)} ${r1(cy)} H ${r1(mRect.right)}`,
          stageOrder: baseOrder + 2 + mIdx * 0.25,
          level: 2,
          groupId,
          memberId: mId,
          swayDuration,
          swayDelay,
          swayOrigin,
          tip: mId
            ? {
                x: r1(mRect.right),
                y: r1(cy),
                direction: -1,
                memberId: mId,
              }
            : undefined,
        });
      });
    } else {
      if (labelRect.left > trunkX) {
        paths.push({
          id: `branch-${groupId}`,
          d: `M ${r1(trunkX)} ${r1(labelCy)} H ${r1(labelRect.left)}`,
          stageOrder: baseOrder,
          level: 1,
          groupId,
          swayDuration,
          swayDelay,
          swayOrigin,
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
          level: 2,
          groupId,
          swayDuration,
          swayDelay,
          swayOrigin,
        });
      } else {
        paths.push({
          id: `stem-${groupId}`,
          d: `M ${r1(labelRect.right)} ${r1(labelCy)} H ${r1((labelRect.right + spineX) / 2)} V ${r1(bracketMidY)} H ${r1(spineX)}`,
          stageOrder: baseOrder + 1,
          level: 2,
          groupId,
          swayDuration,
          swayDelay,
          swayOrigin,
        });
      }

      if (maxCy - minCy > 1) {
        paths.push({
          id: `spine-${groupId}`,
          d: `M ${r1(spineX)} ${r1(minCy)} V ${r1(maxCy)}`,
          stageOrder: baseOrder + 1.4,
          level: 2,
          groupId,
          swayDuration,
          swayDelay,
          swayOrigin,
        });
      }

      memberRects.forEach((mRect, mIdx) => {
        const cy = centerY(mRect);
        const mId = memberIds?.[mIdx];
        paths.push({
          id: `tick-${groupId}-${mIdx}`,
          d: `M ${r1(spineX)} ${r1(cy)} H ${r1(mRect.left)}`,
          stageOrder: baseOrder + 2 + mIdx * 0.25,
          level: 2,
          groupId,
          memberId: mId,
          swayDuration,
          swayDelay,
          swayOrigin,
          tip: mId
            ? {
                x: r1(mRect.left),
                y: r1(cy),
                direction: 1,
                memberId: mId,
              }
            : undefined,
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
      level: 0,
      groupId: groups[0]?.groupId ?? 'secretariat',
      swayDuration: 6.0,
      swayDelay: 0.2,
      swayOrigin: { x: r1(trunkX), y: r1(minY) },
    });
  }

  groups.forEach((group, groupIdx) => {
    const { groupId, labelRect, memberRects, memberIds } = group;
    if (!labelRect) return;

    const labelCy = centerY(labelRect);
    const baseOrder = 1 + groupIdx * 0.5;
    const swayDuration = r1(4.3 + seededUnit(groupIdx + 11) * 2.4);
    const swayDelay = r1(seededUnit(groupIdx + 29) * 2.1);
    const swayOrigin = { x: r1(trunkX), y: r1(labelCy) };

    if (labelRect.left > trunkX) {
      paths.push({
        id: `mobile-branch-${groupId}`,
        d: `M ${r1(trunkX)} ${r1(labelCy)} H ${r1(labelRect.left)}`,
        stageOrder: baseOrder,
        level: 1,
        groupId,
        swayDuration,
        swayDelay,
        swayOrigin,
      });
    }

    if (memberRects.length === 0) return;

    const minMemberLeft = Math.min(...memberRects.map((r) => r.left));
    const subX = Math.max(trunkX + 12, Math.min(minMemberLeft - 12, labelRect.left + 10));
    const lastMemberCy = centerY(memberRects[memberRects.length - 1]);

    if (lastMemberCy > labelRect.bottom) {
      paths.push({
        id: `mobile-subtrunk-${groupId}`,
        d: `M ${r1(subX)} ${r1(labelRect.bottom)} V ${r1(lastMemberCy)}`,
        stageOrder: baseOrder + 0.2,
        level: 2,
        groupId,
        swayDuration,
        swayDelay,
        swayOrigin,
      });
    }

    memberRects.forEach((mRect, mIdx) => {
      const mCy = centerY(mRect);
      const mId = memberIds?.[mIdx];
      paths.push({
        id: `mobile-l-${groupId}-${mIdx}`,
        d: `M ${r1(subX)} ${r1(mCy)} H ${r1(mRect.left)}`,
        stageOrder: baseOrder + 0.4 + mIdx * 0.15,
        level: 2,
        groupId,
        memberId: mId,
        swayDuration,
        swayDelay,
        swayOrigin,
        tip: mId
          ? {
              x: r1(mRect.left),
              y: r1(mCy),
              direction: 1,
              memberId: mId,
            }
          : undefined,
      });
    });
  });

  return paths;
}

/**
 * Traces the full root-to-card branch in TWO clean visible segments (trunk->label edge and label edge->card edge)
 * so glowing sap/highlights never draw over transparent department text labels.
 */
export function computeDesktopRootToMemberSegments(
  memberRect: RectBox,
  side: GroupSide,
  groupId: string,
  centerMemberRects: RectBox[],
  secretariatLabelRect: RectBox | null,
  sideGroups: DesktopGroupMeasurement[],
  fallbackTrunkX: number,
): RootToMemberSegments {
  const trunkX =
    centerMemberRects.length > 0
      ? centerMemberRects.reduce((acc, r) => acc + centerX(r), 0) / centerMemberRects.length
      : fallbackTrunkX;

  const rootY = secretariatLabelRect
    ? secretariatLabelRect.bottom
    : centerMemberRects.length > 0
      ? Math.min(...centerMemberRects.map((r) => centerY(r)))
      : memberRect.top;

  const mCy = centerY(memberRect);

  if (side === 'center') {
    const endY = mCy > rootY ? memberRect.top : mCy;
    return {
      rootToLabelD: `M ${r1(trunkX)} ${r1(rootY)} V ${r1(endY)}`,
      labelToCardD: '',
      splitRatio: 1,
    };
  }

  const group = sideGroups.find((g) => g.groupId === groupId);
  if (!group || !group.labelRect || group.memberRects.length === 0) {
    const endX = side === 'left' ? memberRect.right : memberRect.left;
    return {
      rootToLabelD: `M ${r1(trunkX)} ${r1(rootY)} V ${r1(mCy)} H ${r1(endX)}`,
      labelToCardD: '',
      splitRatio: 1,
    };
  }

  const { labelRect, memberRects } = group;
  const labelCy = centerY(labelRect);
  const memberCys = memberRects.map(centerY);
  const bracketMidY = (Math.min(...memberCys) + Math.max(...memberCys)) / 2;

  if (side === 'left') {
    const rootParts: string[] = [`M ${r1(trunkX)} ${r1(rootY)}`];
    if (Math.abs(labelCy - rootY) >= 1) {
      rootParts.push(`V ${r1(labelCy)}`);
    }
    if (trunkX > labelRect.right) {
      rootParts.push(`H ${r1(labelRect.right)}`);
    }

    const maxMemberRight = Math.max(...memberRects.map((r) => r.right));
    const spineX = maxMemberRight + (labelRect.left - maxMemberRight) * 0.5;
    const cardParts: string[] = [`M ${r1(labelRect.left)} ${r1(labelCy)}`];

    if (Math.abs(labelCy - bracketMidY) < 1.5) {
      cardParts.push(`H ${r1(spineX)}`);
    } else {
      cardParts.push(
        `H ${r1((labelRect.left + spineX) / 2)}`,
        `V ${r1(bracketMidY)}`,
        `H ${r1(spineX)}`,
      );
    }
    if (Math.abs(mCy - bracketMidY) >= 1) {
      cardParts.push(`V ${r1(mCy)}`);
    }
    cardParts.push(`H ${r1(memberRect.right)}`);

    return {
      rootToLabelD: rootParts.join(' '),
      labelToCardD: cardParts.join(' '),
      splitRatio: 0.48,
    };
  }

  // side === 'right'
  const rootParts: string[] = [`M ${r1(trunkX)} ${r1(rootY)}`];
  if (Math.abs(labelCy - rootY) >= 1) {
    rootParts.push(`V ${r1(labelCy)}`);
  }
  if (labelRect.left > trunkX) {
    rootParts.push(`H ${r1(labelRect.left)}`);
  }

  const minMemberLeft = Math.min(...memberRects.map((r) => r.left));
  const spineX = labelRect.right + (minMemberLeft - labelRect.right) * 0.5;
  const cardParts: string[] = [`M ${r1(labelRect.right)} ${r1(labelCy)}`];

  if (Math.abs(labelCy - bracketMidY) < 1.5) {
    cardParts.push(`H ${r1(spineX)}`);
  } else {
    cardParts.push(
      `H ${r1((labelRect.right + spineX) / 2)}`,
      `V ${r1(bracketMidY)}`,
      `H ${r1(spineX)}`,
    );
  }
  if (Math.abs(mCy - bracketMidY) >= 1) {
    cardParts.push(`V ${r1(mCy)}`);
  }
  cardParts.push(`H ${r1(memberRect.left)}`);

  return {
    rootToLabelD: rootParts.join(' '),
    labelToCardD: cardParts.join(' '),
    splitRatio: 0.48,
  };
}

/**
 * Traces the full mobile root-to-card branch in two segments (trunk->label left edge and label bottom->member left edge).
 */
export function computeMobileRootToMemberSegments(
  memberRect: RectBox,
  groupId: string,
  mobileGroups: MobileGroupMeasurement[],
  trunkX = 10,
): RootToMemberSegments {
  const secretariatGroup = mobileGroups[0];
  const rootY = secretariatGroup?.labelRect ? centerY(secretariatGroup.labelRect) : 20;
  const mCy = centerY(memberRect);

  const group = mobileGroups.find((g) => g.groupId === groupId);
  if (!group || !group.labelRect || group.memberRects.length === 0) {
    return {
      rootToLabelD: `M ${r1(trunkX)} ${r1(rootY)} V ${r1(mCy)} H ${r1(memberRect.left)}`,
      labelToCardD: '',
      splitRatio: 1,
    };
  }

  const { labelRect, memberRects } = group;
  const labelCy = centerY(labelRect);
  const minMemberLeft = Math.min(...memberRects.map((r) => r.left));
  const subX = Math.max(trunkX + 12, Math.min(minMemberLeft - 12, labelRect.left + 10));

  const rootParts: string[] = [`M ${r1(trunkX)} ${r1(rootY)}`];
  if (Math.abs(labelCy - rootY) >= 1) {
    rootParts.push(`V ${r1(labelCy)}`);
  }
  if (labelRect.left > trunkX) {
    rootParts.push(`H ${r1(labelRect.left)}`);
  }

  const cardParts: string[] = [
    `M ${r1(subX)} ${r1(labelRect.bottom)}`,
    `V ${r1(mCy)}`,
    `H ${r1(memberRect.left)}`,
  ];

  return {
    rootToLabelD: rootParts.join(' '),
    labelToCardD: cardParts.join(' '),
    splitRatio: 0.45,
  };
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

  const nudgeX = (stageWidth / 2 - bx) * 0.25;
  const nudgeY = Math.max(-80, Math.min(80, (stageHeight / 2 - by) * 0.12));

  return {
    transformOrigin: `${r1(bx)}px ${r1(by)}px`,
    transform: `translate3d(${r1(nudgeX)}px, ${r1(nudgeY)}px, 0) scale(${scale})`,
  };
}

/**
 * Legacy-compatible single-string root-to-member helper (used in unit tests).
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
  const seg = computeDesktopRootToMemberSegments(
    memberRect,
    side,
    groupId,
    centerMemberRects,
    secretariatLabelRect,
    sideGroups,
    fallbackTrunkX,
  );
  return seg.labelToCardD ? `${seg.rootToLabelD} ${seg.labelToCardD}` : seg.rootToLabelD;
}

export function computeMobileGoldTravelPath(
  memberRect: RectBox,
  groupId: string,
  mobileGroups: MobileGroupMeasurement[],
  trunkX = 10,
): string {
  const seg = computeMobileRootToMemberSegments(memberRect, groupId, mobileGroups, trunkX);
  return seg.labelToCardD ? `${seg.rootToLabelD} ${seg.labelToCardD}` : seg.rootToLabelD;
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

  const leftStartDeg = 103;
  const leftEndDeg = 256;
  const ls = ptOnCircle(leftStartDeg);
  const le = ptOnCircle(leftEndDeg);
  const leftBranchPath = `M ${ls.x} ${ls.y} A ${radius} ${radius} 0 0 1 ${le.x} ${le.y}`;

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

export interface TipLeafSpec {
  id: string;
  rotate: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  flutterDuration: number;
  flutterDelay: number;
}

/**
 * Generates 2-3 small olive leaf sprouts positioned around a branch tip point.
 */
export function generateTipLeafSpecs(tip: BranchTipPoint): TipLeafSpec[] {
  const hash = seededUnit(tip.x * 0.13 + tip.y * 0.29);
  const leafCount = hash > 0.42 ? 3 : 2;

  const baseAngle =
    tip.direction === -1
      ? -90 // Left card right edge -> radiate slightly up/left/down around edge
      : tip.direction === 1
        ? 90 // Right card left edge -> radiate slightly around edge
        : 0; // Center card top edge -> radiate upward

  const angles = leafCount === 3 ? [-42, 0, 42] : [-28, 28];

  return angles.map((offsetAngle, idx) => {
    const u = seededUnit(tip.x + tip.y + idx * 7);
    const rot = baseAngle + offsetAngle + (u - 0.5) * 14;
    const offsetX = tip.direction === 0 ? 0 : r1(tip.direction * -4.5);
    const offsetY =
      tip.direction === 0
        ? -3
        : idx === 0
          ? -1.5
          : idx === 1
            ? 1.5
            : 0;
    return {
      id: `${tip.memberId}-tip-leaf-${idx}`,
      rotate: r1(rot),
      offsetX,
      offsetY,
      scale: r1(0.95 + u * 0.28),
      flutterDuration: r1(3.8 + u * 2.4),
      flutterDelay: r1(u * 2.0),
    };
  });
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
 * Generates 10-14 outward-flying olive-leaf particle trajectories that drift downward with rotation and fade.
 */
export function generateLeafParticles(
  origin: { x: number; y: number },
  count = 12,
  seed = 1,
): LeafParticleSpec[] {
  const clamped = Math.max(10, Math.min(14, count));
  const particles: LeafParticleSpec[] = [];

  for (let i = 0; i < clamped; i += 1) {
    const hash = Math.sin((seed + 1) * 12.9898 + (i + 1) * 78.233) * 43758.5453;
    const rand = hash - Math.floor(hash);
    const hash2 = Math.sin((seed + 3) * 45.164 + (i + 7) * 19.13) * 19283.17;
    const rand2 = hash2 - Math.floor(hash2);

    const baseAngle = (Math.PI * 2 * i) / clamped + (rand - 0.5) * 0.42;
    const speed = 64 + rand2 * 62;
    const dx = r1(Math.cos(baseAngle) * speed);
    const initialDy = Math.sin(baseAngle) * speed * 0.72 - 24;
    const gravityDy = r1(initialDy + 74 + rand * 38);

    particles.push({
      id: `leaf-p-${seed}-${i}`,
      x: Math.round(origin.x),
      y: Math.round(origin.y),
      dx,
      dy: r1(initialDy),
      gravityDy,
      rotateStart: Math.round((rand - 0.5) * 90),
      rotateEnd: Math.round((rand - 0.5) * 90 + (i % 2 === 0 ? 220 : -220)),
      scale: r1(0.8 + rand2 * 0.48),
      delay: r1(i * 0.014),
      duration: 1.05,
    });
  }

  return particles;
}

export interface CameraTransformInput {
  cardRect: Pick<RectBox, 'left' | 'top' | 'width' | 'height'>;
  chartRect: Pick<RectBox, 'left' | 'top'>;
  viewportWidth: number;
  viewportHeight: number;
  currentTx?: number;
  currentTy?: number;
  currentScale?: number;
  targetScale?: number;
}

export interface CameraTransformResult {
  tx: number;
  ty: number;
  scale: number;
  transform: string;
}

/**
 * Computes a single `translate3d(tx, ty, 0) scale(targetScale)` transform for a chart wrapper
 * with `transform-origin: 0 0` so the target card ends up centered in the viewport.
 */
export function computeCenteredCameraTransform({
  cardRect,
  chartRect,
  viewportWidth,
  viewportHeight,
  currentTx = 0,
  currentTy = 0,
  currentScale = 1,
  targetScale = 1.5,
}: CameraTransformInput): CameraTransformResult {
  const safeCurScale = currentScale > 0 ? currentScale : 1;
  const baseChartLeft = chartRect.left - currentTx;
  const baseChartTop = chartRect.top - currentTy;

  const localCardCx = (cardRect.left + cardRect.width / 2 - chartRect.left) / safeCurScale;
  const localCardCy = (cardRect.top + cardRect.height / 2 - chartRect.top) / safeCurScale;

  const tx = r1(viewportWidth / 2 - baseChartLeft - targetScale * localCardCx);
  const ty = r1(viewportHeight / 2 - baseChartTop - targetScale * localCardCy);

  return {
    tx,
    ty,
    scale: targetScale,
    transform: `translate3d(${tx}px, ${ty}px, 0) scale(${targetScale})`,
  };
}

export interface FlipMetricsResult {
  panelFromTransform: string;
  panelToTransform: string;
  cloneToTransform: string;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
}

/**
 * Computes FLIP transforms (around `50% 50%` center origin) between a fixed-position card rect
 * and the final centered profile panel rect.
 */
export function computeFlipCardToPanel(
  cardRect: Pick<RectBox, 'left' | 'top' | 'width' | 'height'>,
  panelRect: Pick<RectBox, 'left' | 'top' | 'width' | 'height'>,
): FlipMetricsResult {
  const cardCx = cardRect.left + cardRect.width / 2;
  const cardCy = cardRect.top + cardRect.height / 2;
  const panelCx = panelRect.left + panelRect.width / 2;
  const panelCy = panelRect.top + panelRect.height / 2;

  const dx = r1(cardCx - panelCx);
  const dy = r1(cardCy - panelCy);

  const safePanelW = Math.max(1, panelRect.width);
  const safePanelH = Math.max(1, panelRect.height);
  const safeCardW = Math.max(1, cardRect.width);
  const safeCardH = Math.max(1, cardRect.height);

  const sx = Number((safeCardW / safePanelW).toFixed(4));
  const sy = Number((safeCardH / safePanelH).toFixed(4));
  const invSx = Number((safePanelW / safeCardW).toFixed(4));
  const invSy = Number((safePanelH / safeCardH).toFixed(4));

  return {
    dx,
    dy,
    sx,
    sy,
    panelFromTransform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`,
    panelToTransform: 'translate3d(0, 0, 0) scale(1, 1)',
    cloneToTransform: `translate3d(${r1(-dx)}px, ${r1(-dy)}px, 0) scale(${invSx}, ${invSy})`,
  };
}


