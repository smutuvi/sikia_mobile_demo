import axios, {AxiosInstance} from 'axios';
import {v4 as uuidv4} from 'uuid';

import {
  type Project,
  projectFromJson,
  type ProjectFormsResponse,
  type FormItem,
  type FormStructure,
  type FormSection,
  type FormWidget,
  type FormOption,
} from '../types/project';

export class ProjectsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectsApiError';
  }
}

export class UnauthorizedError extends ProjectsApiError {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

function createClient(baseUrl: string, token: string): AxiosInstance {
  const trimmedToken = token.trim();
  return axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${trimmedToken}`,
    },
  });
}

/**
 * GET /api/v1/mobile/projects
 * Returns array of projects. Throws UnauthorizedError on 401.
 */
// ---------------------------------------------------------------------------
// Lightweight in-memory projects prefetch cache.
// LoginScreen fires a prefetch immediately after auth succeeds so ProjectsScreen
// receives data on first render rather than waiting for a cold network call.
// ---------------------------------------------------------------------------
interface ProjectsCache {
  projects: Project[];
  fetchedAt: number;
}

let _projectsCache: ProjectsCache | null = null;
const PROJECTS_CACHE_TTL_MS = 60_000; // 60 s — treat as fresh for one minute

export function getCachedProjects(): Project[] | null {
  if (!_projectsCache) return null;
  if (Date.now() - _projectsCache.fetchedAt > PROJECTS_CACHE_TTL_MS) return null;
  return _projectsCache.projects;
}

export function clearProjectsCache(): void {
  _projectsCache = null;
}

export async function prefetchProjects(opts: {
  baseUrl: string;
  token: string;
}): Promise<void> {
  try {
    const projects = await fetchProjects(opts);
    _projectsCache = {projects, fetchedAt: Date.now()};
  } catch {
    // Non-fatal — ProjectsScreen will fetch normally if prefetch fails
  }
}

export async function fetchProjects(opts: {
  baseUrl: string;
  token: string;
}): Promise<Project[]> {
  const client = createClient(opts.baseUrl, opts.token);
  const res = await client.get<any>('/api/v1/mobile/projects');

  if (res.status === 401) {
    throw new UnauthorizedError();
  }
  if (res.status < 200 || res.status >= 300) {
    throw new ProjectsApiError(res.statusText || 'Failed to load projects');
  }

  const data = res.data;
  if (data == null) return [];

  let rawList: any[] = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (typeof data === 'object') {
    const map = data as Record<string, any>;
    const list =
      map.projects ??
      map.data ??
      map.items ??
      map.results ??
      map.project_ids;
    if (Array.isArray(list)) {
      rawList = list;
    }
  }

  const projects = rawList.map(p => projectFromJson(p));
  _projectsCache = {projects, fetchedAt: Date.now()};
  return projects;
}

/**
 * GET /api/v1/mobile/projects/:projectId/forms
 * Returns forms for a project. Mirrors Flutter ProjectFormsResponse.
 */
export async function fetchProjectForms(opts: {
  baseUrl: string;
  token: string;
  projectId: string;
}): Promise<ProjectFormsResponse> {
  const client = createClient(opts.baseUrl, opts.token);
  const res = await client.get<any>(
    `/api/v1/mobile/projects/${opts.projectId}/forms`,
  );

  if (res.status === 401) {
    throw new UnauthorizedError();
  }
  if (res.status < 200 || res.status >= 300) {
    throw new ProjectsApiError(res.statusText || 'Failed to load forms');
  }

  const data = res.data;
  if (!data || typeof data !== 'object') {
    throw new ProjectsApiError('Invalid forms response');
  }

  const json = data as Record<string, any>;
  const projectId = String(json.project_id ?? '');

  const rawForms = json.forms;
  const forms: FormItem[] = [];
  if (Array.isArray(rawForms)) {
    for (const e of rawForms) {
      if (e && typeof e === 'object') {
        forms.push(formItemFromJson(e as Record<string, any>));
      }
    }
  }

  const labelsRaw = json.labels;
  const labels =
    labelsRaw && typeof labelsRaw === 'object'
      ? (labelsRaw as Record<string, unknown>)
      : {};
  const assessmentsRaw = json.assessments;
  const assessments = Array.isArray(assessmentsRaw) ? assessmentsRaw : [];

  return {
    projectId,
    forms,
    labels,
    assessments,
  };
}

/** Convert form answers to a JSON-serializable payload (primitives and string[]). Mirrors Flutter _answersToPayload. */
function answersToPayload(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(values)) {
    if (v == null) {
      out[key] = null;
      continue;
    }
    if (Array.isArray(v)) {
      out[key] = v.map(x => (x != null ? String(x) : null));
      continue;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      out[key] = v;
      continue;
    }
    out[key] = String(v);
  }
  return out;
}

/**
 * POST /api/v1/mobile/submissions
 * Submits form answers. Uses Bearer ID token and same base URL as auth/forms.
 * Returns submission id on success. Throws UnauthorizedError on 401.
 */
export async function submitForm(opts: {
  baseUrl: string;
  token: string;
  form: FormItem;
  answers: Record<string, unknown>;
  deviceId?: string;
}): Promise<string> {
  const base = opts.baseUrl.replace(/\/$/, '');
  const client = axios.create({
    baseURL: base + '/',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${opts.token.trim()}`,
    },
  });

  const body = {
    client_id: uuidv4(),
    type: opts.form.type,
    project_id: opts.form.projectId,
    assessment_code: opts.form.assessmentCode ?? null,
    form_id: opts.form.id,
    entity_id: null,
    payload: answersToPayload(opts.answers),
    device_id: opts.deviceId ?? 'mobile-app',
  };

  try {
    const res = await client.post<{id?: string; submission_id?: string}>(
      '/api/v1/mobile/submissions',
      body,
    );

    if (res.status === 401) {
      throw new UnauthorizedError();
    }
    if (res.status < 200 || res.status >= 300) {
      const data = res.data as Record<string, unknown> | undefined;
      const msg =
        (data?.detail ?? data?.message ?? res.statusText ?? 'Submit failed') as string;
      throw new ProjectsApiError(msg);
    }

    const data = res.data;
    if (data?.id != null) return String(data.id);
    if (data?.submission_id != null) return String(data.submission_id);
    return String(res.status);
  } catch (err: any) {
    if (err instanceof UnauthorizedError) throw err;
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) throw new UnauthorizedError();
      const data = err.response?.data as Record<string, unknown> | undefined;
      const msg =
        (data?.detail ?? data?.message ?? err.message ?? 'Submit failed') as string;
      throw new ProjectsApiError(msg);
    }
    throw err;
  }
}

