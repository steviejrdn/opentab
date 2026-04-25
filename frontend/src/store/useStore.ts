import { create } from 'zustand';
import type { VariableInfo, Table, CrosstabResult, DropItem, FilterItem } from '../lib/api';
import { dataApi } from '../lib/api';

export interface Folder {
  id: string;
  name: string;
  isOpen: boolean;
}

interface AppState {
  dataLoaded: boolean;
  variables: Record<string, VariableInfo>;
  fileName: string | null;
  rowCount: number;

  tables: Table[];
  activeTableId: string | null;
  folders: Folder[];

  activeTab: 'build' | 'filter' | 'result' | 'edit-variables';
  displayOptions: {
    counts: boolean;
    colPct: boolean;
    showPctSign: boolean;
    decimalPlaces: number;
    statDecimalPlaces: number;
  };

  sidebarWidth: number;
  sidebarVisible: boolean;

  // Copy/Paste variable info
  copiedVariableInfo: {
    codes: { code: string; label: string; factor: number | null }[];
    netCodes: { code: string; label: string; netOf: string[] }[];
    stats: {
      showMean: boolean;
      showStdError: boolean;
      showStdDev: boolean;
      showVariance: boolean;
    };
  } | null;
  setCopiedVariableInfo: (info: { codes: { code: string; label: string; factor: number | null }[]; netCodes: { code: string; label: string; netOf: string[] }[]; stats: { showMean: boolean; showStdError: boolean; showStdDev: boolean; showVariance: boolean; } } | null) => void;

  // Undo paste
  lastPastedVariable: {
    varName: string;
    codes: VariableInfo['codes'];
  } | null;
  setLastPastedVariable: (info: { varName: string; codes: VariableInfo['codes'] } | null) => void;
  restoreVariableCodes: (varName: string, codes: VariableInfo['codes']) => void;

  setDataLoaded: (loaded: boolean) => void;
  setVariables: (variables: Record<string, VariableInfo>) => void;
  setDataInfo: (fileName: string, rowCount: number) => void;

  setTables: (tables: Table[]) => void;
  addTable: (table: Table) => void;
  setActiveTable: (id: string | null) => void;
  deleteTable: (id: string) => void;
  updateTable: (id: string, updates: Partial<Table>) => void;

  addFolder: (name: string) => string;
  deleteFolder: (id: string) => void;
  renameFolder: (id: string, name: string) => void;
  toggleFolder: (id: string) => void;

  addRowItem: (tableId: string, item: DropItem) => void;
  addColItem: (tableId: string, item: DropItem) => void;
  removeRowItem: (tableId: string, itemId: string) => void;
  removeColItem: (tableId: string, itemId: string) => void;
  addGridItem: (tableId: string, item: DropItem) => void;
  removeGridItem: (tableId: string, itemId: string) => void;
  setGridMode: (tableId: string, enabled: boolean) => void;
  addFilterItem: (tableId: string, item: FilterItem) => void;
  updateFilterItem: (tableId: string, itemId: string, updates: Partial<FilterItem>) => void;
  removeFilterItem: (tableId: string, itemId: string) => void;
  setFilterOperator: (tableId: string, itemId: string, operator: 'AND' | 'OR') => void;
  setTableResult: (tableId: string, result: CrosstabResult) => void;
  nestItem: (tableId: string, zone: 'row' | 'col', parentId: string, newItem: DropItem) => void;

  setActiveTab: (tab: 'build' | 'filter' | 'result') => void;
  setDisplayOptions: (options: Partial<AppState['displayOptions']>) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;

