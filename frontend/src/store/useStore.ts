import { create } from 'zustand';
import type { VariableInfo, Table, CrosstabResult, DropItem, FilterItem } from '../lib/api';

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
  };

  sidebarWidth: number;
  sidebarVisible: boolean;

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
  addChildItem: (tableId: string, parentId: string, item: DropItem, zone: 'row' | 'col') => void;
  removeRowItem: (tableId: string, itemId: string) => void;
  removeColItem: (tableId: string, itemId: string) => void;
  addFilterItem: (tableId: string, item: FilterItem) => void;
  updateFilterItem: (tableId: string, itemId: string, updates: Partial<FilterItem>) => void;
  removeFilterItem: (tableId: string, itemId: string) => void;
  setTableResult: (tableId: string, result: CrosstabResult) => void;

  setActiveTab: (tab: 'build' | 'filter' | 'result') => void;
  setDisplayOptions: (options: Partial<AppState['displayOptions']>) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;

  updateVariableLabel: (varName: string, label: string) => void;
  updateVariableDisplayName: (varName: string, displayName: string) => void;
  updateCodeLabel: (varName: string, code: string, label: string) => void;
  updateCodeVisibility: (varName: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  updateCodeFactor: (varName: string, code: string, factor: number | null) => void;
  removeCode: (varName: string, code: string) => void;
  toggleVariableStat: (varName: string, stat: 'showMean' | 'showStdError' | 'showStdDev' | 'showVariance') => void;
  importState: (state: Partial<Pick<AppState, 'variables' | 'tables' | 'displayOptions' | 'activeTableId' | 'fileName' | 'rowCount' | 'folders'>>) => void;
  mergeAndSetVariables: (incoming: Record<string, VariableInfo>) => void;
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
  },
  sidebarWidth: 256,
  sidebarVisible: true,

  setDataLoaded: (loaded) => set({ dataLoaded: loaded }),
  setVariables: (variables) => set({ variables }),
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

  addChildItem: (tableId, parentId, item, zone: 'row' | 'col') => {
    const state = get();
    const table = state.tables.find((t) => t.id === tableId);
    if (!table) return;
    const items = zone === 'row' ? table.row_items : table.col_items;
    const addChild = (list: any[]): any[] => {
      return list.map((i) => {
        if (i.id === parentId) {
          return { ...i, children: [...(i.children || []), item] };
        }
        if (i.children) {
          return { ...i, children: addChild(i.children) };
        }
        return i;
      });
    };
    const updated = addChild(items);
    if (zone === 'row') {
      get().updateTable(tableId, { row_items: updated });
    } else {
      get().updateTable(tableId, { col_items: updated });
    }
  },

  removeRowItem: (tableId, itemId) => {
    const state = get();
    const table = state.tables.find((t) => t.id === tableId);
    if (table) {
      const remove = (list: any[]): any[] => {
        return list
          .filter((i) => i.id !== itemId)
          .map((i) => i.children ? { ...i, children: remove(i.children) } : i);
      };
      get().updateTable(tableId, {
        row_items: remove(table.row_items),
      });
    }
  },

  removeColItem: (tableId, itemId) => {
    const state = get();
    const table = state.tables.find((t) => t.id === tableId);
    if (table) {
      const remove = (list: any[]): any[] => {
        return list
          .filter((i) => i.id !== itemId)
          .map((i) => i.children ? { ...i, children: remove(i.children) } : i);
      };
      get().updateTable(tableId, {
        col_items: remove(table.col_items),
      });
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

  setTableResult: (tableId, result) => {
    get().updateTable(tableId, { result });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setDisplayOptions: (options) =>
    set((state) => ({
      displayOptions: { ...state.displayOptions, ...options },
    })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(600, width)) }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

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

  removeCode: (varName, code) =>
    set((state) => {
      const v = state.variables[varName];
      if (!v) return state;
      return {
        variables: {
          ...state.variables,
          [varName]: {
            ...v,
            codes: v.codes.filter((c) => c.code !== code),
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

  importState: (incoming) => set((state) => ({ ...state, ...incoming })),

  mergeAndSetVariables: (incoming) => set((state) => {
    const merged: Record<string, VariableInfo> = {};
    for (const [key, newInfo] of Object.entries(incoming)) {
      const existing = state.variables[key];
      if (!existing) {
        merged[key] = newInfo;
        continue;
      }
      merged[key] = {
        ...newInfo,
        name: existing.name !== key ? existing.name : newInfo.name,
        label: existing.label || newInfo.label,
        showMean: existing.showMean,
        showStdError: existing.showStdError,
        showStdDev: existing.showStdDev,
        showVariance: existing.showVariance,
        codes: newInfo.codes.map((c) => {
          const ec = existing.codes.find((x) => x.code === c.code);
          return ec ? { ...c, label: ec.label || c.label, factor: ec.factor, visibility: ec.visibility } : c;
        }),
      };
    }
    return { variables: merged };
  }),

}));
