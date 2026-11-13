/**
 * Central conference configuration.
 * Replace "TBA" values here with confirmed details when ready.
 */

export interface CommitteePlaceholder {
  id: string;
  name: string;
  agenda: string;
  chairs: string;
}

export interface ExecutiveRole {
  id: string;
  role: string;
  holder: string;
}

export interface UpdateEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
}

export interface ContactItem {
  id: string;
  label: string;
  value: string;
}

export const CONFERENCE_DATA = {
  brand: {
    shortTitle: 'MUN',
    fullTitle: 'Model United Nations',
    logoSrc: '/assets/logo-transparent.png',
    videoSrc: '/assets/aistudio/WhatsApp_Video_2026-11-13_at_2.42.17_PM_4c81d0c1.mp4',
    posterSrc: '/assets/video-poster.jpg',
  },

  navLinks: [
    { href: '#about', label: 'About' },
    { href: '#committees', label: 'Committees' },
    { href: '#executive-board', label: 'Executive Board' },
    { href: '#updates', label: 'Updates' },
    { href: '#apply', label: 'Apply' },
  ],

  hero: {
    headlinePrefix: 'Model United Nations,',
    headlineItalic: 'details to come.',
    chips: [
      { label: 'Dates', value: 'TBA' },
      { label: 'Venue', value: 'TBA' },
      { label: 'Committees', value: 'TBA' },
    ],
    ctaLabel: 'Applications',
    ctaHref: '#apply',
  },

  about: {
    heading: 'About the conference',
    paragraphs: [
      'A youth-led Model United Nations conference bringing delegates together to debate pressing international questions, negotiate across perspectives, and build lasting coalitions.',
      'The official conference name, guiding theme, and full mission statement are currently TBA and will be shared ahead of the opening of applications.',
    ],
  },

  committees: {
    heading: 'Committees',
    items: [
      { id: 'committee-1', name: 'Committee', agenda: 'TBA', chairs: 'TBA' },
      { id: 'committee-2', name: 'Committee', agenda: 'TBA', chairs: 'TBA' },
      { id: 'committee-3', name: 'Committee', agenda: 'TBA', chairs: 'TBA' },
      { id: 'committee-4', name: 'Committee', agenda: 'TBA', chairs: 'TBA' },
    ] satisfies CommitteePlaceholder[],
  },

  executiveBoard: {
    heading: 'Executive Board',
    roles: [
      { id: 'sg', role: 'Secretary-General', holder: 'TBA' },
      { id: 'dsg', role: 'Deputy Secretary-General', holder: 'TBA' },
      { id: 'ga', role: 'General Advisor', holder: 'TBA' },
      { id: 'hod', role: 'Heads of Departments', holder: 'TBA' },
    ] satisfies ExecutiveRole[],
  },

  updates: {
    heading: 'Updates',
    entries: [
      {
        id: 'update-applications',
        date: 'Date TBA',
        title: 'Delegate and chair applications',
        summary: 'Opening date to be announced.',
      },
      {
        id: 'update-dates-venue',
        date: 'Date TBA',
        title: 'Conference dates and venue',
        summary: 'To be announced.',
      },
    ] satisfies UpdateEntry[],
  },

  apply: {
    heading: 'Apply',
    description:
      'Applications are not open yet. The opening date, delegate fees, and application requirements are TBA.',
    buttonLabel: 'Applications opening soon',
    contacts: [
      { id: 'instagram', label: 'Instagram', value: 'TBA' },
      { id: 'email', label: 'Email', value: 'TBA' },
      { id: 'location', label: 'Location', value: 'TBA' },
    ] satisfies ContactItem[],
  },

  footer: {
    caption: 'Model United Nations · Name, dates and venue TBA',
  },
} as const;
