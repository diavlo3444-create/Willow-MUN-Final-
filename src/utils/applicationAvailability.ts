import type { Application, Department } from '../types/admin';
import type { ApplicationTrack } from './applicationForm';

export interface WebsiteApplicationFormDefinition {
  id: ApplicationTrack;
  index: string;
  departmentSlug: 'media' | 'press' | 'volunteers' | 'security';
  title: string;
  departmentLabel: string;
  wing: string;
  description: string;
  requirementsSummary: string;
}

/**
 * Canonical inventory of the exact public application forms that exist on the
 * Willow MUN website (`ApplySection.tsx`). Do not add synthetic forms here.
 */
export const WEBSITE_APPLICATION_FORMS: readonly WebsiteApplicationFormDefinition[] = [
  {
    id: 'media',
    index: '01',
    departmentSlug: 'media',
    title: 'Media Application',
    departmentLabel: 'Media',
    wing: 'Communications & Creative',
    description:
      'Photography, videography, committee reels, and visual storytelling across every session of the conference.',
    requirementsSummary: 'Camera gear details & role questions; photography examples are optional',
  },
  {
    id: 'press',
    index: '02',
    departmentSlug: 'press',
    title: 'Press Application',
    departmentLabel: 'Press',
    wing: 'Communications & Creative',
    description:
      'Committee reporting, delegate and chair interviews, diplomatic articles, and timely conference dispatches.',
    requirementsSummary: 'Optional writing samples & 5 editorial reporting questions',
  },
  {
    id: 'volunteer',
    index: '03',
    departmentSlug: 'volunteers',
    title: 'Volunteers Application',
    departmentLabel: 'Volunteers',
    wing: 'Delegate Affairs & Operations',
    description:
      'Delegate reception, floor logistics, wayfinding, policy adherence, and calm coordination throughout the venue.',
    requirementsSummary: 'Experience overview & 5 operational scenario questions',
  },
  {
    id: 'security',
    index: '04',
    departmentSlug: 'security',
    title: 'Security Application',
    departmentLabel: 'Security',
    wing: 'Delegate Affairs & Operations',
    description: 'Venue safety, access checks, responsibility, and clear communication.',
    requirementsSummary:
      'Experience summary and proof, plus 3 written questions and two yes/no disclosures',
  },
] as const;

export const WEBSITE_APPLICATION_SLUGS = WEBSITE_APPLICATION_FORMS.map(
  (form) => form.departmentSlug,
);

export function findDepartmentForForm(
  form: WebsiteApplicationFormDefinition,
  departments: Department[],
): Department | undefined {
  return departments.find(
    (dept) => dept.slug.trim().toLowerCase() === form.departmentSlug,
  );
}

export interface FormSubmissionCounts {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
}

export function computeFormSubmissionCounts(
  form: WebsiteApplicationFormDefinition,
  applications: Pick<Application, 'applicationType' | 'category' | 'departmentId' | 'status'>[],
  departmentId?: string,
): FormSubmissionCounts {
  const matches = applications.filter((app) => {
    const appType = (app.applicationType || app.category || '').trim().toLowerCase();
    if (appType === form.id || appType === form.departmentSlug) {
      return true;
    }
    if (departmentId && app.departmentId === departmentId) {
      return form.id !== 'media' && form.id !== 'press';
    }
    return false;
  });

  return {
    total: matches.length,
    pending: matches.filter((a) => a.status === 'pending').length,
    accepted: matches.filter((a) => a.status === 'accepted').length,
    rejected: matches.filter((a) => a.status === 'rejected').length,
  };
}
