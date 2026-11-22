/**
 * Central Willow MUN conference configuration.
 * Conference dates are confirmed; venue and other unannounced details remain marked "TBA".
 */

export interface CommitteeItem {
  id: string;
  chamber: string;
  name: string;
  details: string;
}

export interface TeamDepartment {
  id: string;
  name: string;
  role: string;
  holder: string;
}

export interface TeamGroup {
  id: string;
  title: string;
  departments: TeamDepartment[];
}

export interface UpdateEntry {
  id: string;
  badge: string;
  title: string;
  summary: string;
}

export const CONFERENCE_DATA = {
  brand: {
    name: 'Willow MUN',
    fullName: 'Willow Model United Nations',
    year: '2027',
    logoSrc: '/assets/logo-transparent.png',
    introVideoSrc: '/assets/aistudio/willow-intro-grow.mp4',
    mobileIntroVideoSrc: '/willow-intro-mobile.mp4',
    videoWebmSrc: '/willow-loop.webm',
    videoSrc: '/assets/aistudio/Trees_swaying_and_birds_flying_afb28949_d2f42073.mp4',
    mobileVideoSrc: '/willow-loop-mobile.mp4',
    posterSrc: '/willow-poster.jpg',
    mobilePosterSrc: '/willow-poster-mobile.jpg',
  },

  navLinks: [
    { href: '#about', label: 'Charter' },
    { href: '#committees', label: 'Committees' },
    { href: '#executive-board', label: 'Secretariat' },
    { href: '#updates', label: 'Dispatches' },
    { href: '#apply', label: 'Apply' },
  ],

  hero: {
    stackTop: 'WIL',
    stackBottom: 'LOW',
    subBrand: 'MUN',
    fullTitle: 'Willow Model United Nations',
    thesis:
      'An international youth diplomatic assembly built on rigorous preparation, nuanced coalition-building, and deliberation across borders.',
    ctaLabel: 'Apply to Join',
    ctaHref: '#apply',
  },

  about: {
    label: 'Conference Theme & Charter',
    themeQuote:
      'To bend with conviction is not to yield — like the willow, enduring diplomacy draws its strength from deep roots and quiet flexibility.',
    themeMeaning:
      'Inspired by the resilience of the weeping willow, our inaugural session asks delegates to balance principled advocacy with the humility to listen, revise, and forge lasting multilateral consensus.',
    paragraphs: [
      'Willow MUN is a youth-led Model United Nations conference dedicated to thoughtful debate, diplomatic negotiation, and principled coalition-building across borders.',
    ],
  },

  globalStage: {
    label: 'The Global Stage',
    description:
      'Delegates convene to examine pressing international questions, draft nuanced resolutions, and engage in multilateral diplomacy across diverse committees.',
    stats: [
      { id: 'committees', label: 'Committees', value: 'TBA', isTba: true },
      { id: 'year', label: 'Conference Year', value: '2027', isTba: false },
      { id: 'venue', label: 'Venue', value: 'TBA', isTba: true },
    ],
  },

  committees: {
    label: 'Conference Committees',
    items: [
      { id: 'chamber-01', chamber: 'Chamber 01', name: 'Committee', details: 'Agenda and chairs' },
      { id: 'chamber-02', chamber: 'Chamber 02', name: 'Committee', details: 'Agenda and chairs' },
      { id: 'chamber-03', chamber: 'Chamber 03', name: 'Committee', details: 'Agenda and chairs' },
      { id: 'chamber-04', chamber: 'Chamber 04', name: 'Committee', details: 'Agenda and chairs' },
      { id: 'chamber-05', chamber: 'Chamber 05', name: 'Committee', details: 'Agenda and chairs' },
      { id: 'chamber-06', chamber: 'Chamber 06', name: 'Committee', details: 'Agenda and chairs' },
    ] satisfies CommitteeItem[],
  },

  executiveBoard: {
    label: 'The People Behind It',
  },

  team: {
    label: 'Organizing Departments',
    groups: [
      {
        id: 'operations-delegate-care',
        title: 'Delegate Affairs & Operations',
        departments: [
          { id: 'hr', name: 'Human Resources', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'security', name: 'Security', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'volunteers', name: 'Volunteers', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'dcc', name: 'DCC', role: 'Department Head & Team', holder: 'TBA' },
        ],
      },
      {
        id: 'communications-creative',
        title: 'Communications & Creative',
        departments: [
          { id: 'media-press', name: 'Media & Press', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'marketing', name: 'Marketing', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'design', name: 'Design', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'pr', name: 'Public Relations', role: 'Department Head & Team', holder: 'TBA' },
        ],
      },
      {
        id: 'logistics-administration',
        title: 'Logistics & Administration',
        departments: [
          { id: 'logistics', name: 'Logistics', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'it', name: 'Information Technology', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'finance', name: 'Finance', role: 'Department Head & Team', holder: 'TBA' },
          { id: 'ceremony', name: 'Ceremony', role: 'Department Head & Team', holder: 'TBA' },
        ],
      },
    ] satisfies TeamGroup[],
  },

  updates: {
    label: 'Stay Informed',
    entries: [
      {
        id: 'delegate-chair-apps',
        badge: 'TBA',
        title: 'Delegate & Chair Applications',
        summary: 'Opening dates, application requirements, and delegate guidance will be announced here.',
      },
      {
        id: 'conference-dates',
        badge: 'March 18, 19 & 20, 2027',
        title: 'Conference Dates',
        summary: 'Willow MUN takes place March 18, 19, and 20, 2027, in Riyadh, Saudi Arabia. Venue details and the full itinerary will be announced separately.',
      },
    ] satisfies UpdateEntry[],
  },

  apply: {
    label: 'Delegate & Chair Registration',
    buttonLabel: 'Applications Opening Soon',
  },

  suggestions: {
    label: 'Have something to say?',
    description:
      'Share a suggestion, accessibility requirement, or general inquiry with the Willow MUN organizing team.',
    types: ['Suggestion', 'Requirement', 'General'] as const,
  },

  footer: {
    fullName: 'Willow Model United Nations',
    edition: 'WILLOW MUN · 2027',
    copyright: '© 2027 Willow MUN',
  },
} as const;