function formItemFromJson(json: Record<string, any>): FormItem {
  const id = String(json.id ?? '');
  const projectId = String(json.project_id ?? '');
  const type = String(json.type ?? 'survey');
  const assessmentCode =
    json.assessment_code != null ? String(json.assessment_code) : undefined;
  const version = json.version != null ? String(json.version) : undefined;
  const title = String(json.title ?? 'Form');
  const structure =
    json.structure && typeof json.structure === 'object'
      ? formStructureFromJson(json.structure as Record<string, any>)
      : {sections: [], skipLogic: []};

  return {
    id,
    projectId,
    type,
    assessmentCode,
    version,
    title,
    structure,
  };
}

function formStructureFromJson(json: Record<string, any>): FormStructure {
  const sectionsRaw = json.sections;
  const sections: FormSection[] = [];
  if (Array.isArray(sectionsRaw)) {
    for (const e of sectionsRaw) {
      if (e && typeof e === 'object') {
        sections.push(formSectionFromJson(e as Record<string, any>));
      }
    }
  }

  const skipRaw = json.skip_logic;
  const skipLogic: any[] = Array.isArray(skipRaw) ? skipRaw : [];

  return {
    sections,
    skipLogic,
  };
}

function formSectionFromJson(json: Record<string, any>): FormSection {
  const title = String(json.title ?? '');
  const description =
    json.description != null ? String(json.description) : undefined;
  const appearance =
    json.appearance != null ? String(json.appearance) : undefined;

  const widgetsRaw = json.widgets;
  const widgets: FormWidget[] = [];
  if (Array.isArray(widgetsRaw)) {
    for (const e of widgetsRaw) {
      if (e && typeof e === 'object') {
        widgets.push(formWidgetFromJson(e as Record<string, any>));
      }
    }
  }

  return {
    title,
    description,
    appearance,
    widgets,
  };
}

function formWidgetFromJson(json: Record<string, any>): FormWidget {
  const idRaw = json.id ?? json.question_id ?? '';
  const id = String(idRaw);
  const type = String(json.type ?? 'text').toLowerCase();
  const label = String(json.label ?? '');
  const hint =
    json.hint != null
      ? String(json.hint)
      : json.target_outcome != null
      ? String(json.target_outcome)
      : undefined;
  const required =
    json.required === true || String(json.required).toLowerCase() === 'true';

  const optionsRaw = json.options;
  const options: FormOption[] = [];
  if (Array.isArray(optionsRaw)) {
    for (const e of optionsRaw) {
      if (e && typeof e === 'object') {
        const optJson = e as Record<string, any>;
        const codeRaw = optJson.code ?? optJson.value ?? '';
        const labelRaw = optJson.label ?? '';
        options.push({
          code: String(codeRaw),
          label: String(labelRaw),
        });
      }
    }
  }

  const validation = json.validation;
  const aiQualityCheck = json.ai_quality_check === true;
  const defaultValue = json.default_value;
  const text =
    json.text != null
      ? String(json.text)
      : json.main_question != null
      ? String(json.main_question)
      : undefined;
  const audio = json.audio != null ? String(json.audio) : undefined;

  const probeBank: Record<string, string> = {};
  const pb = json.probe_bank;
  if (pb && typeof pb === 'object') {
    for (const [k, v] of Object.entries(pb as Record<string, any>)) {
      if (k != null && v != null) {
        probeBank[String(k)] = String(v);
      }
    }
  }

  return {
    id,
    type,
    label,
    hint,
    required,
    options,
    validation,
    aiQualityCheck,
    defaultValue,
    text,
    audio,
    probeBank,
  };
}

