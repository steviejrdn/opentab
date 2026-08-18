import axios from 'axios';
import type { Folder, DisplayOptions } from '../store/useStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface VariableCode {
  code: string;
  label: string;
  factor: number | null;
  visibility?: 'visible' | 'hidden' | 'removed';
  isNet?: boolean;
  netOf?: string[];
  isNew?: boolean;
  isCustom?: boolean;
  syntax?: string;
}

export interface VariableInfo {
  name: string;
  label: string;
  type: string;
  answerType: 'single_answer' | 'multiple_answer';
  codes: VariableCode[];
  responseCount: number;
  baseCount: number;
  isValid: boolean;
  syntax?: string;
  code_syntax?: string[];
  isCustom?: boolean;
  sourceKey?: string;
  showMean: boolean;
  showStdError: boolean;
  showStdDev: boolean;
  showVariance: boolean;
  stats?: { min: number; max: number; mean: number; median: number; std: number };
}

export interface Table {
  id: string;
  name: string;
  folderId?: string | null;
  row_items: DropItem[];
  col_items: DropItem[];
  grid_items: DropItem[];  // Variables for variable grid display
  filter_items: FilterItem[];
  weight_col: string | null;
  filter_def: string | null;
  result: CrosstabResult | null;
  is_grid_mode?: boolean;  // Whether to display as variable grid
}

export interface DropItem {
  id: string;
  variable: string;
  codeDef: string;
  codes?: string[];
  children?: DropItem[];
}

export type FilterCondition = 'includes_any' | 'includes_none' | 'has_value' | 'has_no_value';

export interface FilterItem {
  id: string;
  variable: string;
  condition: FilterCondition;
  selectedCodes: string[];
  operatorToNext?: 'AND' | 'OR';
}

export interface CrosstabRequest {
  row_items: { variable: string; codeDef: string }[];
  col_items: { variable: string; codeDef: string }[];
  grid_items?: { variable: string; codeDef: string }[];  // For variable grid
  is_grid_mode?: boolean;
  filter_def?: string;
  weight_col?: string;
  mean_score_mappings?: { variable: string; codeScores: Record<string, number> }[];
  name_to_key?: Record<string, string>;
  net_registry?: Record<string, { variable: string; label: string; netOf: string[]; syntax: string }>;
  code_registry?: Record<string, { variable: string; code: string; syntax: string }>;
}

export interface CrosstabResult {
  counts: Record<string, Record<string, number>>;
  row_pct: Record<string, Record<string, number>>;
  col_pct: Record<string, Record<string, number>>;
  total_pct: Record<string, Record<string, number>>;
  base: number;
  mean?: Record<string, Record<string, number>> | null;
  std_error?: Record<string, Record<string, number>> | null;
  std_dev?: Record<string, Record<string, number>> | null;
  variance?: Record<string, Record<string, number>> | null;
  scale_rows?: Record<string, {
    mean: Record<string, number>;
    std_dev: Record<string, number>;
    std_error: Record<string, number>;
    variance: Record<string, number>;
  }> | null;
  weighted_base?: number | null;
  effective_base?: number | null;
  significance?: {
    column_letters: Record<string, string>;
    letters: Record<string, Record<string, string>>;
    total?: Record<string, Record<string, string>> | null;
  } | null;
}

export interface NetCodeInfo {
  variable: string;
  label: string;
  netOf: string[];
  syntax: string;
}

export interface MergedVariableMeta {
  label?: string;
  type?: string;
  answer_type?: string;
  codes?: VariableCode[];
  syntax?: string;
  code_syntax?: string[];
  merge_operator?: 'AND' | 'OR';
  source_columns?: string[];
  source_variables?: string[];
  [key: string]: unknown;
}

export interface SessionPayload {
  version?: number;
  fileName?: string | null;
  rowCount?: number;
  csvData: string;
  variables: Record<string, VariableInfo>;
  tables: Table[];
  folders?: Folder[];
  displayOptions?: DisplayOptions;
  activeTableId?: string | null;
  mergedVariables?: Record<string, MergedVariableMeta>;
}

interface RawVariableInfo {
  answer_type?: string;
  response_count?: number;
  base_count?: number;
  is_valid?: boolean;
  [key: string]: unknown;
}

