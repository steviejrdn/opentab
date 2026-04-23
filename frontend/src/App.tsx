import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useStore } from './store/useStore';
import { DndContext, useSensor, useSensors, PointerSensor, useDraggable, useDroppable, DragOverlay, closestCenter } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent as DndDragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { computeApi, dataApi } from './lib/api';
import type { FilterItem, CrosstabResult, VariableInfo, DropItem } from './lib/api';
import FilterTab from './components/FilterTab';
import { v4 as uuidv4 } from 'uuid';

// ─── Drag State Context ───────────────────────────────────────────────────────
const DragStateContext = React.createContext<{ activeDragId: string | null }>({ activeDragId: null });

// ─── Helper Functions ─────────────────────────────────────────────────────────
function buildNameToKeyMap(vars: Record<string, VariableInfo>): Record<string, string> {
  const map: Record<string, string> = {};
  Object.entries(vars).forEach(([key, info]) => {
    const displayName = info.name || info.label || key;
    map[displayName] = key;
  });
  return map;
}

function parseSimpleSyntax(text: string): { label?: string; stats?: string[]; codes?: { code: string; label?: string; factor?: number | null; visibility?: string; syntax?: string }[] } {
  const result: { label?: string; stats?: string[]; codes?: { code: string; label?: string; factor?: number | null; visibility?: string; syntax?: string }[] } = {};
  text = text.trim();
  const labelMatch = text.match(/label:\s*([^;|]+)/i);
  if (labelMatch) result.label = labelMatch[1].trim();
  const statsMatch = text.match(/stats:\s*([^;|]+)/i);
  if (statsMatch) result.stats = statsMatch[1].split(',').map((s) => s.trim());
  const codesMatch = text.match(/codes:\s*(.+)/i);
  if (codesMatch) {
    result.codes = [];
    const codePairs = codesMatch[1].split(/[,;](?=\d+:)/);
    for (const pair of codePairs) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx > 0) {
        const code = pair.slice(0, colonIdx).trim();
        const rest = pair.slice(colonIdx + 1).trim();
        const parts = rest.split(/\s+/);
        const codeEntry: { code: string; label?: string; factor?: number | null; visibility?: string; syntax?: string } = { code };
        let i = 0;
        while (i < parts.length) {
          const p = parts[i];
          if (p === 'label' && i + 1 < parts.length) {
            codeEntry.label = parts[i + 1];
            i += 2;
          } else if (p === 'factor' && i + 1 < parts.length) {
            codeEntry.factor = parts[i + 1] === 'null' ? null : parseFloat(parts[i + 1]);
            i += 2;
          } else if (p === 'vis' && i + 1 < parts.length) {
            codeEntry.visibility = parts[i + 1];
            i += 2;
          } else {
            codeEntry.syntax = rest;
            break;
          }
        }
        if (!codeEntry.syntax) codeEntry.syntax = rest;
        result.codes.push(codeEntry);
      }
    }
  }
  return result;
}

// ─── Nesting Helpers ──────────────────────────────────────────────────────────
function getTreeMaxDepth(item: DropItem): number {
  if (!item.children?.length) return 0;
  return 1 + Math.max(...item.children.map(getTreeMaxDepth));
}

interface ColHeaderCell { label: string; colSpan: number; rowSpan: number; }

function buildAxisStructure(
  items: DropItem[],
  getVisibleCodesList: (v: string) => string[],
  getLabel: (varCode: string) => string,
  resolveCode: (v: string, c: string) => string = (v, c) => `${v}/${c}`
): { headerRows: ColHeaderCell[][]; axisPaths: string[] } {
  if (items.length === 0) return { headerRows: [[]], axisPaths: [] };
  const maxDepth = Math.max(...items.map(getTreeMaxDepth));
  const numRows = maxDepth + 1;
  const headerRows: ColHeaderCell[][] = Array.from({ length: numRows }, () => []);
  const axisPaths: string[] = [];

  function getLeafCount(item: DropItem): number {
    const codes = getVisibleCodesList(item.variable);
    if (!item.children?.length) return codes.length;
    return codes.length * getLeafCount(item.children[0]);
  }

  function traverse(item: DropItem, depth: number, pathSoFar: string) {
    const codes = getVisibleCodesList(item.variable);
    const childLeafCount = item.children?.length ? getLeafCount(item.children[0]) : 1;
    for (const code of codes) {
      const codeKey = resolveCode(item.variable, code);
      const fullPath = pathSoFar ? `${pathSoFar}.${codeKey}` : codeKey;
      if (item.children?.length) {
        headerRows[depth].push({ label: getLabel(codeKey), colSpan: childLeafCount, rowSpan: 1 });
        traverse(item.children[0], depth + 1, fullPath);
      } else {
        headerRows[depth].push({ label: getLabel(codeKey), colSpan: 1, rowSpan: numRows - depth });
        axisPaths.push(fullPath);
      }
    }
  }

  items.forEach((item) => traverse(item, 0, ''));
  return { headerRows, axisPaths };
}

function flattenItemsForBackend(
  items: DropItem[],
  getVisibleCodesList: (v: string) => string[],
  parentPath = '',
  resolveCode: (v: string, c: string) => string = (v, c) => `${v}/${c}`
): { variable: string; codeDef: string }[] {
  const result: { variable: string; codeDef: string }[] = [];
  for (const item of items) {
    const codes = getVisibleCodesList(item.variable);
    if (!codes.length) continue;
    if (item.children?.length) {
      for (const code of codes) {
        const codeKey = resolveCode(item.variable, code);
        const fullPath = parentPath ? `${parentPath}.${codeKey}` : codeKey;
        result.push(...flattenItemsForBackend(item.children, getVisibleCodesList, fullPath, resolveCode));
      }
    } else {
      for (const code of codes) {
        const codeKey = resolveCode(item.variable, code);
        const fullPath = parentPath ? `${parentPath}.${codeKey}` : codeKey;
        result.push({ variable: item.variable, codeDef: fullPath });
      }
    }
  }
  return result;
}

function getAllNestedVars(items: DropItem[]): string[] {
  return items.flatMap((item) => [
    item.variable,
    ...(item.children?.length ? getAllNestedVars(item.children) : []),
  ]);
}

// ─── Theme Toggle ────────────────────────────────────────────────────────────
const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('opentab-theme') !== 'light');

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('opentab-theme', next ? 'dark' : 'light');
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 dark:text-zinc-600 select-none">☀</span>
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
          isDark ? 'bg-zinc-600' : 'bg-zinc-300'
        }`}
      >
        <span
          className={`pointer-events-none mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            isDark ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-xs text-zinc-400 dark:text-zinc-600 select-none">☾</span>
    </div>
  );
};

