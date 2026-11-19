import { supabase } from '../lib/supabase';
import { WEBSITE_APPLICATION_SLUGS } from '../utils/applicationAvailability';

export {
  WEBSITE_APPLICATION_FORMS,
  WEBSITE_APPLICATION_SLUGS,
  computeFormSubmissionCounts,
  findDepartmentForForm,
  type FormSubmissionCounts,
  type WebsiteApplicationFormDefinition,
} from '../utils/applicationAvailability';

export interface ApplicationAvailabilityResult {
  statusMap: Record<string, boolean>;
  returnedSlugs: string[];
  error: string | null;
}

/**
 * Reads public registration_open flags from Supabase `wm_departments`.
 * Works for anonymous public visitors as well as authenticated admins.
 */
export async function fetchPublicApplicationAvailability(): Promise<ApplicationAvailabilityResult> {
  const { data, error } = await supabase
    .from('wm_departments')
    .select('slug,registration_open')
    .in('slug', WEBSITE_APPLICATION_SLUGS);

  if (error) {
    return {
      statusMap: {},
      returnedSlugs: [],
      error: error.message,
    };
  }

  const statusMap: Record<string, boolean> = {};
  const returnedSlugs: string[] = [];
  for (const row of data ?? []) {
    const slug = String(row.slug || '').trim().toLowerCase();
    if (!slug) continue;
    statusMap[slug] = row.registration_open === true;
    returnedSlugs.push(slug);
  }

  return {
    statusMap,
    returnedSlugs,
    error: null,
  };
}
