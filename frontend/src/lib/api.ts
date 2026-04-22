import axios from 'axios';

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
  syntax?: string;
}

export interface VariableInfo {
  name: string;
  label: string;
  type: string;
  codes: VariableCode[];
  syntax?: string;
  code_syntax?: string[];
  isCustom?: boolean;
  showMean: boolean;
  showStdError: boolean;
  showStdDev: boolean;
  showVariance: boolean;
}

export interface Table {
  id: string;
  name: string;
  folderId?: string | null;
  row_items: DropItem[];
  col_items: DropItem[];
  filter_items: FilterItem[];
  weight_col: string | null;
  filter_def: string | null;
  result: CrosstabResult | null;
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
}

export const dataApi = {
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/data/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadMdd: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/data/upload-mdd', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadPair: async (csvFile: File, mddFile: File) => {
    const formData = new FormData();
    formData.append('csv_file', csvFile);
    formData.append('mdd_file', mddFile);
    const response = await api.post('/api/data/upload-pair', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadZip: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/data/upload-zip', formData, {
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
    return response.data.variables;
  },

  getInfo: async () => {
    const response = await api.get('/api/data/info');
    return response.data;
  },

  mergeMR: async (name: string, source_columns: string[], label?: string) => {
    const response = await api.post('/api/data/merge-mr', { name, source_columns, label });
    return response.data;
  },

  getMergedVariables: async () => {
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

  getNetRegistry: async (): Promise<{ net_registry: Record<string, any>; name_to_key: Record<string, string> }> => {
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

export default api;