// ─── Navigation ──────────────────────────────────────────────────────────────
const Navigation: React.FC = () => {
  const location = useLocation();
  const { dataLoaded, variables, tables, folders, displayOptions, activeTableId, fileName, rowCount,
          importState, setDataLoaded, resetSession } = useStore();
  const openFileRef = useRef<HTMLInputElement>(null);
  const opentabHandle = useRef<FileSystemFileHandle | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<{ loading: boolean; message: string } | null>(null);

  const buildPayload = async () => {
    const [rawCsv, mergedVars] = await Promise.all([
      dataApi.getRawCsv(),
      dataApi.getMergedVariables(),
    ]);
    return {
      version: 2,
      fileName, rowCount, variables, tables, folders, displayOptions, activeTableId,
      csvData: rawCsv,
      mergedVariables: mergedVars,
    };
  };

  const writeToHandle = async (handle: FileSystemFileHandle, payload: object) => {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
  };

  const fsaSupported = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

  const handleSave = async () => {
    try {
      const payload = await buildPayload();

      if (fsaSupported) {
        if (!opentabHandle.current) {
          // First save — ask user where to save
          const showSaveFilePicker = (window as unknown as { showSaveFilePicker: (o: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
          opentabHandle.current = await showSaveFilePicker({
            suggestedName: `${fileName?.replace(/\.[^.]+$/, '') || 'session'}.opentab`,
            types: [{ description: 'opentab session', accept: { 'application/json': ['.opentab'] } }],
          });
        }
        await writeToHandle(opentabHandle.current, payload);
        setRestoreStatus({ loading: false, message: 'Saved' });
        setTimeout(() => setRestoreStatus(null), 2000);
      } else {
        // Fallback for browsers without File System Access API
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName?.replace(/\.[^.]+$/, '') || 'session'}.opentab`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      // User cancelled the picker — not an error
      if (err instanceof Error && err.name === 'AbortError') return;
      alert('Save failed — ensure data is loaded.');
    }
  };

  const handleSaveAs = async () => {
    if (!fsaSupported) { handleSave(); return; }
    try {
      const payload = await buildPayload();
      const showSaveFilePicker = (window as unknown as { showSaveFilePicker: (o: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
      const handle = await showSaveFilePicker({
        suggestedName: `${fileName?.replace(/\.[^.]+$/, '') || 'session'}.opentab`,
        types: [{ description: 'opentab session', accept: { 'application/json': ['.opentab'] } }],
      });
      opentabHandle.current = handle;
      await writeToHandle(handle, payload);
      setRestoreStatus({ loading: false, message: 'Saved' });
      setTimeout(() => setRestoreStatus(null), 2000);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      alert('Save failed — ensure data is loaded.');
    }
  };

  const restoreFromText = async (jsonText: string, fallbackName: string) => {
    const data = JSON.parse(jsonText);
    if (!data.variables || !data.tables) throw new Error('Invalid .opentab file');

    if (data.version === 2 && data.csvData) {
      setRestoreStatus({ loading: true, message: 'Restoring session...' });
      const uploadResult = await dataApi.uploadText(data.csvData, data.fileName || 'restored.csv');
      const mergedEntries = Object.entries(data.mergedVariables || {});
      for (const [name, meta] of mergedEntries) {
        try { await dataApi.registerMerged(name, meta as object); } catch { /* skip bad entry */ }
      }
      // Use saved variables directly - don't fetch from backend which loses custom codes
      importState({
        variables: data.variables, tables: data.tables,
        displayOptions: data.displayOptions ?? {}, activeTableId: data.activeTableId ?? null,
        fileName: data.fileName ?? null, rowCount: uploadResult.row_count,
        folders: data.folders ?? [],
      });
      setDataLoaded(true);
      setRestoreStatus({ loading: false, message: `Restored: ${data.fileName || fallbackName}` });
      setTimeout(() => setRestoreStatus(null), 3000);
    } else {
      importState({
        variables: data.variables, tables: data.tables,
        displayOptions: data.displayOptions ?? {}, activeTableId: data.activeTableId ?? null,
        fileName: data.fileName ?? null, rowCount: data.rowCount ?? 0,
      });
      setDataLoaded(false);
    }
  };

  const handleOpen = async () => {
    opentabHandle.current = null;
    if (fsaSupported) {
      try {
        const showOpenFilePicker = (window as unknown as { showOpenFilePicker: (o: object) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker;
        const [handle] = await showOpenFilePicker({
          types: [{ description: 'opentab session', accept: { 'application/json': ['.opentab'] } }],
        });
        opentabHandle.current = handle;
        const file = await handle.getFile();
        const text = await file.text();
        await restoreFromText(text, file.name);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Fall back to input picker if FSA fails unexpectedly
        openFileRef.current?.click();
      }
    } else {
      openFileRef.current?.click();
    }
  };

  const handleOpenFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await restoreFromText(ev.target?.result as string, file.name);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        setRestoreStatus({ loading: false, message: 'Restore failed: ' + msg });
        setTimeout(() => setRestoreStatus(null), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
    <nav className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex justify-between items-center">
      <div className="flex items-center gap-3">
        {/* Logo — click to reset session */}
        <button
          onClick={() => { if (window.confirm('Start a new session? All tables and data will be cleared.')) { resetSession(); opentabHandle.current = null; } }}
          className="flex items-center focus:outline-none"
          title="New session"
        >
          <img src="/logo_black.svg" alt="opentab" className="h-5 block dark:hidden" />
          <img src="/logo_white.svg" alt="opentab" className="h-5 hidden dark:block" />
        </button>
        <span className="text-xs text-zinc-400 dark:text-zinc-600 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 leading-none">
          alpha
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          <Link
            to="/build"
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              location.pathname === '/build'
                ? 'text-zinc-900 dark:text-zinc-100 border-b border-blue-600 dark:border-blue-500'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            build
          </Link>
          {dataLoaded && (
            <Link
              to="/edit-variables"
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                location.pathname.startsWith('/edit-variables')
                  ? 'text-zinc-900 dark:text-zinc-100 border-b border-blue-600 dark:border-blue-500'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              variables
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-3">
          {dataLoaded && (
            <>
              <button
                onClick={handleSave}
                title={fsaSupported ? (opentabHandle.current ? 'Save (overwrite)' : 'Save') : 'Save (download)'}
                className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                save
              </button>
              {fsaSupported && opentabHandle.current && (
                <button
                  onClick={handleSaveAs}
                  title="Save as new file"
                  className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  save as
                </button>
              )}
            </>
          )}
          <button
            onClick={handleOpen}
            title="Open .opentab session"
            className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            open
          </button>
          <input ref={openFileRef} type="file" accept=".opentab" className="hidden" onChange={handleOpenFallback} />
        </div>
        <ThemeToggle />
      </div>
    </nav>
    {restoreStatus && (
      <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 text-xs border shadow-lg max-w-xs
        ${restoreStatus.loading
          ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 animate-pulse'
          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'}`}>
        {restoreStatus.message}
      </div>
    )}
    </>
  );
};

// ─── Welcome Screen ───────────────────────────────────────────────────────────
const WelcomeScreen: React.FC<{ onLoadSample: () => void; loading: boolean }> = ({ onLoadSample, loading }) => {
  const { setDataLoaded, mergeAndSetVariables, setDataInfo, fileName } = useStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'info'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: File[]) => {
    const csvFiles = files.filter(f => /\.(csv|txt)$/i.test(f.name));

    if (csvFiles.length === 0) {
      setStatus({ type: 'error', message: 'Unsupported file format. Drop a .csv or .txt file.' });
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const result = await dataApi.uploadFile(csvFiles[0]);
      const vars = await dataApi.getVariables();
      mergeAndSetVariables(vars);
      setDataInfo(csvFiles[0].name, result.row_count);
      setDataLoaded(true);
    } catch (e: any) {
      const detail = e.response?.data?.detail || e.message || 'Upload failed.';
      setStatus({ type: 'error', message: detail });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    await processFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 p-8">
      {/* Heading */}
      <div className="text-center space-y-1">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100 tracking-wide">
          welcome to opentab_
        </h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          {fileName ? <>load <span className="text-zinc-600 dark:text-zinc-400 font-medium">'{fileName}'</span> to start</> : 'load a dataset to get started'}
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`w-full max-w-sm border-2 border-dashed transition-all p-12 text-center ${
          uploading
            ? 'border-zinc-300 dark:border-zinc-700 cursor-wait'
            : isDragOver
            ? 'border-blue-500 bg-blue-500/5 cursor-copy'
            : 'border-zinc-300 dark:border-zinc-700 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.txt"
          onChange={handleFileInput}
        />
        {uploading ? (
          <p className="text-xs text-zinc-500 animate-pulse">uploading...</p>
        ) : isDragOver ? (
          <p className="text-xs text-blue-500">drop to load</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              drag &amp; drop files here
            </p>
            <p className="text-xs text-zinc-300 dark:text-zinc-700 tracking-widest">
              .csv · .txt
            </p>
            <p className="text-xs text-zinc-300 dark:text-zinc-700">
              or click to browse
            </p>
          </div>
        )}
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`text-xs px-3 py-2 border w-full max-w-sm ${
            status.type === 'error'
              ? 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
              : 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30'
          }`}
        >
          {status.message}
        </div>
      )}

      {/* Sample data link */}
      <p className="text-xs text-zinc-400 dark:text-zinc-600">
        or{' '}
        <button
          onClick={onLoadSample}
          disabled={loading || uploading}
          className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'loading...' : 'load sample data'}
        </button>
      </p>

    </div>
  );
};

// ─── Syntax Builder Modal ─────────────────────────────────────────────────────
interface SyntaxBuilderModalProps {
  initialSyntax?: string;
  onSave: (syntax: string) => void;
  onClose: () => void;
}

const SyntaxBuilderModal: React.FC<SyntaxBuilderModalProps> = ({ initialSyntax = '', onSave, onClose }) => {
  const { variables } = useStore();
  const [rawSyntax, setRawSyntax] = useState(initialSyntax);
  const [searchVar, setSearchVar] = useState('');
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());
  const [notMode, setNotMode] = useState(false);

  const nameToKeyMap = buildNameToKeyMap(variables);

  const parseSyntaxAtoms = (syntax: string) => {
    const atomRe = /([A-Za-z_][A-Za-z0-9_]*)\/([^+()\s!.]+)/g;
    const atoms: { varName: string; codePart: string; full: string; start: number; end: number; isNot: boolean }[] = [];
    let match;
    while ((match = atomRe.exec(syntax)) !== null) {
      const codePart = match[2];
      const isNot = codePart.startsWith('n');
      atoms.push({ varName: match[1], codePart, full: match[0], start: match.index, end: match.index + match[0].length, isNot });
    }
    return atoms;
  };

  const atoms = parseSyntaxAtoms(rawSyntax);

  const getLabelForAtom = (varName: string, codePart: string, isNot: boolean) => {
    const resolvedKey = nameToKeyMap[varName] || varName;
    const vInfo = variables[resolvedKey];
    const cleanCodePart = isNot ? codePart.slice(1) : codePart;
    if (!vInfo) return { varLabel: varName, codeLabel: `?${cleanCodePart}?` };
    const varLabel = vInfo.label || varName;
    let codeLabel = `?${cleanCodePart}?`;
    if (cleanCodePart === '*') codeLabel = '* (any)';
    else if (cleanCodePart.includes('..')) {
      const [from, to] = cleanCodePart.split('..');
      const fromCode = vInfo.codes?.find((c: any) => c.code === from);
      const toCode = vInfo.codes?.find((c: any) => c.code === to);
      codeLabel = `${fromCode?.label || from} .. ${toCode?.label || to}`;
    } else {
      const code = vInfo.codes?.find((c: any) => c.code === cleanCodePart);
      codeLabel = code?.label || cleanCodePart;
    }
    return { varLabel, codeLabel };
  };

  const insertAtCursor = (insert: string) => {
    const textarea = document.getElementById('syntax-input') as HTMLTextAreaElement;
    const pos = textarea?.selectionStart ?? rawSyntax.length;
    const before = rawSyntax.slice(0, pos);
    const after = rawSyntax.slice(pos);
    setRawSyntax(before + insert + after);
    setTimeout(() => { textarea?.focus(); textarea?.setSelectionRange(pos + insert.length, pos + insert.length); }, 0);
  };

  const insertCode = (_varKey: string, varName: string, code: string) => {
    const prefix = notMode ? 'n' : '';
    insertAtCursor(`${varName}/${prefix}${code}`);
  };

  const toggleVar = (key: string) => {
    setExpandedVars((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const filteredVars = Object.entries(variables).filter(([key, vInfo]) => {
    if (!searchVar) return true;
    const search = searchVar.toLowerCase();
    return (vInfo.name || key).toLowerCase().includes(search) || (vInfo.label || '').toLowerCase().includes(search);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[820px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Build Syntax</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-hidden flex">
          <div className="w-80 border-r border-zinc-200 dark:border-zinc-700 flex flex-col">
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
              <input type="text" value={searchVar} onChange={(e) => setSearchVar(e.target.value)} placeholder="search variables..." className="w-full text-xs px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 outline-none focus:border-blue-400" />
            </div>
            <div className="flex-1 overflow-auto">
              {filteredVars.map(([key, vInfo]) => {
                const isExpanded = expandedVars.has(key);
                return (
                  <div key={key} className="border-b border-zinc-100 dark:border-zinc-800">
                    <button onClick={() => toggleVar(key)} className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-left">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate">{vInfo.name || key}</div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{vInfo.label || ''}</div>
                      </div>
                      <span className={`text-zinc-400 dark:text-zinc-600 text-xs ml-2 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-2 flex flex-wrap gap-1">
                        {vInfo.codes?.map((c: any) => (
                          <button key={c.code} onClick={() => insertCode(key, vInfo.name || key, c.code)} className={`text-[10px] px-2 py-1 border rounded transition-colors ${notMode ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'}`} title={`${c.code} — ${c.label}`}>
                            {notMode ? <span className="flex items-center gap-1"><span>{c.label}</span><span className="text-[8px] font-bold">NOT</span></span> : c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredVars.length === 0 && <div className="p-4 text-xs text-zinc-400 dark:text-zinc-500 text-center">no variables found</div>}
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 min-h-[120px] max-h-[180px] overflow-auto">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">preview</div>
              {atoms.length === 0 ? (
                <div className="text-xs text-zinc-400 dark:text-zinc-500 italic">click codes to add them here</div>
              ) : (
                <div className="text-xs space-y-2">
                  {(() => {
                    const rows: React.ReactNode[][] = []; let currentRow: React.ReactNode[] = []; let lastEnd = 0;
                    atoms.forEach((atom, idx) => {
                      const before = rawSyntax.slice(lastEnd, atom.start);
                      if (before) { const tokens = before.match(/[+.]|\(|\)/g) || []; tokens.forEach((tok, ti) => { if (tok === '+') currentRow.push(<span key={`op-${idx}-${ti}`} className="mx-1 text-emerald-600 dark:text-emerald-400 font-medium">OR</span>); else if (tok === '.') currentRow.push(<span key={`op-${idx}-${ti}`} className="mx-1 text-blue-500 font-medium">AND</span>); else if (tok === '(') currentRow.push(<span key={`op-${idx}-${ti}`} className="text-zinc-400">(</span>); else if (tok === ')') currentRow.push(<span key={`op-${idx}-${ti}`} className="text-zinc-400">)</span>); }); }
                      const cleanCode = atom.isNot ? atom.codePart.slice(1) : atom.codePart;
                      const { varLabel, codeLabel } = getLabelForAtom(atom.varName, atom.codePart, atom.isNot);
                      const displayCode = atom.isNot ? `n${cleanCode}` : cleanCode;
                      currentRow.push(<span key={`atom-${idx}`} className="inline-flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded">{atom.isNot && <span className="text-[9px] font-bold text-red-500 dark:text-red-400">NOT</span>}<span className="font-mono text-purple-600 dark:text-purple-400">{atom.varName}/{displayCode}</span><span className="text-zinc-300 dark:text-zinc-600">=</span><span className="text-zinc-600 dark:text-zinc-300">{varLabel}/{codeLabel}</span></span>);
                      lastEnd = atom.end;
                    });
                    const after = rawSyntax.slice(lastEnd);
                    if (after) { const tokens = after.match(/[+.]|\(|\)/g) || []; tokens.forEach((tok, ti) => { if (tok === '+') currentRow.push(<span key={`op-after-${ti}`} className="mx-1 text-emerald-600 dark:text-emerald-400 font-medium">OR</span>); else if (tok === '.') currentRow.push(<span key={`op-after-${ti}`} className="mx-1 text-blue-500 font-medium">AND</span>); else if (tok === '(') currentRow.push(<span key={`op-after-${ti}`} className="text-zinc-400">(</span>); else if (tok === ')') currentRow.push(<span key={`op-after-${ti}`} className="text-zinc-400">)</span>); }); }
                    if (currentRow.length > 0) rows.push(currentRow);
                    return rows.map((row, ri) => <div key={`row-${ri}`} className="flex items-center gap-1 flex-wrap">{row}</div>);
                  })()}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => insertAtCursor('+')} className="text-xs px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded font-medium">OR</button>
                <button onClick={() => insertAtCursor('.')} className="text-xs px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded font-medium">AND</button>
                <button onClick={() => insertAtCursor('(')} className="text-xs px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded font-medium">(</button>
                <button onClick={() => insertAtCursor(')')} className="text-xs px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded font-medium">)</button>
                <button onClick={() => setNotMode((prev) => !prev)} className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${notMode ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300'}`}>NOT</button>
              </div>
              {notMode && <div className="text-[10px] text-red-500 dark:text-red-400 mt-1">NOT mode: next code will be negated (e.g. ol/n8)</div>}
            </div>
            <div className="flex-1 p-4">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">syntax</div>
              <textarea id="syntax-input" value={rawSyntax} onChange={(e) => setRawSyntax(e.target.value)} className="w-full h-full min-h-[80px] text-sm font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-zinc-700 dark:text-zinc-300 outline-none focus:border-blue-400 dark:focus:border-blue-500 resize-none" placeholder="e.g. ol/8+ol/9 or (ses/2+ses/3).age/2" autoFocus />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
          <button onClick={onClose} className="text-xs px-4 py-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors">cancel</button>
          <button onClick={() => { onSave(rawSyntax); onClose(); }} disabled={!rawSyntax.trim()} className="text-xs px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white transition-colors">save</button>
        </div>
      </div>
    </div>
  );
};

// ─── Variable Syntax Modal ───────────────────────────────────────────────────
interface VariableSyntaxModalProps {
  varKey: string;
  varName: string;
  info: VariableInfo;
  onClose: () => void;
  updateVariableLabel: (varKey: string, label: string) => void;
  toggleVariableStat: (varKey: string, stat: 'showMean' | 'showStdError' | 'showStdDev' | 'showVariance') => void;
  updateCodeLabel: (varKey: string, code: string, label: string) => void;
  updateCodeFactor: (varKey: string, code: string, factor: number | null) => void;
  updateCodeVisibility: (varKey: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  updateCodeSyntax: (varKey: string, code: string, syntax: string) => void;
}

const VariableSyntaxModal: React.FC<VariableSyntaxModalProps> = ({ varKey, varName, info, onClose, updateVariableLabel, toggleVariableStat, updateCodeLabel, updateCodeFactor, updateCodeVisibility, updateCodeSyntax }) => {
  const getVariableSyntax = (v: VariableInfo) => {
    const stats: string[] = [];
    if (v.showMean) stats.push('mean');
    if (v.showStdError) stats.push('std_error');
    if (v.showStdDev) stats.push('std_dev');
    if (v.showVariance) stats.push('variance');
    const varName = v.name || varKey;
    const codesParts = v.codes.map((c: any, i: number) => {
      const syntax = v.code_syntax?.[i] || '';
      let parts: string[] = [];
      if (syntax && syntax !== `${varName}/${c.code}`) parts.push(syntax);
      if (c.label && c.label !== c.code) parts.push(`label ${c.label}`);
      if (c.factor !== undefined && c.factor !== null) parts.push(`factor ${c.factor}`);
      if (c.visibility && c.visibility !== 'visible') parts.push(`vis ${c.visibility}`);
      return parts.length > 0 ? `${c.code}:${parts.join(' ')}` : null;
    }).filter(Boolean);
    let result = `label:${v.label || ''}`;
    if (stats.length > 0) result += `; stats:${stats.join(',')}`;
    if (codesParts.length > 0) result += `; codes:${codesParts.join(',')}`;
    return result;
  };

  const [syntax, setSyntax] = useState(() => getVariableSyntax(info));
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    try {
      let parsed: any;
      if (syntax.trim().startsWith('{')) parsed = JSON.parse(syntax);
      else parsed = parseSimpleSyntax(syntax);
      if (parsed.label !== undefined) updateVariableLabel(varKey, parsed.label);
      if (parsed.stats) ['showMean', 'showStdError', 'showStdDev', 'showVariance'].forEach((s) => { const statKey = s as 'showMean' | 'showStdError' | 'showStdDev' | 'showVariance'; if (parsed.stats.includes(s.replace('show', '').toLowerCase()) !== info[statKey]) toggleVariableStat(varKey, statKey); });
      if (parsed.codes && Array.isArray(parsed.codes)) parsed.codes.forEach((cd: any) => { const codeInfo = info.codes.find((c: any) => c.code === cd.code); if (codeInfo) { if (cd.label !== undefined) updateCodeLabel(varKey, cd.code, cd.label); if (cd.factor !== undefined) updateCodeFactor(varKey, cd.code, cd.factor); if (cd.visibility) updateCodeVisibility(varKey, cd.code, cd.visibility); if (cd.syntax) updateCodeSyntax(varKey, cd.code, cd.syntax); } });
      setError(null); onClose();
    } catch (e: any) { setError(e.message || 'Invalid syntax'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Variable Syntax: {varName}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Format: <span className="font-mono">label:X; stats:a,b; codes:1:syntax,2:syntax</span></div>
            <textarea value={syntax} onChange={(e) => { setSyntax(e.target.value); setError(null); }} className="w-full h-48 text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-zinc-700 dark:text-zinc-300 outline-none focus:border-blue-400 dark:focus:border-blue-500 resize-none" placeholder="label:Name; stats:mean,std; codes:1:syntax label X factor 1 vis visible" />
            {error && <div className="text-xs text-red-500">{error}</div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
          <button onClick={onClose} className="text-xs px-4 py-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors">cancel</button>
          <button onClick={handleApply} className="text-xs px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors">apply</button>
        </div>
      </div>
    </div>
  );
};

// ─── Draggable Variable ───────────────────────────────────────────────────────
const DraggableVariable: React.FC<{ name: string; displayName: string; label: string; codeCount: number }> = ({ name, displayName, label, codeCount }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: name });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`px-3 py-2 border cursor-grab select-none transition-colors ${
        isDragging
          ? 'opacity-40 bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600'
          : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
      }`}
    >
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{displayName}</span>
          <span className="text-xs text-zinc-500 block truncate">{label}</span>
        </div>
        <span className="text-xs text-zinc-400 dark:text-zinc-600 shrink-0">{codeCount}</span>
      </div>
    </div>
  );
};

// ─── Variable List ────────────────────────────────────────────────────────────
const VariableList: React.FC = () => {
  const { variables, dataLoaded } = useStore();
  const [search, setSearch] = useState('');
  if (!dataLoaded) return (
    <div className="flex flex-col h-full px-3 py-3">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">variables</span>
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-xs">load data first</div>
    </div>
  );
  const q = search.toLowerCase();
  const filtered = Object.entries(variables).filter(([name, info]) =>
    name.toLowerCase().includes(q) || (info.name || '').toLowerCase().includes(q) || (info.label || '').toLowerCase().includes(q)
  );
  return (
    <div className="flex flex-col h-full px-3 py-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">variables</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-600">{filtered.length}/{Object.keys(variables).length}</span>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="search..."
        className="mb-2 px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 w-full"
      />
      <div className="flex-1 overflow-y-auto space-y-1">
        {filtered.map(([name, info]) => (
          <DraggableVariable key={name} name={name} displayName={info.name || name} label={info.label} codeCount={info.codes.length} />
        ))}
        {filtered.length === 0 && (
          <div className="text-xs text-zinc-400 dark:text-zinc-600 italic px-1">no match</div>
        )}
      </div>
    </div>
  );
};

// ─── Table List ───────────────────────────────────────────────────────────────
const TableRow: React.FC<{
  table: any;
  isActive: boolean;
  onActivate: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
  folders: any[];
  onMoveToFolder: (folderId: string | null) => void;
}> = ({ table, isActive, onActivate, onDelete, onRename, folders, onMoveToFolder }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tbl-${table.id}` });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(table.name);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== table.name) onRename(v); else setDraft(table.name);
    setEditing(false);
  };

  const otherFolders = folders.filter((f: any) => f.id !== table.folderId);

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex items-center gap-1.5 px-2 py-1.5 cursor-pointer border transition-colors ${isDragging ? 'opacity-40' : ''} ${
        isActive
          ? 'bg-zinc-100 dark:bg-zinc-800 border-l-2 border-l-blue-600 dark:border-l-blue-500 border-blue-200 dark:border-blue-500/30'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
      onClick={onActivate}
    >
      <span
        {...listeners} {...attributes}
        className="text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 cursor-grab active:cursor-grabbing flex-shrink-0 text-xs"
        onClick={(e) => e.stopPropagation()}
      >⠿</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(table.name); setEditing(false); } }}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-blue-400 px-1 outline-none font-mono"
        />
      ) : (
        <span
          className={`flex-1 text-xs font-medium truncate ${isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
        >{table.name}</span>
      )}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 text-xs px-0.5"
          >⋮</button>
          {showMenu && (
            <div ref={menuRef} className="absolute right-0 top-5 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg py-1 w-40 text-xs" onClick={(e) => e.stopPropagation()}>
              {otherFolders.map((f: any) => (
                <button key={f.id} className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" onClick={() => { onMoveToFolder(f.id); setShowMenu(false); }}>
                  → {f.name}
                </button>
              ))}
              {table.folderId && (
                <button className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500" onClick={() => { onMoveToFolder(null); setShowMenu(false); }}>
                  ↑ remove from folder
                </button>
              )}
              {otherFolders.length === 0 && !table.folderId && (
                <span className="px-3 py-1.5 text-zinc-400 italic block">no folders yet</span>
              )}
            </div>
          )}
        </div>
        <button onClick={onDelete} className="text-zinc-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 text-xs">×</button>
      </div>
    </div>
  );
};

const FolderRow: React.FC<{
  folder: any;
  tables: any[];
  activeTableId: string | null;
  onActivate: (id: string) => void;
  onDeleteTable: (id: string, e: React.MouseEvent) => void;
  onRenameTable: (id: string, name: string) => void;
  onMoveTable: (tableId: string, folderId: string | null) => void;
  onToggle: () => void;
  onRenameFolder: (name: string) => void;
  onDeleteFolder: () => void;
  allFolders: any[];
}> = ({ folder, tables, activeTableId, onActivate, onDeleteTable, onRenameTable, onMoveTable, onToggle, onRenameFolder, onDeleteFolder, allFolders }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `fldr-${folder.id}` });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== folder.name) onRenameFolder(v); else setDraft(folder.name);
    setEditing(false);
  };

  return (
    <div>
      <div
        ref={setNodeRef}
        className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer border transition-colors ${
          isOver ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-400' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
        onClick={onToggle}
      >
        <span className="text-zinc-400 text-xs w-3">{folder.isOpen ? '▾' : '▸'}</span>
        <span className="text-xs">📁</span>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(folder.name); setEditing(false); } }}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-blue-400 px-1 outline-none font-mono"
          />
        ) : (
          <span className="flex-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
            {folder.name}
          </span>
        )}
        <span className="text-xs text-zinc-300 dark:text-zinc-700">{tables.length}</span>
        <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(); }} className="opacity-0 group-hover:opacity-100 text-zinc-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 text-xs">×</button>
      </div>
      {folder.isOpen && (
        <div className="ml-3 border-l border-zinc-200 dark:border-zinc-800 pl-1 space-y-0.5 mt-0.5">
          {tables.length === 0 ? (
            <div className={`text-xs italic px-2 py-1.5 border border-dashed transition-colors ${isOver ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20 text-blue-400' : 'border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700'}`}>
              drag tables here
            </div>
          ) : (
            tables.map((t: any) => (
              <TableRow
                key={t.id}
                table={t}
                isActive={activeTableId === t.id}
                onActivate={() => onActivate(t.id)}
                onDelete={(e) => onDeleteTable(t.id, e)}
                onRename={(name) => onRenameTable(t.id, name)}
                folders={allFolders.filter((f: any) => f.id !== folder.id)}
                onMoveToFolder={(fid) => onMoveTable(t.id, fid)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// RootDropZone must be a child component so useDroppable registers with the inner DndContext
const RootDropZone: React.FC<{
  tables: any[];
  activeTableId: string | null;
  setActiveTable: (id: string) => void;
  deleteTable: (id: string) => void;
  updateTable: (id: string, u: any) => void;
  folders: any[];
  isDraggingAny: boolean;
}> = ({ tables, activeTableId, setActiveTable, deleteTable, updateTable, folders, isDraggingAny }) => {
  const { isOver, setNodeRef } = useDroppable({ id: 'fldr-root' });
  const ungrouped = tables.filter((t: any) => !t.folderId);
  const showPlaceholder = isDraggingAny && ungrouped.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={`space-y-0.5 rounded transition-colors ${isOver ? 'bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-300 p-0.5' : ''} ${showPlaceholder ? 'min-h-[32px] border border-dashed border-zinc-300 dark:border-zinc-700' : 'min-h-[4px]'}`}
    >
      {showPlaceholder && !isOver && (
        <div className="text-xs text-zinc-300 dark:text-zinc-700 italic px-2 py-1.5">drop here to ungroup</div>
      )}
      {isOver && ungrouped.length === 0 && (
        <div className="text-xs text-blue-400 italic px-2 py-1.5">drop here to ungroup</div>
      )}
      {ungrouped.map((t: any) => (
        <TableRow
          key={t.id}
          table={t}
          isActive={activeTableId === t.id}
          onActivate={() => setActiveTable(t.id)}
          onDelete={(e) => { e.stopPropagation(); deleteTable(t.id); }}
          onRename={(name) => updateTable(t.id, { name })}
          folders={folders}
          onMoveToFolder={(fid) => updateTable(t.id, { folderId: fid })}
        />
      ))}
    </div>
  );
};

// ─── Build Page Layout with Resizable Sidebar ─────────────────────────────────
const BuildPageLayout: React.FC<{ onLoadSample: () => void; loading: boolean }> = ({ onLoadSample, loading }) => {
  const { sidebarWidth, sidebarVisible, setSidebarWidth, toggleSidebar } = useStore();
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="flex-1 overflow-hidden flex relative">
      {/* Full-screen overlay during resize — prevents text selection and cursor flicker */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}
      {/* Sidebar — always in DOM, width animates for drawer effect */}
      <div
        style={{ width: sidebarVisible ? `${sidebarWidth}px` : '0px' }}
        className={`bg-zinc-50 dark:bg-zinc-900 flex-shrink-0 relative overflow-hidden ${isResizing ? '' : 'transition-[width] duration-200 ease-in-out'}`}
      >
        {/* Inner wrapper keeps content at full width while outer clips */}
        <div className="absolute inset-0 flex flex-col" style={{ width: `${sidebarWidth}px` }}>
          <div className="h-1/2 flex flex-col border-b border-zinc-200 dark:border-zinc-800"><TableList /></div>
          <div className="h-1/2 flex flex-col"><VariableList /></div>
        </div>
      </div>

      {/* Drawer tab + resize handle — always at the seam */}
      <div className="flex-shrink-0 flex self-stretch border-x border-zinc-200 dark:border-zinc-700">
        <button
          onClick={toggleSidebar}
          title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          className="w-3 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors text-[10px] cursor-pointer"
        >
          {sidebarVisible ? '‹' : '›'}
        </button>
        <div
          onMouseDown={() => setIsResizing(true)}
          className="w-1 cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors"
        />
      </div>

      <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-950">
        <BuildPage onLoadSample={onLoadSample} loading={loading} />
      </div>
    </div>
  );
};

const TableList: React.FC = () => {
  const { tables, activeTableId, folders, addTable, setActiveTable, deleteTable, updateTable, addFolder, deleteFolder, renameFolder, toggleFolder } = useStore();
  const [activeTblDragId, setActiveTblDragId] = useState<string | null>(null);

  const handleCreate = () => {
    const newTable = {
      id: uuidv4().slice(0, 8),
      name: `table_${tables.length + 1}`,
      row_items: [],
      col_items: [],
      filter_items: [],
      weight_col: null,
      filter_def: null,
      result: null as any,
    };
    addTable(newTable);
    setActiveTable(newTable.id);
  };

  const handleDragEnd = (event: DndDragEndEvent) => {
    setActiveTblDragId(null);
    const { active, over } = event;
    if (!over) return;
    const tableId = String(active.id).replace('tbl-', '');
    const overId = String(over.id);
    if (overId === 'fldr-root') updateTable(tableId, { folderId: null });
    else if (overId.startsWith('fldr-')) updateTable(tableId, { folderId: overId.replace('fldr-', '') });
  };

  const activeTbl = activeTblDragId ? tables.find((t) => t.id === activeTblDragId.replace('tbl-', '')) : null;

  return (
    <DndContext
      onDragStart={(e) => setActiveTblDragId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTblDragId(null)}
    >
      <div className="flex flex-col h-full px-3 py-3">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">tables</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-600">{tables.length + folders.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              tables={tables.filter((t) => t.folderId === folder.id)}
              activeTableId={activeTableId}
              onActivate={setActiveTable}
              onDeleteTable={(id, e) => { e.stopPropagation(); deleteTable(id); }}
              onRenameTable={(id, name) => updateTable(id, { name })}
              onMoveTable={(tableId, folderId) => updateTable(tableId, { folderId })}
              onToggle={() => toggleFolder(folder.id)}
              onRenameFolder={(name) => renameFolder(folder.id, name)}
              onDeleteFolder={() => deleteFolder(folder.id)}
              allFolders={folders}
            />
          ))}
          <RootDropZone
            tables={tables}
            activeTableId={activeTableId}
            setActiveTable={setActiveTable}
            deleteTable={deleteTable}
            updateTable={updateTable}
            folders={folders}
            isDraggingAny={!!activeTblDragId}
          />
        </div>
        <div className="mt-3 flex gap-1.5">
          <button onClick={handleCreate} className="flex-1 py-1.5 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 text-xs hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            + table
          </button>
          <button onClick={() => addFolder(`folder_${folders.length + 1}`)} className="flex-1 py-1.5 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 text-xs hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            + folder
          </button>
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTbl ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-zinc-900 border-2 border-blue-400 shadow-2xl cursor-grabbing w-44 rotate-1 opacity-95">
            <span className="text-zinc-300 text-xs">⠿</span>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">{activeTbl.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

// ─── Nesting Builder Modal ─────────────────────────────────────────────────────
interface NestingBuilderModalProps {
  item: DropItem;
  zoneType: 'row' | 'col';
  onClose: () => void;
}

const NestingBuilderItem: React.FC<{
  item: DropItem;
  zoneType: 'row' | 'col';
  onRemove: (id: string) => void;
  onAddChild: (parentId: string) => void;
  depth?: number;
}> = ({ item, zoneType, onRemove, onAddChild, depth = 0 }) => {
  const { variables } = useStore();
  const displayName = variables[item.variable]?.name || item.variable;
  const hasChildren = (item.children?.length || 0) > 0;

  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 ${depth === 0 ? 'rounded-t-lg' : 'border-t-0'} ${hasChildren ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium truncate ${depth === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>{displayName}</div>
          {depth === 0 && <div className="text-[10px] text-zinc-400 mt-0.5">{item.variable}</div>}
        </div>
        {depth < 3 && !hasChildren && (
          <button
            onClick={() => onAddChild(item.id)}
            className="w-6 h-6 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors text-sm"
            title="Add nested variable"
          >+</button>
        )}
        <button
          onClick={() => onRemove(item.id)}
          className="w-6 h-6 flex items-center justify-center text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors text-sm"
        >×</button>
      </div>
      {hasChildren && (
        <div className={`ml-4 pl-3 border-l-2 border-blue-200 dark:border-blue-800 mt-0.5 space-y-0.5`}>
          {item.children!.map((child) => (
            <NestingBuilderItem key={child.id} item={child} zoneType={zoneType} onRemove={onRemove} onAddChild={onAddChild} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const NestingBuilderModal: React.FC<NestingBuilderModalProps> = ({ item, zoneType, onClose }) => {
  const { variables, activeTableId, nestItem } = useStore();
  const displayName = variables[item.variable]?.name || item.variable;
  const [showPicker, setShowPicker] = useState(false);
  const [nestSearch, setNestSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const nestSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const handleAddChild = (parentId: string) => {
    setSelectedParent(parentId);
    setShowPicker(true);
    setNestSearch('');
    setTimeout(() => nestSearchRef.current?.focus(), 50);
  };

  const handleConfirmAdd = (varName: string) => {
    if (!activeTableId || !selectedParent) return;
    const varInfo = variables[varName];
    if (!varInfo?.codes?.length) return;
    const allCodes = varInfo.codes.map((c: any) => c.code).join(',');
    nestItem(activeTableId, zoneType, selectedParent, { id: uuidv4(), variable: varName, codeDef: allCodes });
    setShowPicker(false);
    setSelectedParent(null);
    setNestSearch('');
  };

  const handleRemove = (id: string) => {
    if (!activeTableId) return;
    if (zoneType === 'row') {
      useStore.getState().removeRowItem(activeTableId, id);
    } else {
      useStore.getState().removeColItem(activeTableId, id);
    }
  };

  const q = nestSearch.toLowerCase();
  const matches = Object.entries(variables).filter(([name, info]) =>
    name.toLowerCase().includes(q) || ((info as any).name || '').toLowerCase().includes(q)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[480px] max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Build Nesting</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{displayName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <NestingBuilderItem item={item} zoneType={zoneType} onRemove={handleRemove} onAddChild={handleAddChild} />
        </div>

        {showPicker && selectedParent && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
              <input
                ref={nestSearchRef}
                type="text"
                value={nestSearch}
                onChange={(e) => setNestSearch(e.target.value)}
                placeholder="search variable..."
                className="w-full px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 outline-none focus:border-blue-400"
              />
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {matches.length === 0 ? (
                <div className="px-3 py-2 text-xs text-zinc-400 italic">no match</div>
              ) : (
                matches.map(([name, info]) => (
                  <button
                    key={name}
                    onClick={() => handleConfirmAdd(name)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{(info as any).name || name}</span>
                    <span className="text-zinc-400 ml-1">({name})</span>
                  </button>
                ))
              )}
            </div>
            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => { setShowPicker(false); setSelectedParent(null); }}
                className="w-full text-xs text-center text-zinc-400 hover:text-zinc-600 py-1"
              >Cancel</button>
            </div>
          </div>
        )}

        <div className="flex justify-end px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
};

// ─── Draggable Zone Item ──────────────────────────────────────────────────────
const DraggableZoneItem: React.FC<{
  zoneType: 'row' | 'col';
  item: DropItem;
  onRemove: (id: string) => void;
  depth?: number;
}> = ({ zoneType, item, onRemove, depth = 0 }) => {
  const { variables } = useStore();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `zone-item:${zoneType}:${item.id}`,
    disabled: depth > 0,
  });
  const [showNestingBuilder, setShowNestingBuilder] = useState(false);

  const displayName = variables[item.variable]?.name || item.variable;
  const hasChildren = (item.children?.length || 0) > 0;
  const maxDepth = (it: DropItem, d: number = 0): number => {
    if (!it.children?.length) return d;
    return Math.max(...it.children.map(c => maxDepth(c, d + 1)));
  };
  const deepestLevel = hasChildren ? maxDepth(item) : 0;

  return (
    <div>
      <div
        ref={setNodeRef}
        {...(depth === 0 ? listeners : {})}
        {...(depth === 0 ? attributes : {})}
        className={`group flex items-center gap-1.5 px-2 py-1.5 border select-none transition-colors
          ${depth === 0 ? 'cursor-grab bg-zinc-100 dark:bg-zinc-800 rounded' : 'cursor-default bg-zinc-50 dark:bg-zinc-900 rounded-none rounded-t'}
          ${isDragging ? 'opacity-40' : ''}
          border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600`}
      >
        <span className={`text-xs font-medium truncate flex-1 ${depth === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {depth > 0 && '↳ '}{displayName}
        </span>
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowNestingBuilder(true); }}
            className="text-xs text-zinc-400 shrink-0 hover:text-blue-500 dark:hover:text-blue-400"
            title="Edit nesting"
          >({deepestLevel}lvl)</button>
        )}
        {depth < 3 && !hasChildren && (
          <div className="relative">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowNestingBuilder(true);
              }}
              title="Build nesting structure"
              className="text-zinc-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 text-sm leading-none px-0.5 transition-colors"
            >+</button>
          </div>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(item.id)}
          className="text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 text-sm leading-none"
        >×</button>
      </div>
      {showNestingBuilder && (
        <NestingBuilderModal
          item={item}
          zoneType={zoneType}
          onClose={() => setShowNestingBuilder(false)}
        />
      )}
    </div>
  );
};

// ─── Drop Zone ────────────────────────────────────────────────────────────────
const DropZone: React.FC<{
  id: string;
  label: string;
  items: any[];
  onRemove: (id: string) => void;
  orientation: 'horizontal' | 'vertical';
}> = ({ id, label, items, onRemove, orientation }) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  const zoneType = id === 'row-zone' ? 'row' : 'col';
  return (
    <div
      ref={setNodeRef}
      className={`border border-dashed p-3 transition-all overflow-hidden ${
        isOver
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'
      } ${orientation === 'horizontal' ? 'min-h-[72px]' : 'min-h-[160px]'}`}
    >
      <div className="text-xs text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-2">{label}</div>
      <div className={`flex gap-2 ${orientation === 'vertical' ? 'flex-col' : 'flex-wrap'}`}>
        {items.length === 0 ? (
          <div className="text-xs text-zinc-300 dark:text-zinc-700 italic">drop here</div>
        ) : (
          items.map((item) => (
            <DraggableZoneItem key={item.id} zoneType={zoneType} item={item} onRemove={onRemove} />
          ))
        )}
      </div>
    </div>
  );
};

// ─── Filter def builder ───────────────────────────────────────────────────────
function buildFilterDef(filterItems: FilterItem[]): string | undefined {
  if (filterItems.length < 1) return undefined;
  if (filterItems.length === 1) {
    const item = filterItems[0];
    if (item.condition === 'has_value') return `${item.variable}/*`;
    if (item.condition === 'has_no_value') return `!${item.variable}/*`;
    if (item.condition === 'includes_any' && item.selectedCodes.length > 0)
      return `${item.variable}/${item.selectedCodes.join(',')}`;
    if (item.condition === 'includes_none' && item.selectedCodes.length > 0)
      return `!${item.variable}/${item.selectedCodes.join(',')}`;
    return undefined;
  }
  const parts: string[] = [];
  for (let i = 0; i < filterItems.length; i++) {
    const item = filterItems[i];
    let part = '';
    if (item.condition === 'has_value') part = `${item.variable}/*`;
    else if (item.condition === 'has_no_value') part = `!${item.variable}/*`;
    else if (item.condition === 'includes_any' && item.selectedCodes.length > 0)
      part = `${item.variable}/${item.selectedCodes.join(',')}`;
    else if (item.condition === 'includes_none' && item.selectedCodes.length > 0)
      part = `!${item.variable}/${item.selectedCodes.join(',')}`;
    if (part) {
      if (parts.length > 0) {
        if (!item.operatorToNext) return undefined;
        parts.push(item.operatorToNext === 'OR' ? '+' : '.');
      }
      parts.push(part);
    }
  }
  return parts.length > 0 ? parts.join('') : undefined;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const {
    dataLoaded, setDataLoaded, mergeAndSetVariables, setDataInfo,
    activeTableId, variables, tables,
    addRowItem, addColItem, removeRowItem, removeColItem, addFilterItem, nestItem,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id));
  const handleDragCancel = () => setActiveDragId(null);

  const handleDragEnd = (event: any) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !activeTableId || !dataLoaded) return;
    const activeId = String(active.id);

    if (activeId.startsWith('zone-item:')) {
      const [, sourceZone, itemId] = activeId.split(':');
      const targetZone = over.id === 'row-zone' ? 'row' : over.id === 'col-zone' ? 'col' : null;
      if (!targetZone || sourceZone === targetZone) return;
      const activeTable = tables.find(t => t.id === activeTableId);
      if (!activeTable) return;
      if (sourceZone === 'row' && targetZone === 'col') {
        const item = activeTable.row_items.find((i: any) => i.id === itemId);
        if (item) { removeRowItem(activeTableId, itemId); addColItem(activeTableId, item); }
      } else if (sourceZone === 'col' && targetZone === 'row') {
        const item = activeTable.col_items.find((i: any) => i.id === itemId);
        if (item) { removeColItem(activeTableId, itemId); addRowItem(activeTableId, item); }
      }
      return;
    }

    const varName = activeId;
    const varInfo = variables[varName];
    if (!varInfo?.codes?.length) return;
    const allCodes = varInfo.codes.map((c: any) => c.code).join(',');

    if (over.id === 'row-zone') addRowItem(activeTableId, { id: uuidv4(), variable: varName, codeDef: allCodes });
    else if (over.id === 'col-zone') addColItem(activeTableId, { id: uuidv4(), variable: varName, codeDef: allCodes });
    else if (over.id === 'filter-zone') {
      const filterItem: FilterItem = { id: uuidv4(), variable: varName, condition: 'includes_any', selectedCodes: [] };
      addFilterItem(activeTableId, filterItem);
    } else if (String(over.id).startsWith('nest-target:')) {
      const parts = String(over.id).split(':');
      const zone = parts[1] as 'row' | 'col';
      const parentId = parts[2];
      const activeTable = tables.find((t) => t.id === activeTableId);
      if (!activeTable) return;
      const parentItems = zone === 'col' ? activeTable.col_items : activeTable.row_items;
      const findDepth = (items: DropItem[], id: string, d = 0): number => {
        for (const i of items) {
          if (i.id === id) return d;
          if (i.children?.length) { const f = findDepth(i.children, id, d + 1); if (f >= 0) return f; }
        }
        return -1;
      };
      if (findDepth(parentItems, parentId) >= 3) return;
      nestItem(activeTableId, zone, parentId, { id: uuidv4(), variable: varName, codeDef: allCodes });
    }
  };

  const handleLoadSample = async () => {
    setLoading(true);
    try {
      await dataApi.loadSample();
      const vars = await dataApi.getVariables();
      mergeAndSetVariables(vars);
      setDataInfo('sample.csv', 10);
      setDataLoaded(true);
    } catch {
      alert('Failed to load sample data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DragStateContext.Provider value={{ activeDragId }}>
    <Router>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="h-screen flex flex-col bg-white dark:bg-zinc-950 font-mono">
          <Navigation />
          <Routes>
            <Route path="/build" element={
              <BuildPageLayout onLoadSample={handleLoadSample} loading={loading} />
            } />
            <Route path="/edit-variables" element={
              <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-950">
                {dataLoaded ? <EditVariablesPage /> : <div className="p-6 text-zinc-500 text-sm">load data first</div>}
              </div>
            } />
            <Route path="/edit-variables/:varName" element={
              <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-950">
                {dataLoaded ? <VariableDetailPage /> : <div className="p-6 text-zinc-500 text-sm">load data first</div>}
              </div>
            } />
            <Route path="/" element={<Navigate to="/build" replace />} />
          </Routes>
        </div>
        <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeDragId && (() => {
            // Zone item drag (variable card inside sidebreak/header zone)
            if (activeDragId.startsWith('zone-item:')) {
              const parts = activeDragId.split(':');
              const zoneType = parts[1];
              const itemId = parts[2];
              const activeTable = tables.find((t) => t.id === activeTableId);
              const item = zoneType === 'row'
                ? activeTable?.row_items.find((i: any) => i.id === itemId)
                : activeTable?.col_items.find((i: any) => i.id === itemId);
              if (!item) return null;
              const displayName = variables[item.variable]?.name || item.variable;
              return (
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-400 dark:border-zinc-500 px-2 py-1.5 shadow-2xl cursor-grabbing rotate-1 opacity-95">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">{displayName}</span>
                </div>
              );
            }
            // Variable drag from sidebar
            if (variables[activeDragId]) {
              const info = variables[activeDragId];
              return (
                <div className="px-3 py-2 border-2 border-emerald-400 bg-zinc-100 dark:bg-zinc-800 shadow-2xl cursor-grabbing w-48 rotate-1 opacity-95">
                  <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 block">{info.name || activeDragId}</span>
                      <span className="text-xs text-zinc-500 block truncate">{info.label}</span>
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-600 shrink-0">{info.codes.length}</span>
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </DragOverlay>
      </DndContext>
    </Router>
    </DragStateContext.Provider>
  );
};

// ─── Build Page ───────────────────────────────────────────────────────────────
const BuildPage: React.FC<{ onLoadSample: () => void; loading: boolean }> = ({ onLoadSample, loading }) => {
  const { dataLoaded, activeTableId, tables, variables, removeRowItem, removeColItem, setTableResult, updateTable } = useStore();
  const [localTab, setLocalTab] = useState<'build' | 'filter' | 'result'>('build');
  const [isComputing, setIsComputing] = useState(false);

  const activeTable = tables.find((t) => t.id === activeTableId);

  const resolveCode = (variable: string, code: string): string => {
    const codeObj = variables[variable]?.codes.find((c: any) => c.code === code);
    if (codeObj?.syntax) return codeObj.syntax;
    return `${variable}/${code}`;
  };

  const getCodeLabel = (key: string): string => {
    for (const [, vInfo] of Object.entries(variables)) {
      const m = (vInfo.codes as any[]).find((c) => c.syntax && c.syntax === key);
      if (m) return m.label;
    }
    const parts = key.split('/');
    if (parts.length !== 2) return key;
    const [varName, code] = parts;
    const variable = variables[varName];
    if (!variable) return code;
    const codeObj = variable.codes.find((c: any) => c.code === code);
    return codeObj?.label || code;
  };

  const getVisibleCodesList = (variable: string): string[] => {
    const v = variables[variable];
    if (!v) return [];
    return v.codes
      .filter((c: any) => c.visibility !== 'removed')
      .map((c: any) => c.code);
  };

  const buildNetRegistry = (vars: Record<string, VariableInfo>): Record<string, { variable: string; label: string; netOf: string[]; syntax: string }> => {
    const registry: Record<string, { variable: string; label: string; netOf: string[]; syntax: string }> = {};
    Object.entries(vars).forEach(([varKey, info]) => {
      info.codes.forEach((code: any) => {
        if (code.isNet && code.code) {
          registry[code.code] = {
            variable: varKey,
            label: code.label || code.code,
            netOf: code.netOf || [],
            syntax: code.syntax || '',
          };
        }
      });
    });
    return registry;
  };

  const buildCodeRegistry = (vars: Record<string, VariableInfo>): Record<string, { variable: string; code: string; syntax: string }> => {
    const registry: Record<string, { variable: string; code: string; syntax: string }> = {};
    Object.entries(vars).forEach(([varKey, info]) => {
      info.codes.forEach((code: any) => {
        // Only register non-net codes that have custom syntax
        if (!code.isNet && code.syntax && code.code) {
          registry[`${varKey}/${code.code}`] = {
            variable: varKey,
            code: code.code,
            syntax: code.syntax,
          };
        }
      });
    });
    return registry;
  };

  const handleGenerate = async () => {
    if (!activeTable?.row_items.length) { alert('Add items to Sidebreak first'); return; }
    if (activeTable.filter_items.length > 1) {
      const hasUnsetOperator = activeTable.filter_items.slice(1).some(item => !item.operatorToNext);
      if (hasUnsetOperator) { alert('Set the operator between filter variables before running'); return; }
    }
    setIsComputing(true);
    try {
      const allVarNames = [...new Set([
        ...getAllNestedVars(activeTable.row_items),
        ...getAllNestedVars(activeTable.col_items),
      ])];
      const meanMappings: { variable: string; codeScores: Record<string, number> }[] = [];
      for (const varName of allVarNames) {
        const v = variables[varName];
        if (!v) continue;
        const scoredCodes = v.codes.filter((c: any) => c.factor != null);
        if (scoredCodes.length > 0) {
          const codeScores: Record<string, number> = {};
          scoredCodes.forEach((c: any) => { codeScores[c.code] = c.factor; });
          meanMappings.push({ variable: varName, codeScores });
        }
      }

      const removedParts: string[] = [];
      Object.entries(variables).forEach(([varKey, info]) => {
        const removed = info.codes.filter((c: any) => c.visibility === 'removed' && !c.isNet).map((c: any) => c.code);
        if (removed.length > 0) removedParts.push(`!${varKey}/${removed.join(',')}`);
      });
      const baseFilter = buildFilterDef(activeTable.filter_items);
      const effectiveFilter = [...(baseFilter ? [baseFilter] : []), ...removedParts].join('.') || undefined;

      const result = await computeApi.crosstab({
        row_items: flattenItemsForBackend(activeTable.row_items, getVisibleCodesList, '', resolveCode),
        col_items: flattenItemsForBackend(activeTable.col_items, getVisibleCodesList, '', resolveCode),
        filter_def: effectiveFilter,
        mean_score_mappings: meanMappings.length > 0 ? meanMappings : undefined,
        name_to_key: buildNameToKeyMap(variables),
        net_registry: buildNetRegistry(variables),
        code_registry: buildCodeRegistry(variables),
      });
      if (activeTableId) setTableResult(activeTableId, result);
      setLocalTab('result');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsComputing(false);
    }
  };

  if (!dataLoaded) {
    return <WelcomeScreen onLoadSample={onLoadSample} loading={loading} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs bar */}
      <div className="flex justify-between items-center px-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex">
          {(['build', 'filter', 'result'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setLocalTab(tab)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                localTab === tab
                  ? 'text-zinc-900 dark:text-zinc-100 border-blue-600 dark:border-blue-500'
                  : 'text-zinc-400 dark:text-zinc-500 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTable && (
          <button
            onClick={handleGenerate}
            disabled={isComputing}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-700 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isComputing ? '...' : '> run'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!activeTable ? (
          <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-sm">create a table first</div>
        ) : (
          <>
            {localTab === 'build' && (
              <div className="h-full flex flex-col gap-4">
                <DropZone
                  id="col-zone"
                  label="Header"
                  items={activeTable.col_items}
                  onRemove={(id) => removeColItem(activeTable.id, id)}
                  orientation="horizontal"
                />
                <div className="flex-1 flex gap-4">
                  <div className="w-48">
                    <DropZone
                      id="row-zone"
                      label="Sidebreak"
                      items={activeTable.row_items}
                      onRemove={(id) => removeRowItem(activeTable.id, id)}
                      orientation="vertical"
                    />
                  </div>
                  <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-auto">
                    {(() => {
                      const { headerRows: colHeaderRows, axisPaths: previewColPaths } =
                        buildAxisStructure(activeTable.col_items, getVisibleCodesList, getCodeLabel, resolveCode);
                      const { axisPaths: previewRowPaths } =
                        buildAxisStructure(activeTable.row_items, getVisibleCodesList, getCodeLabel, resolveCode);
                      const numHeaderRows = Math.max(colHeaderRows.length, 1);

                      if (previewRowPaths.length === 0 && previewColPaths.length === 0) {
                        return (
                          <div className="h-full flex items-center justify-center">
                            <span className="text-zinc-300 dark:text-zinc-700 text-xs">drop variables to header and sidebreak to preview</span>
                          </div>
                        );
                      }

                      const getCompoundLabel = (key: string) =>
                        key.split('.').map((part) => getCodeLabel(part)).join(' › ');

                      return (
                        <table className="w-full border-collapse text-xs">
                          <thead className="sticky top-0">
                            {colHeaderRows.map((row, rowIdx) => (
                              <tr key={rowIdx}>
                                {rowIdx === 0 && (
                                  <>
                                    <th rowSpan={numHeaderRows} className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-32"></th>
                                    <th rowSpan={numHeaderRows} className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 w-24">Total</th>
                                  </>
                                )}
                                {row.map((cell, i) => (
                                  <th
                                    key={i}
                                    colSpan={cell.colSpan}
                                    rowSpan={cell.rowSpan}
                                    className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-24"
                                  >
                                    {cell.label}
                                  </th>
                                ))}
                              </tr>
                            ))}
                            {colHeaderRows.length === 0 && (
                              <tr>
                                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-32"></th>
                                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 w-24">Total</th>
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50">Base</td>
                              <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800">—</td>
                              {previewColPaths.map((col) => (
                                <td key={`base-${col}`} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-300 dark:text-zinc-700">—</td>
                              ))}
                            </tr>
                            {previewRowPaths.map((row) => (
                              <tr key={row} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                                <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{getCompoundLabel(row)}</td>
                                <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-300 dark:text-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">—</td>
                                {previewColPaths.map((col) => (
                                  <td key={`${row}-${col}`} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-300 dark:text-zinc-700">—</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex justify-start">
                  <button
                    onClick={() => activeTable && updateTable(activeTable.id, { row_items: activeTable.col_items, col_items: activeTable.row_items })}
                    className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 text-zinc-500 text-xs hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    title="Swap Header and Sidebreak"
                  >
                    ⇄ transpose
                  </button>
                </div>
              </div>
            )}
            {localTab === 'filter' && <FilterTab />}
            {localTab === 'result' && <ResultTab />}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Result Tab ───────────────────────────────────────────────────────────────
const ResultTab: React.FC = () => {
  const { activeTableId, tables, displayOptions, setDisplayOptions, variables } = useStore();
  const activeTable = tables.find((t) => t.id === activeTableId);
  const result = activeTable?.result;

  if (!result) return (
    <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-sm">run a table first</div>
  );

  const rowNames = Object.keys(result.counts).filter((k) => k !== 'Total');

  const resolveCode = (variable: string, code: string): string => {
    const codeObj = variables[variable]?.codes.find((c: any) => c.code === code);
    if (codeObj?.syntax) return codeObj.syntax;
    return `${variable}/${code}`;
  };

  const getCodeLabel = (key: string): string => {
    for (const [, vInfo] of Object.entries(variables)) {
      const m = (vInfo.codes as any[]).find((c) => c.syntax && c.syntax === key);
      if (m) return m.label;
    }
    const parts = key.split('/');
    if (parts.length !== 2) return key;
    const [varName, code] = parts;
    const variable = variables[varName];
    if (!variable) return code;
    const codeObj = variable.codes.find((c: any) => c.code === code);
    return codeObj?.label || code;
  };

  const getCompoundLabel = (key: string): string =>
    key.split('.').map((part) => getCodeLabel(part)).join(' › ');

  const getVisibleCodesList = (variable: string): string[] => {
    const v = variables[variable];
    if (!v) return [];
    return v.codes
      .filter((c: any) => c.visibility !== 'removed')
      .map((c: any) => c.code);
  };

  const { headerRows: colHeaderRows, axisPaths: colPaths } = activeTable?.col_items.length
    ? buildAxisStructure(activeTable.col_items, getVisibleCodesList, getCodeLabel, resolveCode)
    : { headerRows: [[]] as ColHeaderCell[][], axisPaths: Object.keys(result.counts[rowNames[0] || 'Total'] || {}).filter((k) => k !== 'Total') };
  const numHeaderRows = Math.max(colHeaderRows.length, 1);

  const firstRow = rowNames[0] || '';
  const rowVarName = firstRow.split('/')[0].split('.')[0];
  const rowVarLabel = variables[rowVarName]?.label || rowVarName;

  const hasStats = result.mean && Object.keys(result.mean).length > 0;

  const formatPct = (val: number) => {
    const pct = val.toFixed(displayOptions.decimalPlaces);
    return displayOptions.showPctSign ? `${pct}%` : pct;
  };

  const statRows: { key: 'mean' | 'std_error' | 'std_dev' | 'variance'; label: string }[] = [];
  if (hasStats) {
    const v = variables[rowVarName];
    if (v?.showMean) statRows.push({ key: 'mean', label: 'mean' });
    if (v?.showStdError) statRows.push({ key: 'std_error', label: 'std error' });
    if (v?.showStdDev) statRows.push({ key: 'std_dev', label: 'std dev' });
    if (v?.showVariance) statRows.push({ key: 'variance', label: 'variance' });
  }

  const statValue = (statKey: string, col: string) => {
    const statData = result[statKey as keyof CrosstabResult] as Record<string, number> | null | undefined;
    const val = statData?.[col];
    if (val == null) return '—';
    return typeof val === 'number' ? val.toFixed(displayOptions.statDecimalPlaces) : val;
  };

  const buildTableHtml = (): string => {
    const th = (label: string, colspan: number, rowspan: number, bg: string, bold: boolean, align: string = 'center') =>
      `<th${colspan > 1 ? ` colspan="${colspan}"` : ''}${rowspan > 1 ? ` rowspan="${rowspan}"` : ''} style="background:${bg};color:${bold ? '#333' : '#666'};font-weight:${bold ? 'bold' : 'normal'};text-align:${align};border:1px solid #ccc;padding:4px 8px;">${label}</th>`;
    const td = (value: string, bg: string, bold: boolean, align: string = 'center', color: string = '#666') =>
      `<td style="background:${bg};color:${color};font-weight:${bold ? 'bold' : 'normal'};text-align:${align};border:1px solid #ddd;padding:3px 8px;">${value}</td>`;

    let html = `<table style="border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif;">`;

    if (numHeaderRows > 0) {
      html += '<thead>';
      for (let h = 0; h < numHeaderRows; h++) {
        html += '<tr>';
        if (h === 0) {
          html += th('', 1, numHeaderRows, '#F5F5F5', false);
          html += th('Total', 1, numHeaderRows, '#E8E8E8', true);
        }
        const levelCols = colHeaderRows[h] || [];
        const totalDataCols = colPaths.length;
        let colOffset = 0;
        for (const cell of levelCols) {
          const remaining = totalDataCols - colOffset;
          const effectiveSpan = Math.min(cell.colSpan, Math.max(remaining, 1));
          html += th(cell.label, effectiveSpan, cell.rowSpan, h === 0 ? '#E8E8E8' : '#F5F5F5', h === 0);
          colOffset += effectiveSpan;
        }
        html += '</tr>';
      }
      html += '</thead>';
    } else {
      html += '<thead><tr>';
      html += th('', 1, 1, '#F5F5F5', false);
      html += th('Total', 1, 1, '#E8E8E8', true);
      for (let ci = 0; ci < colPaths.length; ci++) {
        html += th(colPaths[ci], 1, 1, '#F5F5F5', false);
      }
      html += '</tr></thead>';
    }

    html += '<tbody>';
    html += `<tr>${td('Base', '#F5F5F5', true, 'left', '#333')}${td(String(result.base), '#F3F4F6', false, 'center', '#333')}${colPaths.map(c => td(String(result.counts['Total']?.[c] ?? 0), '#F3F4F6', false)).join('')}</tr>`;

    rowNames.forEach((rname) => {
      const rowLabel = getCompoundLabel(rname);
      const rowTotal = result.counts[rname]?.['Total'] ?? 0;
      if (displayOptions.counts && displayOptions.colPct) {
        html += `<tr>${td(rowLabel, '#F5F5F5', true, 'left', '#333')}${td(String(rowTotal), '#F3F4F6', false)}${colPaths.map(c => td(String(result.counts[rname]?.[c] ?? 0), '#FFF', false)).join('')}</tr>`;
        html += `<tr>${td('', '#F5F5F5', false)}${td(formatPct(result.col_pct[rname]?.['Total'] ?? 0), '#EFF6FF', false, 'center', '#2563EB')}${colPaths.map(c => td(formatPct(result.col_pct[rname]?.[c] ?? 0), '#EFF6FF', false, 'center', '#2563EB')).join('')}</tr>`;
      } else if (displayOptions.counts) {
        html += `<tr>${td(rowLabel, '#F5F5F5', true, 'left', '#333')}${td(String(rowTotal), '#F3F4F6', false)}${colPaths.map(c => td(String(result.counts[rname]?.[c] ?? 0), '#FFF', false)).join('')}</tr>`;
      } else if (displayOptions.colPct) {
        html += `<tr>${td(rowLabel, '#F5F5F5', true, 'left', '#333')}${td(formatPct(result.col_pct[rname]?.['Total'] ?? 0), '#EFF6FF', false, 'center', '#2563EB')}${colPaths.map(c => td(formatPct(result.col_pct[rname]?.[c] ?? 0), '#EFF6FF', false, 'center', '#2563EB')).join('')}</tr>`;
      }
    });

    if (statRows.length > 0) {
      statRows.forEach(sr => {
        html += `<tr>${td(sr.label, '#FFFBEB', true, 'left', '#666')}${td(String(statValue(sr.key, 'Total')), '#FFFBEB', false, 'center', '#92400E')}${colPaths.map(c => td(String(statValue(sr.key, c)), '#FFFBEB', false, 'center', '#92400E')).join('')}</tr>`;
      });
    }
    html += '</tbody></table>';
    return html;
  };

  const handleCopy = () => {
    const html = buildTableHtml();

    const text = (() => {
      const lines: string[] = [];
      const colHeaderLine: string[] = [''];
      if (numHeaderRows === 0) {
        colHeaderLine.push('Total');
        colPaths.forEach(c => colHeaderLine.push(getCompoundLabel(c)));
      } else {
        colHeaderLine.push('Total');
        (colHeaderRows[0] || []).forEach(cell => colHeaderLine.push(cell.label));
      }
      lines.push(colHeaderLine.join('\t'));
      lines.push(['Base', String(result.base), ...colPaths.map(c => String(result.counts['Total']?.[c] ?? 0))].join('\t'));
      rowNames.forEach((row) => {
        const rowLabel = getCompoundLabel(row);
        const parts: string[] = [rowLabel];
        if (displayOptions.counts && displayOptions.colPct) {
          parts.push(String(result.counts[row]?.['Total'] ?? 0));
          colPaths.forEach(c => parts.push(String(result.counts[row]?.[c] ?? 0)));
          lines.push(parts.join('\t'));
          lines.push(['', ...colPaths.map(c => formatPct(result.col_pct[row]?.[c] ?? 0))].join('\t'));
        } else if (displayOptions.counts) {
          parts.push(String(result.counts[row]?.['Total'] ?? 0));
          colPaths.forEach(c => parts.push(String(result.counts[row]?.[c] ?? 0)));
          lines.push(parts.join('\t'));
        } else if (displayOptions.colPct) {
          parts.push(formatPct(result.col_pct[row]?.['Total'] ?? 0));
          colPaths.forEach(c => parts.push(formatPct(result.col_pct[row]?.[c] ?? 0)));
          lines.push(parts.join('\t'));
        }
      });
      return lines.join('\n');
    })();

    const blob = new Blob([text], { type: 'text/plain' });
    const htmlBlob = new Blob([html], { type: 'text/html' });

    if (navigator.clipboard && window.ClipboardItem) {
      const item = new window.ClipboardItem({
        'text/plain': blob,
        'text/html': htmlBlob
      });
      navigator.clipboard.write([item]).then(() => {
        alert('copied!');
      }).catch(() => {
        navigator.clipboard.writeText(text);
        alert('copied!');
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('copied!');
    }
  };

  const handleExport = () => {
    const tableHtml = buildTableHtml();
    const fullHtml = [
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"',
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
      ' xmlns="http://www.w3.org/TR/REC-html40">',
      '<head><meta charset="UTF-8">',
      '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>',
      '<x:ExcelWorksheet><x:Name>Crosstab</x:Name>',
      '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>',
      '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->',
      '</head><body>',
      tableHtml,
      '</body></html>',
    ].join('');
    const blob = new Blob([fullHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crosstab_${Date.now()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Display Options */}
      <div className="flex flex-wrap gap-5 items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5">
        <span className="text-xs text-zinc-500">display:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={displayOptions.counts} onChange={(e) => setDisplayOptions({ counts: e.target.checked })} className="w-3.5 h-3.5 accent-blue-500" />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">counts</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={displayOptions.colPct} onChange={(e) => setDisplayOptions({ colPct: e.target.checked })} className="w-3.5 h-3.5 accent-blue-500" />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">%</span>
        </label>
        {displayOptions.colPct && (
          <>
            <label className="flex items-center gap-2 cursor-pointer pl-4 border-l border-zinc-200 dark:border-zinc-800">
              <input type="checkbox" checked={displayOptions.showPctSign} onChange={(e) => setDisplayOptions({ showPctSign: e.target.checked })} className="w-3.5 h-3.5 accent-blue-500" />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">% sign</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">dec:</span>
              <select
                value={displayOptions.decimalPlaces}
                onChange={(e) => setDisplayOptions({ decimalPlaces: parseInt(e.target.value) })}
                className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-1 font-mono"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </div>
          </>
        )}
        {hasStats && statRows.length > 0 && (
          <div className="flex items-center gap-2 pl-4 border-l border-zinc-200 dark:border-zinc-800">
            <span className="text-xs text-zinc-500">stats dec:</span>
            <select
              value={displayOptions.statDecimalPlaces}
              onChange={(e) => setDisplayOptions({ statDecimalPlaces: parseInt(e.target.value) })}
              className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-1 font-mono"
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
        )}
        <button
          onClick={handleCopy}
          className="ml-auto px-3 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          copy
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
        >
          export xlsx
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-wrap gap-6 text-xs text-zinc-500 items-center">
        <span>row: <span className="text-zinc-700 dark:text-zinc-300">{rowVarLabel}</span></span>
        <span>base: <span className="text-zinc-700 dark:text-zinc-300">{result.base}</span></span>
        {(() => {
          const removedSummary: string[] = [];
          Object.entries(variables).forEach(([varKey, info]) => {
            const removed = info.codes.filter((c: any) => c.visibility === 'removed').map((c: any) => c.code);
            if (removed.length > 0) removedSummary.push(`${varKey}=${removed.join(',')}`);
          });
          if (removedSummary.length === 0) return null;
          return (
            <span className="text-orange-600 dark:text-orange-400">
              removed: {removedSummary.join(' ')}
            </span>
          );
        })()}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0">
            {colHeaderRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {rowIdx === 0 && (
                  <>
                    <th rowSpan={numHeaderRows} className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-32"></th>
                    <th rowSpan={numHeaderRows} className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 w-24">Total</th>
                  </>
                )}
                {row.map((cell, i) => (
                  <th
                    key={i}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-24"
                  >
                    {cell.label}
                  </th>
                ))}
              </tr>
            ))}
            {colHeaderRows.length === 0 && (
              <tr>
                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-32"></th>
                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 w-24">Total</th>
              </tr>
            )}
          </thead>
          <tbody>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50">
              <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">Base</td>
              <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-800 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800">{result.base}</td>
              {colPaths.map((col) => (
                <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-600 dark:text-zinc-400">
                  {result.counts['Total']?.[col] ?? 0}
                </td>
              ))}
            </tr>
            {rowNames.map((row) => {
              const rowLabel = getCompoundLabel(row);
              const rowTotal = result.counts[row]?.['Total'] ?? 0;

              if (displayOptions.counts && displayOptions.colPct) {
                return (
                  <React.Fragment key={row}>
                    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td rowSpan={2} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-zinc-700 dark:text-zinc-300 align-middle">{rowLabel}</td>
                      <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-center text-zinc-800 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40">{rowTotal}</td>
                      {colPaths.map((col) => (
                        <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-center text-zinc-600 dark:text-zinc-400">
                          {result.counts[row]?.[col] ?? 0}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-center text-blue-600 dark:text-blue-400/70 bg-zinc-50 dark:bg-zinc-800/20">{formatPct(result.col_pct[row]?.['Total'] ?? 0)}</td>
                      {colPaths.map((col) => (
                        <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-center text-blue-600 dark:text-blue-400/70">
                          {formatPct(result.col_pct[row]?.[col] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              } else if (displayOptions.counts) {
                return (
                  <tr key={row} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-700 dark:text-zinc-300">{rowLabel}</td>
                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-800 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40">{rowTotal}</td>
                    {colPaths.map((col) => (
                      <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-600 dark:text-zinc-400">
                        {result.counts[row]?.[col] ?? 0}
                      </td>
                    ))}
                  </tr>
                );
              } else if (displayOptions.colPct) {
                return (
                  <tr key={row} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-700 dark:text-zinc-300">{rowLabel}</td>
                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-blue-600 dark:text-blue-400/70 bg-zinc-50 dark:bg-zinc-800/40">{formatPct(result.col_pct[row]?.['Total'] ?? 0)}</td>
                    {colPaths.map((col) => (
                      <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-blue-600 dark:text-blue-400/70">
                        {formatPct(result.col_pct[row]?.[col] ?? 0)}
                      </td>
                    ))}
                  </tr>
                );
              }
              return null;
            })}
            {/* Stats summary rows at bottom */}
            {statRows.length > 0 && statRows.map((sr) => (
              <tr key={`stat-${sr.key}`} className="bg-amber-50 dark:bg-amber-900/10">
                <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-500 dark:text-zinc-500 italic font-medium">{sr.label}</td>
                <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-amber-700 dark:text-amber-400/80 bg-zinc-100 dark:bg-zinc-800/40 font-medium">
                  {statValue(sr.key, 'Total')}
                </td>
                {colPaths.map((col) => (
                  <td key={`${sr.key}-${col}`} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-amber-700 dark:text-amber-400/80">
                    {statValue(sr.key, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Merge Variables Modal ────────────────────────────────────────────────────
interface MergeVariablesModalProps {
  onClose: () => void;
}

const MergeVariablesModal: React.FC<MergeVariablesModalProps> = ({ onClose }) => {
  const { variables, setVariables } = useStore();
  const [mergeMode, setMergeMode] = useState<'ma' | 'code'>('ma');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [mergeType, setMergeType] = useState<'binary' | 'spread'>('binary');
  const [codePrefix, setCodePrefix] = useState('');
  const [mergeOperator, setMergeOperator] = useState<'OR' | 'AND'>('OR');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const variableList = Object.keys(variables);

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleMerge = async () => {
    if (!newVarName.trim()) {
      setError('Variable name required');
      return;
    }
    if (selectedColumns.length < 2) {
      setError('Select at least 2 variables');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mergeMode === 'ma') {
        const result = await dataApi.mergeVariables({
          columns: selectedColumns,
          new_variable_name: newVarName.trim(),
          merge_type: mergeType,
          code_prefix: codePrefix || undefined,
        });
        const newVarInfo: VariableInfo = {
          name: result.name,
          label: result.label,
          type: result.type,
          codes: result.codes.map((c: any) => ({
            code: c.code,
            label: c.label,
            factor: null,
            visibility: 'visible' as const,
          })),
          syntax: result.syntax,
          code_syntax: result.code_syntax,
          isCustom: true,
          showMean: false,
          showStdError: false,
          showStdDev: false,
          showVariance: false,
        };
        setVariables({ ...variables, [newVarName.trim()]: newVarInfo });
      } else {
        const result = await dataApi.mergeCodes({
          variables: selectedColumns,
          new_variable_name: newVarName.trim(),
          merge_operator: mergeOperator,
          description: description || undefined,
        });
        const newVarInfo: VariableInfo = {
          name: result.name,
          label: result.label,
          type: result.type,
          codes: result.codes.map((c: any) => ({
            code: c.code,
            label: c.label,
            factor: null,
            visibility: 'visible' as const,
          })),
          syntax: result.syntax,
          code_syntax: result.code_syntax,
          isCustom: true,
          showMean: false,
          showStdError: false,
          showStdDev: false,
          showVariance: false,
        };
        setVariables({ ...variables, [newVarName.trim()]: newVarInfo });
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Merge failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Merge Variables</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {error && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">{error}</div>}

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Select Variables (2+ required)</label>
            <div className="border border-zinc-200 dark:border-zinc-700 rounded max-h-40 overflow-auto">
              {variableList.map(key => (
                <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(key)}
                    onChange={() => toggleColumn(key)}
                    className="accent-blue-500"
                  />
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">{key}</span>
                  <span className="text-zinc-400 truncate">{variables[key]?.label}</span>
                  <span className="ml-auto text-zinc-400">{variables[key]?.type}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">New Variable Name</label>
            <input
              type="text"
              value={newVarName}
              onChange={e => setNewVarName(e.target.value)}
              placeholder="e.g. A1_merged"
              className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-zinc-700 dark:text-zinc-200 outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-2">Merge Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer text-zinc-700 dark:text-zinc-200">
                <input type="radio" name="mergeMode" checked={mergeMode === 'ma'} onChange={() => setMergeMode('ma')} className="accent-blue-500" />
                MA Merge (binary / spread)
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer text-zinc-700 dark:text-zinc-200">
                <input type="radio" name="mergeMode" checked={mergeMode === 'code'} onChange={() => setMergeMode('code')} className="accent-blue-500" />
                Code Merge (OR / AND)
              </label>
            </div>
          </div>

          {mergeMode === 'ma' && (
            <>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-zinc-700 dark:text-zinc-200">
                    <input type="radio" name="mergeType" checked={mergeType === 'binary'} onChange={() => setMergeType('binary')} className="accent-blue-500" />
                    Binary (0/1)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-zinc-700 dark:text-zinc-200">
                    <input type="radio" name="mergeType" checked={mergeType === 'spread'} onChange={() => setMergeType('spread')} className="accent-blue-500" />
                    Spread (delimited)
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Code Prefix (optional)</label>
                <input
                  type="text"
                  value={codePrefix}
                  onChange={e => setCodePrefix(e.target.value)}
                  placeholder="e.g. p (codes become p1, p2, p3...)"
                  className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-zinc-700 dark:text-zinc-200 outline-none focus:border-blue-400"
                />
              </div>
            </>
          )}

          {mergeMode === 'code' && (
            <>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Operator</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-zinc-700 dark:text-zinc-200">
                    <input type="radio" name="operator" checked={mergeOperator === 'OR'} onChange={() => setMergeOperator('OR')} className="accent-blue-500" />
                    OR (union)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-zinc-700 dark:text-zinc-200">
                    <input type="radio" name="operator" checked={mergeOperator === 'AND'} onChange={() => setMergeOperator('AND')} className="accent-blue-500" />
                    AND (intersection)
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Total brand awareness"
                  className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-zinc-700 dark:text-zinc-200 outline-none focus:border-blue-400"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">Cancel</button>
          <button
            onClick={handleMerge}
            disabled={loading || selectedColumns.length < 2 || !newVarName.trim()}
            className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Merging...' : 'Merge'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Edit Variables Page ──────────────────────────────────────────────────────
const EditVariablesPage: React.FC = () => {
  const { variables, addVariable } = useStore();
  const navigate = useNavigate();
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showAddVar, setShowAddVar] = useState(false);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarName, setNewVarName] = useState('');
  const [newVarLabel, setNewVarLabel] = useState('');
  const [newVarType, setNewVarType] = useState('categorical');
  const [addVarError, setAddVarError] = useState('');

  const variableEntries = Object.entries(variables);

  const handleAddVariable = () => {
    const key = newVarKey.trim();
    const name = newVarName.trim();
    if (!key) { setAddVarError('key is required'); return; }
    if (variables[key]) { setAddVarError(`variable '${key}' already exists`); return; }
    addVariable(key, name || key, newVarLabel.trim(), newVarType);
    setShowAddVar(false);
    setNewVarKey(''); setNewVarName(''); setNewVarLabel(''); setNewVarType('categorical'); setAddVarError('');
    navigate(`/edit-variables/${encodeURIComponent(key)}`);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">variables</h2>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" /> original
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> custom
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddVar((v) => !v)}
            className="px-3 py-1.5 text-xs bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            + variable
          </button>
          <button
            onClick={() => setShowMergeModal(true)}
            className="px-3 py-1.5 text-xs bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Merge
          </button>
          <span className="text-xs text-zinc-400 dark:text-zinc-600">{variableEntries.length}</span>
        </div>
      </div>

      {showAddVar && (
        <div className="mb-4 border border-emerald-300 dark:border-emerald-700 p-3 bg-emerald-50 dark:bg-emerald-900/10 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">key *</span>
              <input
                autoFocus
                type="text"
                placeholder="e.g. MySeg"
                value={newVarKey}
                onChange={(e) => { setNewVarKey(e.target.value); setAddVarError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddVariable(); if (e.key === 'Escape') setShowAddVar(false); }}
                className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none w-28 font-mono"
              />
            </div>
            <div className="flex flex-col gap-0.5 flex-1">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">display name</span>
              <input
                type="text"
                placeholder="optional"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none w-full"
              />
            </div>
            <div className="flex flex-col gap-0.5 flex-1">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">definition</span>
              <input
                type="text"
                placeholder="optional"
                value={newVarLabel}
                onChange={(e) => setNewVarLabel(e.target.value)}
                className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">type</span>
                <select
                  value={newVarType}
                  onChange={(e) => setNewVarType(e.target.value)}
                  className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none"
                >
                  <option value="categorical">categorical</option>
                  <option value="multiple_response">multiple_response</option>
                  <option value="numeric">numeric</option>
                </select>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button onClick={handleAddVariable} className="text-xs px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">create</button>
                <button onClick={() => { setShowAddVar(false); setAddVarError(''); }} className="text-xs px-3 py-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors">cancel</button>
              </div>
            </div>
          </div>
          {addVarError && <p className="text-[10px] text-red-500 dark:text-red-400">{addVarError}</p>}
        </div>
      )}

      <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-xs table-fixed">
          <thead className="sticky top-0">
            <tr className="bg-zinc-50 dark:bg-zinc-900">
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-2 py-2 text-left text-zinc-500 dark:text-zinc-400 font-medium w-7" />
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-500 dark:text-zinc-400 font-medium w-36">key</th>
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-500 dark:text-zinc-400 font-medium w-44">name</th>
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-500 dark:text-zinc-400 font-medium">definition</th>
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-500 dark:text-zinc-400 font-medium w-24">type</th>
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-right text-zinc-500 dark:text-zinc-400 font-medium w-14">codes</th>
            </tr>
          </thead>
          <tbody>
            {variableEntries.map(([key, info]) => {
              const hiddenCount = info.codes.filter((c: any) => c.visibility === 'hidden').length;
              const removedCount = info.codes.filter((c: any) => c.visibility === 'removed').length;
              const isCustom = info.isCustom;
              return (
                <tr
                  key={key}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer"
                  onClick={() => navigate(`/edit-variables/${encodeURIComponent(key)}`)}
                >
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-2 py-2 text-center">
                    {isCustom
                      ? <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Custom variable" />
                      : <span className="inline-block w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" title="Original variable" />
                    }
                  </td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-emerald-700 dark:text-emerald-400 font-medium truncate">{key}</td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-zinc-700 dark:text-zinc-300 truncate">{info.name || key}</td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-zinc-500 dark:text-zinc-400 truncate">{info.label}</td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-zinc-400 dark:text-zinc-500">{info.type}</td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-right text-zinc-400 dark:text-zinc-500">
                    {info.codes.length}
                    {(hiddenCount > 0 || removedCount > 0) && (
                      <span className="ml-1 text-orange-500 dark:text-orange-400">
                        {hiddenCount > 0 && `−${hiddenCount}`}{removedCount > 0 && ` ✕${removedCount}`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showMergeModal && <MergeVariablesModal onClose={() => setShowMergeModal(false)} />}
    </div>
  );
};

// ─── Sortable Code Row ────────────────────────────────────────────────────────
interface SortableCodeRowProps {
  code: NonNullable<VariableInfo['codes']>[number];
  varKey: string;
  varName: string;
  isCustom: boolean;
  code_syntax?: string[];
  codeIndex: number;
  isSelected: boolean;
  onToggleSelect: (code: string) => void;
  onDelete: (varName: string, code: string) => void;
  updateCodeLabel: (varName: string, code: string, label: string) => void;
  updateCodeFactor: (varName: string, code: string, factor: number | null) => void;
  updateCodeVisibility: (varName: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  updateCodeSyntax: (varName: string, code: string, syntax: string) => void;
  onEditSyntax?: (code: string, currentSyntax: string) => void;
}

const SortableCodeRow: React.FC<SortableCodeRowProps> = ({
  code, varKey, varName, isCustom, code_syntax, codeIndex,
  isSelected, onToggleSelect, onDelete,
  updateCodeLabel, updateCodeFactor, updateCodeVisibility, updateCodeSyntax,
  onEditSyntax,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: code.code });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const vis = code.visibility ?? 'visible';
  const rowClass = vis === 'removed'
    ? 'bg-red-50 dark:bg-red-900/10 opacity-50'
    : vis === 'hidden' ? 'opacity-60' : '';

  const netSyntax = code.isNet && code.netOf
    ? code.netOf.map((nc) => `${varName}/${nc}`).join('+')
    : null;

  return (
    <tr ref={setNodeRef} style={style} className={`${rowClass} hover:bg-zinc-50 dark:hover:bg-zinc-800/30`}>
      {/* Drag handle */}
      <td className="border border-zinc-200 dark:border-zinc-700 px-1 py-1 w-6 text-center">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 select-none text-xs"
          title="drag to reorder"
        >⠿</span>
      </td>
      {/* Checkbox */}
      <td className="border border-zinc-200 dark:border-zinc-700 px-1 py-1 w-6 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(code.code)}
          className="cursor-pointer"
        />
      </td>
      {/* Code value */}
      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-1 w-24 text-zinc-700 dark:text-zinc-300 font-medium font-mono text-[10px]">
        {code.isNet ? (
          <span className="inline-flex items-center gap-1">
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[9px] px-1 py-0.5 font-bold">NET</span>
            <span className="text-purple-500">{code.code}</span>
          </span>
        ) : code.isNew ? (
          <span className="inline-flex items-center gap-1">
            <span className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 text-[9px] px-1 py-0.5 font-bold">C</span>
            <span className="text-cyan-600 dark:text-cyan-400">{code.code}</span>
          </span>
        ) : code.code}
      </td>
      {/* Label */}
      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-1">
        <input
          type="text"
          value={code.label}
          onChange={(e) => updateCodeLabel(varKey, code.code, e.target.value)}
          className="w-full text-xs bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-blue-400 dark:focus:border-blue-500 px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 outline-none"
        />
      </td>
      {/* Syntax */}
      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
        {netSyntax ? (
          <span className="text-purple-500 dark:text-purple-400">{netSyntax}</span>
        ) : isCustom && code_syntax ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={code_syntax[codeIndex] || `${varName}/${code.code}`}
              onChange={(e) => updateCodeSyntax(varKey, code.code, e.target.value)}
              className="flex-1 w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-blue-400 dark:focus:border-blue-500 px-1 py-0.5 text-zinc-600 dark:text-zinc-300 outline-none font-mono"
            />
            {onEditSyntax && (
              <button
                onClick={() => onEditSyntax(code.code, code_syntax[codeIndex] || `${varName}/${code.code}`)}
                className="text-[10px] px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400 rounded transition-colors"
                title="edit syntax"
              >
                edit
              </button>
            )}
          </div>
        ) : `${varName}/${code.code}`}
      </td>
      {/* Factor */}
      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-1">
        <input
          type="number"
          step="any"
          value={code.factor ?? ''}
          placeholder="—"
          onChange={(e) => {
            const val = e.target.value === '' ? null : parseFloat(e.target.value);
            updateCodeFactor(varKey, code.code, val);
          }}
          className="w-full text-xs bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-blue-400 dark:focus:border-blue-500 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300 outline-none"
        />
      </td>
      {/* Visibility */}
      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-1">
        <select
          value={vis}
          onChange={(e) => updateCodeVisibility(varKey, code.code, e.target.value as 'visible' | 'hidden' | 'removed')}
          className={`w-full text-xs bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-blue-400 dark:focus:border-blue-500 px-1 py-0.5 outline-none cursor-pointer ${
            vis === 'removed' ? 'text-red-500 dark:text-red-400' :
            vis === 'hidden' ? 'text-zinc-400' :
            'text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <option value="visible">visible</option>
          <option value="hidden">hide</option>
          <option value="removed">remove</option>
        </select>
      </td>
      {/* Delete — only for user-added codes */}
      <td className="border border-zinc-200 dark:border-zinc-700 px-1 py-1 text-center w-6">
        {code.isNew && (
          <button
            onClick={() => onDelete(varKey, code.code)}
            title="delete code"
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs leading-none"
          >✕</button>
        )}
      </td>
    </tr>
  );
};

// ─── Variable Detail Page ─────────────────────────────────────────────────────
const VariableDetailPage: React.FC = () => {
  const { varName: encodedVarName } = useParams<{ varName: string }>();
  const varKey = encodedVarName ? decodeURIComponent(encodedVarName) : '';
  const navigate = useNavigate();
  const {
    variables,
    updateVariableLabel,
    updateVariableDisplayName,
    updateCodeLabel,
    updateCodeFactor,
    updateCodeVisibility,
    updateCodeSyntax,
    toggleVariableStat,
    addNetCode,
    addCode,
    removeCode,
    reorderCodes,
  } = useStore();

  const [selectedForNet, setSelectedForNet] = useState<Set<string>>(new Set());
  const [showNetInput, setShowNetInput] = useState(false);
  const [netLabelInput, setNetLabelInput] = useState('');
  const [showAddCode, setShowAddCode] = useState(false);
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [newCodeSyntax, setNewCodeSyntax] = useState('');
  const [syntaxErrors, setSyntaxErrors] = useState<string[]>([]);
  const [showSyntaxBuilder, setShowSyntaxBuilder] = useState(false);
  const [showVarSyntaxModal, setShowVarSyntaxModal] = useState(false);
  const [editingCodeKey, setEditingCodeKey] = useState<string | null>(null);
  const [editingCodeSyntax, setEditingCodeSyntax] = useState<string>('');
  const sortSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleEditSyntax = (code: string, currentSyntax: string) => {
    setEditingCodeKey(code);
    setEditingCodeSyntax(currentSyntax);
    setShowSyntaxBuilder(true);
  };

  const handleSaveSyntax = (syntax: string) => {
    if (editingCodeKey) {
      updateCodeSyntax(varKey, editingCodeKey, syntax);
    } else {
      setNewCodeSyntax(syntax);
    }
    setShowSyntaxBuilder(false);
    setEditingCodeKey(null);
  };

  const info: VariableInfo | undefined = variables[varKey];

  if (!info) {
    return (
      <div className="p-6 text-zinc-500 text-sm">
        Variable <span className="font-mono">{varKey}</span> not found.{' '}
        <button onClick={() => navigate('/edit-variables')} className="text-blue-500 underline">back</button>
      </div>
    );
  }

  const hiddenCount = info.codes.filter((c: any) => c.visibility === 'hidden').length;
  const removedCount = info.codes.filter((c: any) => c.visibility === 'removed').length;
  const varName = info.name || varKey;

  const validateSyntax = (syntax: string): string[] => {
    const errors: string[] = [];
    const atomRe = /([A-Za-z_][A-Za-z0-9_]*)\/([^+()\s!]+)/g;
    const nameToKey = buildNameToKeyMap(variables);
    let match;
    while ((match = atomRe.exec(syntax)) !== null) {
      const [, vName, codePart] = match;
      // Resolve display name to column key
      const resolvedKey = nameToKey[vName] || vName;
      const vInfo = variables[resolvedKey];
      if (!vInfo) { errors.push(`variable '${vName}' not found`); continue; }
      if (codePart === '*') continue;
      if (codePart.includes('..')) {
        const [from, to] = codePart.split('..');
        for (const c of [from, to]) {
          if (!vInfo.codes.find((vc: any) => vc.code === c)) errors.push(`code '${c}' not found in '${vName}'`);
        }
      } else {
        for (const c of codePart.split(',')) {
          if (!vInfo.codes.find((vc: any) => vc.code === c.trim())) errors.push(`code '${c.trim()}' not found in '${vName}'`);
        }
      }
    }
    return errors;
  };

  const handleConfirmAddCode = () => {
    const label = newCodeLabel.trim();
    const syntax = newCodeSyntax.trim();
    if (!label || !syntax) return;
    const errs = validateSyntax(syntax);
    if (errs.length > 0) { setSyntaxErrors(errs); return; }
    addCode(varKey, label, syntax);
    setNewCodeLabel(''); setNewCodeSyntax('');
    setSyntaxErrors([]);
    setShowAddCode(false);
  };

  const handleToggleSelect = (code: string) => {
    setSelectedForNet((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const handleConfirmNet = () => {
    const label = netLabelInput.trim();
    if (!label || selectedForNet.size < 2) return;
    addNetCode(varKey, [...selectedForNet], label);
    setSelectedForNet(new Set());
    setNetLabelInput('');
    setShowNetInput(false);
  };

  const handleDragEnd = (event: DndDragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = info.codes.findIndex((c) => c.code === active.id);
    const newIndex = info.codes.findIndex((c) => c.code === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderCodes(varKey, arrayMove(info.codes, oldIndex, newIndex).map((c) => c.code));
  };

  const canNet = selectedForNet.size >= 2;

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <button
          onClick={() => navigate('/edit-variables')}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          ← variables
        </button>
        <span className="text-xs text-zinc-300 dark:text-zinc-600">/</span>
        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{varKey}</span>
        {(hiddenCount > 0 || removedCount > 0) && (
          <span className="text-xs text-orange-500 dark:text-orange-400 ml-1">
            {hiddenCount > 0 && `${hiddenCount} hidden`}
            {hiddenCount > 0 && removedCount > 0 && ', '}
            {removedCount > 0 && `${removedCount} removed`}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex gap-4 p-4">
        {/* Left: Metadata + Stats */}
        <div className="w-80 shrink-0 overflow-auto space-y-6 pr-2">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">name</label>
              <input
                type="text"
                value={info.name || varKey}
                onChange={(e) => updateVariableDisplayName(varKey, e.target.value)}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:border-blue-400 dark:focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">definition</label>
              <input
                type="text"
                value={info.label}
                onChange={(e) => updateVariableLabel(varKey, e.target.value)}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:border-blue-400 dark:focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Stats toggles */}
          <div>
            <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-2">show statistics</label>
            <div className="flex flex-col gap-2">
              {([
                ['showMean', 'mean'],
                ['showStdError', 'std error'],
                ['showStdDev', 'std dev'],
                ['showVariance', 'variance'],
              ] as const).map(([stat, label]) => (
                <button
                  key={stat}
                  onClick={() => toggleVariableStat(varKey, stat)}
                  className={`px-2 py-1.5 text-xs border transition-colors text-left ${
                    info[stat]
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Codes table */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 dark:text-zinc-400">codes ({info.codes.length})</label>
              <div className="ml-auto flex items-center gap-1">
                {!showAddCode && !showNetInput && (
                  <button
                    onClick={() => setShowVarSyntaxModal(true)}
                    className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 transition-colors"
                  >
                    var syntax
                  </button>
                )}
                {canNet && !showNetInput && !showAddCode && (
                  <button
                    onClick={() => setShowNetInput(true)}
                    className="text-xs px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white transition-colors"
                  >
                    net selected ({selectedForNet.size})
                  </button>
                )}
                {!showAddCode && !showNetInput && (
                  <button
                    onClick={() => setShowAddCode(true)}
                    className="text-xs px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                  >
                    + add code
                  </button>
                )}
              </div>
            </div>

            {showNetInput && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">net label:</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. T2B"
                  value={netLabelInput}
                  onChange={(e) => setNetLabelInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmNet(); if (e.key === 'Escape') { setShowNetInput(false); setNetLabelInput(''); } }}
                  className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-purple-400 px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none w-44"
                />
                <div className="flex flex-col items-center gap-1">
                  <button onClick={handleConfirmNet} disabled={!netLabelInput.trim()} className="text-xs px-3 py-1 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white transition-colors">create</button>
                  <button onClick={() => { setShowNetInput(false); setNetLabelInput(''); }} className="text-xs px-3 py-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors">cancel</button>
                </div>
              </div>
            )}

            {showAddCode && (
              <div className="border border-emerald-300 dark:border-emerald-700 p-2 space-y-2 bg-emerald-50 dark:bg-emerald-900/10">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">label</span>
                    <input
                      autoFocus
                      type="text"
                      placeholder="display name"
                      value={newCodeLabel}
                      onChange={(e) => setNewCodeLabel(e.target.value)}
                      className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none w-full"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">syntax — e.g. <span className="font-mono">ol/8+ol/9</span> or <span className="font-mono">(ses/2+ses/3).age/2</span></span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="syntax expression"
                        value={newCodeSyntax}
                        onChange={(e) => { setNewCodeSyntax(e.target.value); setSyntaxErrors([]); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmAddCode(); if (e.key === 'Escape') { setShowAddCode(false); setSyntaxErrors([]); } }}
                        className="flex-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none w-full font-mono"
                      />
                      <button
                        onClick={() => { setShowSyntaxBuilder(true); }}
                        className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0"
                        title="select response"
                      >
                        select
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={handleConfirmAddCode}
                      disabled={!newCodeLabel.trim() || !newCodeSyntax.trim()}
                      className="text-xs px-3 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white transition-colors"
                    >
                      add
                    </button>
                    <button
                      onClick={() => { setShowAddCode(false); setSyntaxErrors([]); setNewCodeLabel(''); setNewCodeSyntax(''); }}
                      className="text-xs px-3 py-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
                    >
                      cancel
                    </button>
                  </div>
                </div>
                {syntaxErrors.length > 0 && (
                  <div className="space-y-0.5">
                    {syntaxErrors.map((err, i) => (
                      <p key={i} className="text-[10px] text-red-500 dark:text-red-400 font-mono">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-700">
            <DndContext
              sensors={sortSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={info.codes.map((c) => c.code)} strategy={verticalListSortingStrategy}>
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-zinc-50 dark:bg-zinc-800">
                      <th className="border border-zinc-200 dark:border-zinc-700 px-1 py-1.5 w-6"></th>
                      <th className="border border-zinc-200 dark:border-zinc-700 px-1 py-1.5 w-6"></th>
                      <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 dark:text-zinc-400 w-24">code</th>
                      <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 dark:text-zinc-400 flex-1">label</th>
                      <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 dark:text-zinc-400 w-40">syntax</th>
                      <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 dark:text-zinc-400 w-24">factor</th>
                      <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 dark:text-zinc-400 w-28">visibility</th>
                      <th className="border border-zinc-200 dark:border-zinc-700 px-1 py-1.5 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.codes.map((code, idx) => (
                      <SortableCodeRow
                        key={code.code}
                        code={code}
                        varKey={varKey}
                        varName={varName}
                        isCustom={!!info.isCustom}
                        code_syntax={info.code_syntax}
                        codeIndex={idx}
                        isSelected={selectedForNet.has(code.code)}
                        onToggleSelect={handleToggleSelect}
                        onDelete={removeCode}
                        updateCodeLabel={updateCodeLabel}
                        updateCodeFactor={updateCodeFactor}
                        updateCodeVisibility={updateCodeVisibility}
                        updateCodeSyntax={updateCodeSyntax}
                        onEditSyntax={handleEditSyntax}
                      />
                    ))}
                  </tbody>
                </table>
              </SortableContext>
            </DndContext>
          </div>
        </div>
        {showSyntaxBuilder && (
          <SyntaxBuilderModal
            initialSyntax={editingCodeKey ? editingCodeSyntax : newCodeSyntax}
            onSave={handleSaveSyntax}
            onClose={() => { setShowSyntaxBuilder(false); setEditingCodeKey(null); }}
          />
        )}
        {showVarSyntaxModal && (
          <VariableSyntaxModal
            varKey={varKey}
            varName={varName}
            info={info}
            onClose={() => setShowVarSyntaxModal(false)}
            updateVariableLabel={updateVariableLabel}
            toggleVariableStat={toggleVariableStat}
            updateCodeLabel={updateCodeLabel}
            updateCodeFactor={updateCodeFactor}
            updateCodeVisibility={updateCodeVisibility}
            updateCodeSyntax={updateCodeSyntax}
          />
        )}
      </div>
    </div>
  );
};

export default App;