  updateVariableLabel: (varName: string, label: string) => void;
  updateVariableDisplayName: (varName: string, displayName: string) => void;
  updateCodeLabel: (varName: string, code: string, label: string) => void;
  updateCodeVisibility: (varName: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  updateCodeFactor: (varName: string, code: string, factor: number | null) => void;
  updateCodeSyntax: (varName: string, code: string, syntax: string) => void;
  updateNetCode: (varName: string, code: string, syntax: string) => void;
  removeCode: (varName: string, code: string) => void;
  addNetCode: (varName: string, netOf: string[], label: string) => void;
  addCode: (varName: string, label: string, syntax: string, factor?: number | null) => void;
  reorderCodes: (varName: string, orderedCodes: string[]) => void;
  addVariable: (key: string, name: string, label: string, type: string, answerType?: 'single_answer' | 'multiple_answer') => void;
  duplicateVariable: (sourceKey: string, targetKey: string) => void;
  toggleVariableStat: (varName: string, stat: 'showMean' | 'showStdError' | 'showStdDev' | 'showVariance') => void;
  deleteVariable: (varName: string) => void;
  importState: (state: Partial<Pick<AppState, 'variables' | 'tables' | 'displayOptions' | 'activeTableId' | 'fileName' | 'rowCount' | 'folders'>>) => void;
  mergeAndSetVariables: (incoming: Record<string, VariableInfo>) => void;
  resetSession: () => void;
}

export const useStore = create<AppState>()((set, get) => ({
  dataLoaded: false,
  variables: {},
  fileName: null,
  rowCount: 0,

  tables: [],
  activeTableId: null,
  folders: [],

  activeTab: 'build',
  displayOptions: {
    counts: true,
    colPct: false,
    showPctSign: true,
    decimalPlaces: 1,
    statDecimalPlaces: 2,
  },
  sidebarWidth: 256,
  sidebarVisible: false,

  copiedVariableInfo: null,
  lastPastedVariable: null,

  setDataLoaded: (loaded) => set({ dataLoaded: loaded, sidebarVisible: loaded }),
  setVariables: (variables) => {
    // Sort codes for each variable
    const sortedVars: Record<string, VariableInfo> = {};
    for (const [key, info] of Object.entries(variables)) {
      sortedVars[key] = {
        ...info,
        codes: [...info.codes].sort((a, b) => {
          const aCode = String(a.code);
          const bCode = String(b.code);
          const aNum = parseInt(aCode, 10);
          const bNum = parseInt(bCode, 10);
          const aIsNum = !isNaN(aNum) && String(aNum) === aCode;
          const bIsNum = !isNaN(bNum) && String(bNum) === bCode;
          if (aIsNum && bIsNum) return aNum - bNum;
          if (aIsNum && !bIsNum) return -1;
          if (!aIsNum && bIsNum) return 1;
          return aCode.localeCompare(bCode);
        }),
      };
    }
    set({ variables: sortedVars });
  },
  setDataInfo: (fileName, rowCount) => set({ fileName, rowCount }),

  setTables: (tables) => set({ tables }),
  addTable: (table) => set((state) => ({ tables: [...state.tables, table] })),
  setActiveTable: (id) => set({ activeTableId: id }),
  deleteTable: (id) => set((state) => ({
    tables: state.tables.filter((t) => t.id !== id),
    activeTableId: state.activeTableId === id ? null : state.activeTableId,
  })),
  updateTable: (id, updates) => set((state) => ({
    tables: state.tables.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    ),
  })),

  addFolder: (name) => {
    const id = crypto.randomUUID();
    set((state) => ({ folders: [...state.folders, { id, name, isOpen: true }] }));
    return id;
  },
  deleteFolder: (id) => set((state) => ({
    folders: state.folders.filter((f) => f.id !== id),
    tables: state.tables.map((t) => t.folderId === id ? { ...t, folderId: null } : t),
  })),
  renameFolder: (id, name) => set((state) => ({
    folders: state.folders.map((f) => f.id === id ? { ...f, name } : f),
  })),
  toggleFolder: (id) => set((state) => ({
    folders: state.folders.map((f) => f.id === id ? { ...f, isOpen: !f.isOpen } : f),
  })),

  addRowItem: (tableId, item) => {
    const state = get();
    const table = state.tables.find((t) => t.id === tableId);
    if (table) {
      get().updateTable(tableId, {
        row_items: [...table.row_items, item],
      });
    }
  },

  addColItem: (tableId, item) => {
    const state = get();
    const table = state.tables.find((t) => t.id === tableId);
    if (table) {
      get().updateTable(tableId, {
        col_items: [...table.col_items, item],
      });
    }
  },

  removeRowItem: (tableId, itemId) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (!table) return;
    const removeFrom = (items: DropItem[]): DropItem[] =>
      items.filter((i) => i.id !== itemId).map((i) => ({
        ...i, children: i.children ? removeFrom(i.children) : undefined,
      }));
    get().updateTable(tableId, { row_items: removeFrom(table.row_items) });
  },

  removeColItem: (tableId, itemId) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (!table) return;
    const removeFrom = (items: DropItem[]): DropItem[] =>
      items.filter((i) => i.id !== itemId).map((i) => ({
        ...i, children: i.children ? removeFrom(i.children) : undefined,
      }));
    get().updateTable(tableId, { col_items: removeFrom(table.col_items) });
  },

