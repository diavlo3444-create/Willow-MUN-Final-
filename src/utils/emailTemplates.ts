import type { Application, Department } from '../types/admin';

export interface EmailInterpolationContext {
  applicantName: string;
  email: string;
  applicationCode: string;
  departmentName: string;
  position: string;
  conferenceName: string;
  editionYear: string;
}

export function buildInterpolationContext(
  application: Application,
  departments: Department[],
  conferenceName = 'Willow MUN',
  editionYear = '2026',
): EmailInterpolationContext {
  const dept = departments.find((d) => d.id === application.departmentId);
  return {
    applicantName: application.applicantName,
    email: application.email,
    applicationCode: application.applicationCode,
    departmentName: dept?.name ?? application.departmentId,
    position: application.position,
    conferenceName,
    editionYear,
  };
}

export function renderEmailTemplateText(
  templateText: string,
  ctxOrApp: EmailInterpolationContext | Application,
  departmentName?: string,
  conferenceYear = '2026',
): string {
  const isContext = (v: EmailInterpolationContext | Application): v is EmailInterpolationContext =>
    'applicantName' in v && !('applicationCode' in v && 'documents' in v);

  const applicantName = ctxOrApp.applicantName;
  const email = ctxOrApp.email;
  const applicationCode = ctxOrApp.applicationCode;
  const deptName = isContext(ctxOrApp)
    ? ctxOrApp.departmentName
    : departmentName ?? ctxOrApp.departmentId;
  const position = ctxOrApp.position;
  const conferenceName = isContext(ctxOrApp) ? ctxOrApp.conferenceName : 'Willow MUN';
  const editionYear = isContext(ctxOrApp) ? ctxOrApp.editionYear : conferenceYear;
  const signupLink =
    !isContext(ctxOrApp) && ctxOrApp.signupLinkToken
      ? `https://willowmun.org/signup/${ctxOrApp.signupLinkToken}`
      : '';

  return templateText
    .replaceAll('{{name}}', applicantName)
    .replaceAll('{{applicantName}}', applicantName)
    .replaceAll('{{applicant_name}}', applicantName)
    .replaceAll('{{email}}', email)
    .replaceAll('{{applicationId}}', applicationCode)
    .replaceAll('{{application_id}}', applicationCode)
    .replaceAll('{{department}}', deptName)
    .replaceAll('{{department_name}}', deptName)
    .replaceAll('{{position}}', position)
    .replaceAll('{{conferenceName}}', conferenceName)
    .replaceAll('{{year}}', editionYear)
    .replaceAll('{{conference_year}}', editionYear)
    .replaceAll('{{signup_link}}', signupLink);
}

export function validateEmailDraft(subject: string, body: string, recipientCount: number): string | null {
  if (!subject.trim()) return 'Email subject is required.';
  if (!body.trim()) return 'Email body cannot be empty.';
  if (recipientCount <= 0) return 'Select at least one recipient before sending.';
  return null;
}