export const dataApi = {
  uploadFile: async (file: File, sheet?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = sheet
      ? `/api/data/upload?sheet=${encodeURIComponent(sheet)}`
      : '/api/data/upload';
    const response = await api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  loadSample: async () => {
    const response = await api.post('/api/data/load-sample');
    return response.data;
  },

  getVariables: async (): Promise<Record<string, VariableInfo>> => {
    const response = await api.get('/api/data/variables');
    const variables = response.data.variables;
    
    // Transform snake_case to camelCase for new fields
    const transformed: Record<string, VariableInfo> = {};
    for (const [key, varData] of Object.entries(variables)) {
      const v = varData as RawVariableInfo;
      transformed[key] = {
        ...v,
        answerType: v.answer_type || 'single_answer',
        responseCount: v.response_count || 0,
        baseCount: v.base_count || 0,
        isValid: v.is_valid ?? true,
      } as VariableInfo;
    }
    return transformed;
  },

  getInfo: async () => {
    const response = await api.get('/api/data/info');
    return response.data;
  },

  mergeMR: async (name: string, source_columns: string[], label?: string) => {
    const response = await api.post('/api/data/merge-mr', { name, source_columns, label });
    return response.data;
  },

  getMergedVariables: async (): Promise<Record<string, MergedVariableMeta>> => {
    const response = await api.get('/api/data/merged-variables');
    return response.data.variables;
  },

  deleteMergedVariable: async (name: string) => {
    const response = await api.delete(`/api/data/merge-mr/${name}`);
    return response.data;
  },

  mergeVariables: async (request: {
    columns: string[];
    new_variable_name: string;
    merge_type: 'binary' | 'spread';
    code_prefix?: string;
  }) => {
    const response = await api.post('/api/data/merge_variables', request);
    return response.data;
  },

  mergeCodes: async (request: {
    variables: string[];
    new_variable_name: string;
    merge_operator: 'OR' | 'AND';
    description?: string;
  }) => {
    const response = await api.post('/api/data/merge_codes', request);
    return response.data;
  },

  getRawCsv: async (): Promise<string> => {
    const response = await api.get('/api/data/raw', { responseType: 'text' });
    return response.data as string;
  },

  uploadText: async (csvText: string, fileName: string) => {
    const response = await api.post('/api/data/upload-text', { csv_text: csvText, file_name: fileName });
    return response.data;
  },

  registerMerged: async (name: string, metadata: object) => {
    const response = await api.post('/api/data/register-merged', { name, metadata });
    return response.data;
  },

  registerNet: async (code: string, variable: string, label: string, netOf: string[], syntax: string) => {
    const response = await api.post('/api/data/register-net', { code, variable, label, netOf, syntax });
    return response.data;
  },

  getNetRegistry: async (): Promise<{ net_registry: Record<string, NetCodeInfo>; name_to_key: Record<string, string> }> => {
    const response = await api.get('/api/data/net-registry');
    return response.data;
  },
};

export const tablesApi = {
  list: async (): Promise<Table[]> => {
    const response = await api.get('/api/tables/');
    return response.data;
  },

  create: async (name: string): Promise<Table> => {
    const response = await api.post('/api/tables/', { name });
    return response.data;
  },

  get: async (id: string): Promise<Table> => {
    const response = await api.get(`/api/tables/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<Table>): Promise<Table> => {
    const response = await api.put(`/api/tables/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/api/tables/${id}`);
    return response.data;
  },
};

export const computeApi = {
  crosstab: async (request: CrosstabRequest): Promise<CrosstabResult> => {
    const response = await api.post('/api/compute/crosstab', request);
    return response.data;
  },
};

export const updateApi = {
  run: async (): Promise<{ status: string; message: string }> => {
    const response = await api.post('/api/update');
    return response.data;
  },
};

export const sessionApi = {
  save: async (session: unknown) => {
    const response = await api.post('/api/session/save', session);
    return response.data;
  },

  load: async (): Promise<{ exists: boolean; session: SessionPayload | null }> => {
    const response = await api.get('/api/session/load');
    return response.data;
  },

  clear: async () => {
    const response = await api.delete('/api/session');
    return response.data;
  },

  saveFlush: (session: unknown) => {
    return fetch(`${API_URL}/api/session/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
      keepalive: true,
    }).catch(() => {});
  },
};

export default api;