  addGridItem: (tableId, item) => {
    const state = get();
    const table = state.tables.find((t) => t.id === tableId);
    if (table) {
      get().updateTable(tableId, {
        grid_items: [...(table.grid_items || []), item],
      });
    }
  },

  removeGridItem: (tableId, itemId) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (!table || !table.grid_items) return;
    get().updateTable(tableId, {
      grid_items: table.grid_items.filter((i) => i.id !== itemId),
    });
  },

  setGridMode: (tableId, enabled) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (table) {
      get().updateTable(tableId, { is_grid_mode: enabled });
    }
  },

  addFilterItem: (tableId, item) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (table) get().updateTable(tableId, { filter_items: [...table.filter_items, item] });
  },

  updateFilterItem: (tableId, itemId, updates) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (table) {
      get().updateTable(tableId, {
        filter_items: table.filter_items.map((i) => i.id === itemId ? { ...i, ...updates } : i),
      });
    }
  },

  removeFilterItem: (tableId, itemId) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (table) {
      get().updateTable(tableId, {
        filter_items: table.filter_items.filter((i) => i.id !== itemId),
      });
    }
  },

  setFilterOperator: (tableId, itemId, operator) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (table) {
      get().updateTable(tableId, {
        filter_items: table.filter_items.map((i) => i.id === itemId ? { ...i, operatorToNext: operator } : i),
      });
    }
  },

  setTableResult: (tableId, result) => {
    get().updateTable(tableId, { result });
  },

  nestItem: (tableId, zone, parentId, newItem) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (!table) return;
    const nestInItems = (items: DropItem[]): DropItem[] =>
      items.map((item) => {
        if (item.id === parentId) return { ...item, children: [...(item.children || []), newItem] };
        if (item.children?.length) return { ...item, children: nestInItems(item.children) };
        return item;
      });
    const key = zone === 'col' ? 'col_items' : 'row_items';
    get().updateTable(tableId, { [key]: nestInItems(table[key]) });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setDisplayOptions: (options) =>
    set((state) => ({
      displayOptions: { ...state.displayOptions, ...options },
    })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(600, width)) }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

  setCopiedVariableInfo: (info) => set({ copiedVariableInfo: info }),
  setLastPastedVariable: (info) => set({ lastPastedVariable: info }),
  restoreVariableCodes: (varName, codes) =>
    set((state) => ({
      variables: {
        ...state.variables,
        [varName]: { ...state.variables[varName], codes },
      },
    })),

  updateVariableLabel: (varName, label) =>
    set((state) => ({
      variables: {
        ...state.variables,
        [varName]: { ...state.variables[varName], label },
      },
    })),

  updateVariableDisplayName: (varName, displayName) =>
    set((state) => ({
      variables: {
        ...state.variables,
        [varName]: { ...state.variables[varName], name: displayName },
      },
    })),

  updateCodeLabel: (varName, code, label) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      return {
        variables: {
          ...state.variables,
          [varName]: {
            ...v,
            codes: v.codes.map((c) => c.code === code ? { ...c, label } : c),
          },
        },
      };
    }),

  updateCodeVisibility: (varName, code, visibility) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      return {
        variables: {
          ...state.variables,
          [varName]: {
            ...v,
            codes: v.codes.map((c) => c.code === code ? { ...c, visibility } : c),
          },
        },
      };
    }),

  updateCodeFactor: (varName, code, factor) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      return {
        variables: {
          ...state.variables,
          [varName]: {
            ...v,
            codes: v.codes.map((c) => c.code === code ? { ...c, factor } : c),
          },
        },
      };
    }),

  updateCodeSyntax: (varName, code, syntax) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      const codeIdx = v.codes.findIndex((c) => c.code === code);
      if (codeIdx === -1) return state;
      const newCodeSyntax = [...(v.code_syntax || Array(v.codes.length).fill(''))];
      newCodeSyntax[codeIdx] = syntax;
      return {
        variables: {
          ...state.variables,
          [varName]: {
            ...v,
            code_syntax: newCodeSyntax,
            codes: v.codes.map((c, idx) =>
              idx === codeIdx ? { ...c, syntax } : c
            ),
          },
        },
      };
    }),
  updateNetCode: (varName, code, syntax) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      const codeIdx = v.codes.findIndex((c) => c.code === code);
      if (codeIdx === -1) return state;
      const targetCode = v.codes[codeIdx];
      if (!targetCode.isNet) return state;
      const atomRe = /([A-Za-z_][A-Za-z0-9_]*)\/([^+]+)/g;
      const codes: string[] = [];
      let match;
      while ((match = atomRe.exec(syntax)) !== null) {
        codes.push(match[2]);
      }
      const newCodes = v.codes.map((c, i) =>
        i === codeIdx ? { ...c, netOf: codes, syntax } : c
      );
      const newCodeSyntax = [...(v.code_syntax || Array(v.codes.length).fill(''))];
      newCodeSyntax[codeIdx] = syntax;
      return {
        variables: {
          ...state.variables,
          [varName]: { ...v, codes: newCodes, code_syntax: newCodeSyntax },
        },
      };
    }),
  removeCode: (varName, code) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      const codeIdx = v.codes.findIndex((c) => c.code === code);
      const newCodes = v.codes.filter((c) => c.code !== code);
      const newCodeSyntax = v.code_syntax ? v.code_syntax.filter((_, i) => i !== codeIdx) : undefined;
      return {
        variables: {
          ...state.variables,
          [varName]: {
            ...v,
            codes: newCodes,
            code_syntax: newCodeSyntax,
          },
        },
      };
    }),

  addNetCode: (varName, netOf, label) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      // Find next numeric code
      const numericCodes = v.codes
        .map((c) => parseInt(c.code, 10))
        .filter((n) => !isNaN(n) && n > 0);
      const nextCode = numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : 1;
      const code = String(nextCode);
      // Use display name for variable in syntax
      const varDisplayName = v.label || v.name || varName;
      const syntax = netOf.map((nc) => `${varDisplayName}/${nc}`).join('+');
      const newCode = { code, label, isNet: true, isNew: true, netOf, syntax, factor: null, visibility: 'visible' as const };
      // Register with backend
      dataApi.registerNet(code, varName, label, netOf, syntax).catch(console.error);
      return { variables: { ...state.variables, [varName]: { ...v, codes: [...v.codes, newCode] } } };
    }),

  addCode: (varName: string, label: string, syntax: string, factor: number | null = null) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      const numericCodes = v.codes
        .map((c) => parseInt(c.code, 10))
        .filter((n) => !isNaN(n) && n > 0);
      const nextCode = numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : 1;
      const code = String(nextCode);
      const newCode = { code, label, syntax, factor, isNew: true, visibility: 'visible' as const };
      const newCodeSyntax = [...(v.code_syntax || []), syntax];
      return { variables: { ...state.variables, [varName]: { ...v, isCustom: true, codes: [...v.codes, newCode], code_syntax: newCodeSyntax } } };
    }),

  reorderCodes: (varName, orderedCodes) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      const codeMap = Object.fromEntries(v.codes.map((c) => [c.code, c]));
      const reordered = orderedCodes.map((code) => codeMap[code]).filter(Boolean);
      const codeSyntaxMap = v.code_syntax ? Object.fromEntries(v.codes.map((c, i) => [c.code, v.code_syntax?.[i] || ''])) : {};
      const reorderedCodeSyntax = v.code_syntax ? orderedCodes.map((code) => codeSyntaxMap[code] || '') : undefined;
      return { variables: { ...state.variables, [varName]: { ...v, codes: reordered, code_syntax: reorderedCodeSyntax } } };
    }),

  addVariable: (key, name, label, type, answerType: 'single_answer' | 'multiple_answer' = 'single_answer') =>
    set((state) => {
      if (state.variables[key]) return state;
      return {
        variables: {
          ...state.variables,
          [key]: {
            name,
            label,
            type,
            answerType,
            codes: [],
            responseCount: 0,
            baseCount: state.rowCount,
            isValid: true,
            isCustom: true,
            showMean: false,
            showStdError: false,
            showStdDev: false,
            showVariance: false
          },
        },
      };
    }),

  duplicateVariable: (sourceKey: string, targetKey: string) =>
    set((state) => {
      const sourceVar = state.variables[sourceKey];
      if (!sourceVar || state.variables[targetKey]) return state;
      return {
        variables: {
          ...state.variables,
          [targetKey]: {
            ...sourceVar,
            name: `${sourceVar.name || sourceKey} (copy)`,
            codes: sourceVar.codes.map((c) => ({ ...c })),
            isCustom: true,
          },
        },
      };
    }),

  toggleVariableStat: (varName, stat) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      return {
        variables: {
          ...state.variables,
          [varName]: { ...v, [stat]: !v[stat] },
        },
      };
    }),

  importState: (incoming) => set((state) => ({
    ...state,
    ...incoming,
    displayOptions: incoming.displayOptions
      ? { ...state.displayOptions, ...incoming.displayOptions }
      : state.displayOptions,
  })),

  mergeAndSetVariables: (incoming) => set((state) => {
    const merged: Record<string, VariableInfo> = {};
    for (const [key, newInfo] of Object.entries(incoming)) {
      const existing = state.variables[key];
      // Sort codes by numeric value if possible, otherwise alphabetical
      const sortCodes = (codes: any[]) => {
        return [...codes].sort((a, b) => {
          const aCode = String(a.code);
          const bCode = String(b.code);
          const aNum = parseInt(aCode, 10);
          const bNum = parseInt(bCode, 10);
          const aIsNum = !isNaN(aNum) && String(aNum) === aCode;
          const bIsNum = !isNaN(bNum) && String(bNum) === bCode;
          if (aIsNum && bIsNum) return aNum - bNum;
          if (aIsNum && !bIsNum) return -1;
          if (!aIsNum && bIsNum) return 1;
          return aCode.localeCompare(bCode);
        });
      };
      if (!existing) {
        merged[key] = { ...newInfo, codes: sortCodes(newInfo.codes) };
        continue;
      }
      merged[key] = {
        ...newInfo,
        name: existing.name !== key ? existing.name : newInfo.name,
        label: existing.label || newInfo.label,
        syntax: newInfo.syntax || existing.syntax,
        showMean: existing.showMean,
        showStdError: existing.showStdError,
        showStdDev: existing.showStdDev,
        showVariance: existing.showVariance,
        codes: sortCodes(newInfo.codes.map((c) => {
          const ec = existing.codes.find((x) => x.code === c.code);
          return ec ? { ...c, label: ec.label || c.label, factor: ec.factor, visibility: ec.visibility } : c;
        })),
      };
    }
    return { variables: merged };
  }),

  deleteVariable: (varName) =>
    set((state) => {
      const entries = Object.entries(state.variables).filter(([k]) => k !== varName);
      return { variables: Object.fromEntries(entries) };
    }),

  resetSession: () => set({
    dataLoaded: false,
    variables: {},
    fileName: null,
    rowCount: 0,
    tables: [],
    activeTableId: null,
    folders: [],
    activeTab: 'build',
    sidebarVisible: false,
    displayOptions: { counts: true, colPct: false, showPctSign: true, decimalPlaces: 1, statDecimalPlaces: 2 },
  }),

}));
