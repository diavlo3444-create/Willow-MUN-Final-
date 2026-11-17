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
