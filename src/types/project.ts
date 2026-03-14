export interface Project {
  id: string;
  name: string;
  isCimmyt: boolean;
  published: boolean;
}

export function projectFromJson(json: any): Project {
  const idRaw = json?.id ?? json?.uuid ?? json?.project_id ?? '';
  const nameRaw =
    json?.name ??
    json?.title ??
    json?.project_name ??
    json?.label ??
    'Project';
  const publishedFlag =
    json?.published === true ||
    String(json?.status ?? '').toLowerCase() === 'published';
  const hasStatus = json?.published != null || json?.status != null;

  return {
    id: typeof idRaw === 'string' ? idRaw : String(idRaw),
    name: typeof nameRaw === 'string' ? nameRaw : String(nameRaw),
    isCimmyt: false,
    published: hasStatus ? publishedFlag : true,
  };
}

export interface FormOption {
  code: string;
  label: string;
}

export interface FormWidget {
  id: string;
  type: string;
  label: string;
  hint?: string;
  required: boolean;
  options: FormOption[];
  validation?: unknown;
  aiQualityCheck: boolean;
  defaultValue?: unknown;
  text?: string;
  audio?: string;
  /** Probe bank from backend (CIMMYT-style: key -> follow-up text). */
  probeBank: Record<string, string>;
}

export interface FormSection {
  title: string;
  description?: string;
  appearance?: string;
  widgets: FormWidget[];
}

export interface SkipLogicRule {
  // Keep flexible for now – we only need structure/widgets for Sikia interview flow.
  [key: string]: unknown;
}

export interface FormStructure {
  sections: FormSection[];
  skipLogic: SkipLogicRule[];
}

export interface FormItem {
  id: string;
  projectId: string;
  type: string;
  assessmentCode?: string;
  version?: string;
  title: string;
  structure: FormStructure;
}

export interface ProjectFormsResponse {
  projectId: string;
  forms: FormItem[];
  labels: Record<string, unknown>;
  assessments: unknown[];
}

