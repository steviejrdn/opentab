import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useStore } from './store/useStore';
import { DndContext, useSensor, useSensors, PointerSensor, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent as DndDragEndEvent } from '@dnd-kit/core';
import { computeApi, dataApi } from './lib/api';
import type { FilterItem, CrosstabResult, VariableInfo } from './lib/api';
import FilterTab from './components/FilterTab';
import { v4 as uuidv4 } from 'uuid';

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
const Navigation: React.FC<{ onToggleSidebar?: () => void; sidebarVisible?: boolean }> = ({ onToggleSidebar, sidebarVisible }) => {
  const location = useLocation();
  const { dataLoaded, variables, tables, displayOptions, activeTableId, fileName, rowCount, importState, setDataLoaded } = useStore();
  const openFileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const payload = {
      version: 1,
      fileName,
      rowCount,
      variables,
      tables,
      displayOptions,
      activeTableId,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName?.replace(/\.[^.]+$/, '') || 'session'}.opentab`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.variables || !data.tables) throw new Error('Invalid .opentab file');
        importState({
          variables: data.variables,
          tables: data.tables,
          displayOptions: data.displayOptions ?? {},
          activeTableId: data.activeTableId ?? null,
          fileName: data.fileName ?? null,
          rowCount: data.rowCount ?? 0,
        });
        setDataLoaded(false);
      } catch {
        alert('Could not read .opentab file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <nav className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex justify-between items-center">
      <div className="flex items-center gap-3">
        {/* Logo — swaps on theme change via CSS dark variant */}
        <img src="/logo_black.svg" alt="opentab" className="h-5 block dark:hidden" />
        <img src="/logo_white.svg" alt="opentab" className="h-5 hidden dark:block" />
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
            <button
              onClick={handleSave}
              title="Save session"
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              save
            </button>
          )}
          <button
            onClick={() => openFileRef.current?.click()}
            title="Open .opentab session"
            className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            open
          </button>
          <input ref={openFileRef} type="file" accept=".opentab" className="hidden" onChange={handleOpen} />
        </div>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {sidebarVisible ? '◀ sidebar' : '▶ sidebar'}
          </button>
        )}
        <ThemeToggle />
      </div>
    </nav>
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
  if (!dataLoaded) return (
    <div className="flex flex-col h-full px-3 py-3">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">variables</span>
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-xs">load data first</div>
    </div>
  );
  return (
    <div className="flex flex-col h-full px-3 py-3">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">variables</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-600">{Object.keys(variables).length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {Object.entries(variables).map(([name, info]) => (
          <DraggableVariable key={name} name={name} displayName={info.name || name} label={info.label} codeCount={info.codes.length} />
        ))}
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
  const { sidebarWidth, sidebarVisible, setSidebarWidth, toggleSidebar: _toggleSidebar } = useStore();
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
    <div className="flex-1 overflow-hidden flex">
      {sidebarVisible && (
        <>
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col flex-shrink-0 relative"
          >
            <div className="h-1/2 flex flex-col border-b border-zinc-200 dark:border-zinc-800"><TableList /></div>
            <div className="h-1/2 flex flex-col"><VariableList /></div>

            {/* Resize handle */}
            <div
              onMouseDown={() => setIsResizing(true)}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-500 hover:shadow-lg transition-colors"
            />
          </div>
        </>
      )}

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

// ─── Draggable Zone Item ──────────────────────────────────────────────────────
const DraggableZoneItem: React.FC<{ zoneType: 'row' | 'col'; item: any; onRemove: (id: string) => void; depth?: number }> = ({ zoneType, item, onRemove, depth = 0 }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `zone-item:${zoneType}:${item.id}` });
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({ id: `nest-target:${zoneType}:${item.id}` });
  const { variables } = useStore();
  const displayName = variables[item.variable]?.name || item.variable;
  const hasChildren = item.children && item.children.length > 0;
  const children = item.children || [];

  return (
    <div>
      <div
        ref={(node) => {
          setNodeRef(node);
          setDroppableRef(node);
        }}
        {...listeners}
        {...attributes}
        className={`flex items-center gap-2 border px-2 py-1.5 cursor-grab select-none transition-all ${
          isOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800'
        } ${isDragging ? 'opacity-40' : ''} hover:border-zinc-300 dark:hover:border-zinc-600 rounded`}
      >
        <span className="text-xs text-emerald-700 dark:text-emerald-400">{displayName}</span>
        {hasChildren && (
          <span className="text-xs text-zinc-400">({children.length})</span>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(item.id)}
          className="text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 text-sm leading-none ml-auto"
        >
          ×
        </button>
      </div>
      {hasChildren && (
        <div className="mt-1 space-y-1 border-l-2 border-zinc-200 dark:border-zinc-700 pl-2">
          {children.map((child: any) => (
            <DraggableZoneItem key={child.id} zoneType={zoneType} item={child} onRemove={onRemove} depth={depth + 1} />
          ))}
        </div>
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

  const renderItems = (itemList: any[]) => {
    return itemList.map((item) => (
      <DraggableZoneItem key={item.id} zoneType={zoneType} item={item} onRemove={onRemove} />
    ));
  };

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
      <div className={orientation === 'vertical' ? 'flex flex-col space-y-1' : 'flex flex-wrap gap-2'}>
        {items.length === 0 ? (
          <div className="text-xs text-zinc-300 dark:text-zinc-700 italic">drop here</div>
        ) : (
          renderItems(items)
        )}
      </div>
    </div>
  );
};

// ─── Filter def builder ───────────────────────────────────────────────────────
function buildFilterDef(filterItems: FilterItem[]): string | undefined {
  const parts: string[] = [];
  for (const item of filterItems) {
    if (item.condition === 'has_value') parts.push(`${item.variable}/*`);
    else if (item.condition === 'has_no_value') parts.push(`!${item.variable}/*`);
    else if (item.condition === 'includes_any' && item.selectedCodes.length > 0)
      parts.push(`${item.variable}/${item.selectedCodes.join(',')}`);
    else if (item.condition === 'includes_none' && item.selectedCodes.length > 0)
      parts.push(`!${item.variable}/${item.selectedCodes.join(',')}`);
  }
  return parts.length > 0 ? parts.join('.') : undefined;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const {
    dataLoaded, setDataLoaded, mergeAndSetVariables, setDataInfo,
    activeTableId, variables, tables,
    addRowItem, addColItem, addChildItem, removeRowItem, removeColItem, addFilterItem,
    sidebarVisible, toggleSidebar,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id));
  const handleDragCancel = () => setActiveDragId(null);

  const findItemInList = (items: any[], itemId: string): any | null => {
    for (const item of items) {
      if (item.id === itemId) return item;
      if (item.children) {
        const found = findItemInList(item.children, itemId);
        if (found) return found;
      }
    }
    return null;
  };

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
        const item = findItemInList(activeTable.row_items, itemId);
        if (item) { removeRowItem(activeTableId, itemId); addColItem(activeTableId, item); }
      } else if (sourceZone === 'col' && targetZone === 'row') {
        const item = findItemInList(activeTable.col_items, itemId);
        if (item) { removeColItem(activeTableId, itemId); addRowItem(activeTableId, item); }
      }
      return;
    }

    const varName = activeId;
    const varInfo = variables[varName];
    if (!varInfo?.codes?.length) return;
    const allCodes = varInfo.codes.map((c: any) => c.code).join(',');

    if (typeof over.id === 'string' && over.id.startsWith('nest-target:')) {
      const [, zone, parentId] = over.id.split(':');
      const newItem = { id: uuidv4(), variable: varName, codeDef: allCodes };
      addChildItem(activeTableId, parentId, newItem, zone as 'row' | 'col');
    } else if (over.id === 'row-zone') {
      addRowItem(activeTableId, { id: uuidv4(), variable: varName, codeDef: allCodes });
    } else if (over.id === 'col-zone') {
      addColItem(activeTableId, { id: uuidv4(), variable: varName, codeDef: allCodes });
    } else if (over.id === 'filter-zone') {
      const filterItem: FilterItem = { id: uuidv4(), variable: varName, condition: 'includes_any', selectedCodes: [] };
      addFilterItem(activeTableId, filterItem);
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
    <Router>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="h-screen flex flex-col bg-white dark:bg-zinc-950 font-mono">
          <Navigation onToggleSidebar={toggleSidebar} sidebarVisible={sidebarVisible} />
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
  );
};

// ─── Build Page ───────────────────────────────────────────────────────────────
const BuildPage: React.FC<{ onLoadSample: () => void; loading: boolean }> = ({ onLoadSample, loading }) => {
  const { dataLoaded, activeTableId, tables, variables, removeRowItem, removeColItem, setTableResult, updateTable } = useStore();
  const [localTab, setLocalTab] = useState<'build' | 'filter' | 'result'>('build');
  const [isComputing, setIsComputing] = useState(false);

  const activeTable = tables.find((t) => t.id === activeTableId);

  const expandCodes = (codeDef: string): string[] => {
    if (codeDef.includes('/')) {
      const [, codesPart] = codeDef.split('/', 2);
      return codesPart.split(',').map(c => c.trim()).filter(c => c.length > 0);
    }
    return codeDef.split(',').map(c => c.trim()).filter(c => c.length > 0);
  };

  const getCodeLabel = (key: string): string => {
    const parts = key.split('/');
    if (parts.length !== 2) return key;
    const [varName, code] = parts;
    const variable = variables[varName];
    if (!variable) return code;
    const codeObj = variable.codes.find((c: any) => c.code === code);
    return codeObj?.label || code;
  };

  const handleGenerate = async () => {
    if (!activeTable?.row_items.length) { alert('Add items to Sidebreak first'); return; }
    setIsComputing(true);
    try {
      const meanMappings: { variable: string; codeScores: Record<string, number> }[] = [];
      const seenVars = new Set<string>();

      const getVisibleCodes = (variable: string, rawCodes: string): string[] =>
        rawCodes.split(',').map((c: string) => c.trim()).filter((c: string) => {
          const vis = variables[variable]?.codes.find((vc: any) => vc.code === c)?.visibility ?? 'visible';
          return vis === 'visible';
        });

      // Expand items with nested children into individual row/col items
      const expandItems = (items: any[]): any[] => {
        const result: any[] = [];
        for (const item of items) {
          if (item.children && item.children.length > 0) {
            const parentCodes = getVisibleCodes(item.variable, item.codeDef);
            for (const child of item.children) {
              const childCodes = getVisibleCodes(child.variable, child.codeDef);
              for (const pc of parentCodes) {
                for (const cc of childCodes) {
                  result.push({
                    variable: `${item.variable}/${pc}.${child.variable}/${cc}`,
                    codeDef: `${item.variable}/${pc}.${child.variable}/${cc}`,
                  });
                }
              }
            }
          } else {
            const codes = getVisibleCodes(item.variable, item.codeDef);
            for (const code of codes) {
              result.push({
                variable: `${item.variable}/${code}`,
                codeDef: `${item.variable}/${code}`,
              });
            }
          }
        }
        return result;
      };

      const expandedRows = expandItems(activeTable.row_items);
      const expandedCols = expandItems(activeTable.col_items);

      // Collect mean score mappings from all unique variables in expanded items
      const allVars = new Set<string>();
      for (const item of [...expandedRows, ...expandedCols]) {
        const vars = item.variable.split('.');
        for (const v of vars) {
          const varName = v.split('/')[0];
          allVars.add(varName);
        }
      }
      for (const varName of allVars) {
        if (seenVars.has(varName)) continue;
        const v = variables[varName];
        if (!v) continue;
        const scoredCodes = v.codes.filter((c: any) => c.factor != null);
        if (scoredCodes.length > 0) {
          const codeScores: Record<string, number> = {};
          scoredCodes.forEach((c: any) => { codeScores[c.code] = c.factor; });
          meanMappings.push({ variable: varName, codeScores });
          seenVars.add(varName);
        }
      }

      const removedParts: string[] = [];
      Object.entries(variables).forEach(([varKey, info]) => {
        const removed = info.codes.filter((c: any) => c.visibility === 'removed').map((c: any) => c.code);
        if (removed.length > 0) removedParts.push(`!${varKey}/${removed.join(',')}`);
      });
      const baseFilter = buildFilterDef(activeTable.filter_items);
      const effectiveFilter = [...(baseFilter ? [baseFilter] : []), ...removedParts].join('.') || undefined;

      const result = await computeApi.crosstab({
        row_items: expandedRows.map((i: any) => ({ variable: i.variable, codeDef: i.codeDef })),
        col_items: expandedCols.map((i: any) => ({ variable: i.variable, codeDef: i.codeDef })),
        filter_def: effectiveFilter,
        mean_score_mappings: meanMappings.length > 0 ? meanMappings : undefined,
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
                      const isCodeVisible = (variable: string, code: string) => {
                        const vis = variables[variable]?.codes.find((c: any) => c.code === code)?.visibility ?? 'visible';
                        return vis === 'visible';
                      };

                      // Build hierarchical preview structure from nested items
                      interface PreviewItem {
                        variable: string;
                        codeDef: string;
                        children?: PreviewItem[];
                        isNested: boolean;
                      }

                      const buildPreviewStructure = (items: any[]): PreviewItem[] => {
                        return items.map((item: any) => {
                          if (item.children && item.children.length > 0) {
                            return {
                              variable: item.variable,
                              codeDef: item.codeDef,
                              isNested: true,
                              children: item.children.map((child: any) => ({
                                variable: child.variable,
                                codeDef: child.codeDef,
                                isNested: false,
                              })),
                            };
                          }
                          return { variable: item.variable, codeDef: item.codeDef, isNested: false };
                        });
                      };

                      const rowStructure = buildPreviewStructure(activeTable.row_items);
                      const colStructure = buildPreviewStructure(activeTable.col_items);

                      // For columns: determine if any are nested (have children)
                      const hasNestedCols = colStructure.some((c) => c.isNested);
                      const hasNestedRows = rowStructure.some((r) => r.isNested);

                      // Build column list for header
                      interface ColDef {
                        parentCode: string | null;
                        parentCodeValue: string;
                        parentLabel: string;
                        childCode: string;
                        childLabel: string;
                        fullKey: string;
                      }

                      const buildColDefs = (structure: PreviewItem[]): ColDef[] => {
                        const defs: ColDef[] = [];
                        for (const item of structure) {
                          const parentCodes = expandCodes(item.codeDef).filter((c) => isCodeVisible(item.variable, c));
                          if (item.isNested && item.children) {
                            for (const pc of parentCodes) {
                              for (const child of item.children) {
                                const childCodes = expandCodes(child.codeDef).filter((c) => isCodeVisible(child.variable, c));
                                for (const cc of childCodes) {
                                  defs.push({
                                    parentCode: `${item.variable}/${pc}`,
                                    parentCodeValue: pc,
                                    parentLabel: getCodeLabel(`${item.variable}/${pc}`),
                                    childCode: cc,
                                    childLabel: getCodeLabel(`${child.variable}/${cc}`),
                                    fullKey: `${item.variable}/${pc}.${child.variable}/${cc}`,
                                  });
                                }
                              }
                            }
                          } else {
                            for (const cc of parentCodes) {
                              defs.push({
                                parentCode: null,
                                parentCodeValue: '',
                                parentLabel: '',
                                childCode: cc,
                                childLabel: getCodeLabel(`${item.variable}/${cc}`),
                                fullKey: `${item.variable}/${cc}`,
                              });
                            }
                          }
                        }
                        return defs;
                      };

                      const previewColDefs = buildColDefs(colStructure);
                      const previewRowDefs = buildColDefs(rowStructure);

                      if (previewRowDefs.length === 0 && previewColDefs.length === 0) {
                        return (
                          <div className="h-full flex items-center justify-center">
                            <span className="text-zinc-300 dark:text-zinc-700 text-xs">drop variables to header and sidebreak to preview</span>
                          </div>
                        );
                      }

                      // Group columns by parent for header rendering
                      const groupedCols: { parentCodeValue: string; parentLabel: string; cols: ColDef[] }[] = [];
                      if (hasNestedCols) {
                        const parentMap: Map<string, ColDef[]> = new Map();
                        const parentLabels: Map<string, string> = new Map();
                        const parentCodeValues: Map<string, string> = new Map();
                        for (const cd of previewColDefs) {
                          const key = cd.parentCode ?? '__none__';
                          if (!parentMap.has(key)) {
                            parentMap.set(key, []);
                            parentLabels.set(key, cd.parentLabel);
                            parentCodeValues.set(key, cd.parentCodeValue);
                          }
                          parentMap.get(key)!.push(cd);
                        }
                        for (const [key, cols] of parentMap) {
                          groupedCols.push({ parentCodeValue: parentCodeValues.get(key) || '', parentLabel: parentLabels.get(key) || '', cols });
                        }
                      } else {
                        groupedCols.push({ parentCodeValue: '', parentLabel: '', cols: previewColDefs });
                      }

                      // Group rows by parent for body rendering
                      const groupedRows: { parentCode: string | null; parentLabel: string; rows: ColDef[] }[] = [];
                      if (hasNestedRows) {
                        const parentMap: Map<string, ColDef[]> = new Map();
                        const parentLabels: Map<string, string> = new Map();
                        for (const rd of previewRowDefs) {
                          const key = rd.parentCode ?? '__none__';
                          if (!parentMap.has(key)) parentMap.set(key, []);
                          parentMap.get(key)!.push(rd);
                          parentLabels.set(key, rd.parentLabel);
                        }
                        for (const [key, rows] of parentMap) {
                          groupedRows.push({ parentCode: key === '__none__' ? null : key, parentLabel: parentLabels.get(key) || '', rows });
                        }
                      } else {
                        groupedRows.push({ parentCode: null, parentLabel: '', rows: previewRowDefs });
                      }

                      return (
                        <table className="w-full border-collapse text-xs">
                          <thead className="sticky top-0">
                            {hasNestedCols ? (
                              <>
                                <tr>
                                  <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-32"></th>
                                  <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 w-24" rowSpan={2}>Total</th>
                                  {groupedCols.map((g) => (
                                    <th key={g.parentCodeValue || 'none'} colSpan={g.cols.length} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 font-medium">
                                      {g.parentCodeValue}
                                    </th>
                                  ))}
                                </tr>
                                <tr>
                                  {groupedCols.map((g) =>
                                    g.cols.map((cd) => (
                                      <th key={cd.fullKey} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-24">
                                        {cd.childLabel}
                                      </th>
                                    ))
                                  )}
                                </tr>
                              </>
                            ) : (
                              <tr>
                                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-32"></th>
                                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 w-24">Total</th>
                                {previewColDefs.map((cd) => (
                                  <th key={cd.fullKey} className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-24">
                                    {cd.childLabel}
                                  </th>
                                ))}
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50">Base</td>
                              <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800">—</td>
                              {previewColDefs.map((cd) => (
                                <td key={`base-${cd.fullKey}`} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-300 dark:text-zinc-700">—</td>
                              ))}
                            </tr>
                            {groupedRows.map((g) => (
                              <React.Fragment key={g.parentCode ?? 'none'}>
                                {hasNestedRows && (
                                  <tr className="bg-zinc-100 dark:bg-zinc-800/60">
                                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 font-medium" colSpan={previewColDefs.length + 2}>
                                      {g.parentLabel}
                                    </td>
                                  </tr>
                                )}
                                {g.rows.map((rd) => (
                                  <tr key={rd.fullKey} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                                    <td className={`border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 ${hasNestedRows ? 'pl-6 text-zinc-600 dark:text-zinc-400' : 'text-zinc-600 dark:text-zinc-400'}`}>{rd.childLabel}</td>
                                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-300 dark:text-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">—</td>
                                    {previewColDefs.map((cd) => (
                                      <td key={`${rd.fullKey}-${cd.fullKey}`} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-300 dark:text-zinc-700">—</td>
                                    ))}
                                  </tr>
                                ))}
                              </React.Fragment>
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
  const colNames = Object.keys(result.counts[rowNames[0] || 'Total'] || {}).filter((k) => k !== 'Total');

  const firstRow = rowNames[0] || '';
  const rowVarName = firstRow.split('/')[0];
  const firstCol = colNames[0] || '';
  const colVarName = firstCol.split('/')[0];
  const rowVarLabel = variables[rowVarName]?.label || rowVarName;
  const colVarLabel = variables[colVarName]?.label || colVarName;

  const hasStats = result.mean && Object.keys(result.mean).length > 0;

  const formatPct = (val: number) => {
    const pct = val.toFixed(displayOptions.decimalPlaces);
    return displayOptions.showPctSign ? `${pct}%` : pct;
  };

  const getCodeLabel = (key: string): string => {
    const parts = key.split('/');
    if (parts.length !== 2) return key;
    const [varName, code] = parts;
    const variable = variables[varName];
    if (!variable) return code;
    const codeObj = variable.codes.find((c: any) => c.code === code);
    return codeObj?.label || code;
  };

  // Parse compound row names like "A1/1.Q2/1" into parent/child structure
  interface ParsedRowKey {
    fullKey: string;
    parentCode: string | null;
    parentLabel: string;
    childCode: string;
    childLabel: string;
    isCompound: boolean;
  }

  const parseRowKey = (key: string): ParsedRowKey => {
    if (key.includes('.')) {
      const parts = key.split('.');
      const parentPart = parts[0];
      const childPart = parts[parts.length - 1];
      const childCodeValue = childPart.split('/')[1] || '';
      return {
        fullKey: key,
        parentCode: parentPart,
        parentLabel: getCodeLabel(parentPart),
        childCode: childCodeValue,
        childLabel: getCodeLabel(childPart),
        isCompound: true,
      };
    }
    return {
      fullKey: key,
      parentCode: null,
      parentLabel: '',
      childCode: key,
      childLabel: getCodeLabel(key),
      isCompound: false,
    };
  };

  const parsedRows = rowNames.map(parseRowKey).sort((a, b) => {
    // Sort by parent code, then by child code for consistent grouping
    if (a.parentCode !== b.parentCode) {
      return (a.parentCode || '').localeCompare(b.parentCode || '');
    }
    return a.childCode.localeCompare(b.childCode);
  });
  const hasNestedRows = parsedRows.some((r) => r.isCompound);

  // Parse compound column names similarly
  interface ParsedColKey {
    fullKey: string;
    parentCode: string | null;
    parentCodeValue: string;
    parentLabel: string;
    childCode: string;
    childLabel: string;
    isCompound: boolean;
  }

  const parseColKey = (key: string): ParsedColKey => {
    if (key.includes('.')) {
      const parts = key.split('.');
      const parentPart = parts[0];
      const childPart = parts[parts.length - 1];
      const parentCodeValue = parentPart.split('/')[1] || '';
      const childCodeValue = childPart.split('/')[1] || '';
      return {
        fullKey: key,
        parentCode: parentPart,
        parentCodeValue,
        parentLabel: getCodeLabel(parentPart),
        childCode: childCodeValue,
        childLabel: getCodeLabel(childPart),
        isCompound: true,
      };
    }
    return {
      fullKey: key,
      parentCode: null,
      parentCodeValue: '',
      parentLabel: '',
      childCode: key,
      childLabel: getCodeLabel(key),
      isCompound: false,
    };
  };

  const parsedCols = colNames.map(parseColKey).sort((a, b) => {
    // Sort by parent code, then by child code for consistent grouping
    if (a.parentCode !== b.parentCode) {
      return (a.parentCode || '').localeCompare(b.parentCode || '');
    }
    return a.childCode.localeCompare(b.childCode);
  });
  const hasNestedCols = parsedCols.some((c) => c.isCompound);

  // Group rows by parent code
  const groupedRows: { parentCode: string | null; parentLabel: string; rows: ParsedRowKey[] }[] = [];
  if (hasNestedRows) {
    const parentMap: Map<string, ParsedRowKey[]> = new Map();
    const parentLabels: Map<string, string> = new Map();
    for (const pr of parsedRows) {
      const key = pr.parentCode ?? '__none__';
      if (!parentMap.has(key)) parentMap.set(key, []);
      parentMap.get(key)!.push(pr);
      parentLabels.set(key, pr.parentLabel);
    }
    for (const [key, rows] of parentMap) {
      groupedRows.push({ parentCode: key === '__none__' ? null : key, parentLabel: parentLabels.get(key) || '', rows });
    }
  } else {
    // Fallback to original grouping by variable name
    const origGrouped: { [key: string]: string[] } = {};
    rowNames.forEach((row) => { const p = row.split('/')[0]; if (!origGrouped[p]) origGrouped[p] = []; origGrouped[p].push(row); });
    for (const [prefix, codes] of Object.entries(origGrouped)) {
      groupedRows.push({
        parentCode: prefix,
        parentLabel: variables[prefix]?.label || prefix,
        rows: codes.map((c) => parseRowKey(c)),
      });
    }
  }

  // Group columns by parent code for 2-level header
  const groupedCols: { parentCodeValue: string; parentLabel: string; cols: ParsedColKey[] }[] = [];
  if (hasNestedCols) {
    const parentMap: Map<string, ParsedColKey[]> = new Map();
    const parentLabels: Map<string, string> = new Map();
    const parentCodeValues: Map<string, string> = new Map();
    for (const pc of parsedCols) {
      const key = pc.parentCode ?? '__none__';
      if (!parentMap.has(key)) {
        parentMap.set(key, []);
        parentLabels.set(key, pc.parentLabel);
        parentCodeValues.set(key, pc.parentCodeValue);
      }
      parentMap.get(key)!.push(pc);
    }
    for (const [key, cols] of parentMap) {
      groupedCols.push({ parentCodeValue: parentCodeValues.get(key) || '', parentLabel: parentLabels.get(key) || '', cols });
    }
  } else {
    groupedCols.push({ parentCodeValue: '', parentLabel: '', cols: parsedCols });
  }

  const handleCopy = () => {
    const lines: string[] = [];
    lines.push(['', 'Total', ...colNames.map(c => getCodeLabel(c))].join('\t'));
    lines.push(['Base', String(result.base), ...colNames.map(c => String(result.counts['Total']?.[c] ?? 0))].join('\t'));
    for (const g of groupedRows) {
      if (hasNestedRows) {
        lines.push([g.parentLabel, '', ...colNames.map(() => '')].join('\t'));
      }
      for (const pr of g.rows) {
        lines.push([pr.childLabel, String(result.counts[pr.fullKey]?.['Total'] ?? 0), ...colNames.map(c => String(result.counts[pr.fullKey]?.[c] ?? 0))].join('\t'));
      }
    }
    navigator.clipboard.writeText(lines.join('\n'));
    alert('copied!');
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
    return statData?.[col] ?? '—';
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
              </select>
            </div>
          </>
        )}
        <button
          onClick={handleCopy}
          className="ml-auto px-3 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          copy
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-wrap gap-6 text-xs text-zinc-500 items-center">
        <span>row: <span className="text-zinc-700 dark:text-zinc-300">{rowVarLabel}</span></span>
        <span>col: <span className="text-zinc-700 dark:text-zinc-300">{colVarLabel || '—'}</span></span>
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
            {hasNestedCols ? (
              <>
                <tr>
                  <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-32"></th>
                  <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 w-24" rowSpan={2}>Total</th>
                  {groupedCols.map((g) => (
                    <th key={g.parentCodeValue || 'none'} colSpan={g.cols.length} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 font-medium">
                      {g.parentCodeValue}
                    </th>
                  ))}
                </tr>
                <tr>
                  {groupedCols.map((g) =>
                    g.cols.map((pc) => (
                      <th key={pc.fullKey} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-24">
                        {pc.childLabel}
                      </th>
                    ))
                  )}
                </tr>
              </>
            ) : (
              <tr>
                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-32"></th>
                <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 w-24">Total</th>
                {colNames.map((col) => (
                  <th key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center text-zinc-500 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 w-24">
                    {getCodeLabel(col)}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50">
              <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">Base</td>
              <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-800 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800">{result.base}</td>
              {colNames.map((col) => (
                <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-600 dark:text-zinc-400">
                  {result.counts['Total']?.[col] ?? 0}
                </td>
              ))}
            </tr>
            {groupedRows.map((g) => (
              <React.Fragment key={g.parentCode ?? 'none'}>
                {hasNestedRows && (
                  <tr className="bg-zinc-100 dark:bg-zinc-800/60">
                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 font-medium" colSpan={colNames.length + 2}>
                      {g.parentLabel}
                    </td>
                  </tr>
                )}
                {g.rows.map((pr) => {
                  const rowTotal = result.counts[pr.fullKey]?.['Total'] ?? 0;

                  if (displayOptions.counts && displayOptions.colPct) {
                    return (
                      <React.Fragment key={pr.fullKey}>
                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                          <td className={`border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-zinc-700 dark:text-zinc-300 ${hasNestedRows ? 'pl-6' : ''}`}>{pr.childLabel}</td>
                          <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-center text-zinc-800 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40">{rowTotal}</td>
                          {colNames.map((col) => (
                            <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-center text-zinc-600 dark:text-zinc-400">
                              {result.counts[pr.fullKey]?.[col] ?? 0}
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                          <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-center text-blue-600 dark:text-blue-400/70 bg-zinc-50 dark:bg-zinc-800/20">{formatPct(result.col_pct[pr.fullKey]?.['Total'] ?? 0)}</td>
                          {colNames.map((col) => (
                            <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-center text-blue-600 dark:text-blue-400/70">
                              {formatPct(result.col_pct[pr.fullKey]?.[col] ?? 0)}
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    );
                  } else if (displayOptions.counts) {
                    return (
                      <tr key={pr.fullKey} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className={`border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 ${hasNestedRows ? 'pl-6' : ''}`}>{pr.childLabel}</td>
                        <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-800 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40">{rowTotal}</td>
                        {colNames.map((col) => (
                          <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-zinc-600 dark:text-zinc-400">
                            {result.counts[pr.fullKey]?.[col] ?? 0}
                          </td>
                        ))}
                      </tr>
                    );
                  } else if (displayOptions.colPct) {
                    return (
                      <tr key={pr.fullKey} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className={`border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 ${hasNestedRows ? 'pl-6' : ''}`}>{pr.childLabel}</td>
                        <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-blue-600 dark:text-blue-400/70 bg-zinc-50 dark:bg-zinc-800/40">{formatPct(result.col_pct[pr.fullKey]?.['Total'] ?? 0)}</td>
                        {colNames.map((col) => (
                          <td key={col} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-blue-600 dark:text-blue-400/70">
                            {formatPct(result.col_pct[pr.fullKey]?.[col] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    );
                  }
                  return null;
                })}
              </React.Fragment>
            ))}
            {/* Stats summary rows at bottom */}
            {statRows.length > 0 && (
              <>
                {statRows.map((sr) => (
                  <tr key={`stat-${sr.key}`} className="bg-amber-50 dark:bg-amber-900/10">
                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-zinc-500 dark:text-zinc-500 italic font-medium">{sr.label}</td>
                    <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-amber-700 dark:text-amber-400/80 bg-zinc-100 dark:bg-zinc-800/40 font-medium">
                      {statValue(sr.key, 'Total')}
                    </td>
                    {colNames.map((col) => (
                      <td key={`${sr.key}-${col}`} className="border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-center text-amber-700 dark:text-amber-400/80">
                        {statValue(sr.key, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Merge Multiple Response Dialog ───────────────────────────────────────────
const MergeMRDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { variables, mergeAndSetVariables } = useStore();
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allColumns = Object.keys(variables);

  // Auto-detect MR groups: columns sharing a prefix like A1_p1, A1_p2 → group "A1"
  const detectedGroups: Record<string, string[]> = {};
  for (const col of allColumns) {
    const m = col.match(/^(.+?)[_](p\d+|f\d+|r\d+)$/i);
    if (m) {
      const prefix = m[1];
      if (!detectedGroups[prefix]) detectedGroups[prefix] = [];
      detectedGroups[prefix].push(col);
    }
  }

  const toggleCol = (col: string) => {
    setSelectedCols((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  };

  const loadGroup = (cols: string[]) => {
    setSelectedCols(cols);
    const prefix = cols[0]?.replace(/[_](p\d+|f\d+|r\d+)$/i, '') || '';
    if (!name) setName(prefix);
    if (!label) setLabel(prefix);
  };

  const handleMerge = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (selectedCols.length < 2) { setError('Select at least 2 columns'); return; }
    if (variables[name]) { setError('Variable name already exists'); return; }
    setLoading(true);
    setError(null);
    try {
      await dataApi.mergeMR(name, selectedCols, label || name);
      const vars = await dataApi.getVariables();
      mergeAndSetVariables(vars);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Merge failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Merge Multiple Response Variables</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Name + Label */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 block mb-1">merged variable name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:border-blue-400 outline-none" placeholder="e.g. A1" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500 block mb-1">label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:border-blue-400 outline-none" placeholder="e.g. Brand awareness" />
            </div>
          </div>

          {/* Detected groups */}
          {Object.keys(detectedGroups).length > 0 && (
            <div>
              <label className="text-xs text-zinc-500 block mb-2">detected groups (click to load)</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(detectedGroups).map(([prefix, cols]) => (
                  <button key={prefix} onClick={() => loadGroup(cols)} className="text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {prefix} ({cols.length})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Column picker */}
          <div>
            <label className="text-xs text-zinc-500 block mb-2">select columns ({selectedCols.length} selected)</label>
            <div className="border border-zinc-200 dark:border-zinc-700 rounded max-h-64 overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="border-b border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 w-10">#</th>
                    <th className="border-b border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500">column</th>
                    <th className="border-b border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 w-24">label</th>
                  </tr>
                </thead>
                <tbody>
                  {allColumns.map((col) => {
                    const checked = selectedCols.includes(col);
                    return (
                      <tr key={col} className={`cursor-pointer ${checked ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}`} onClick={() => toggleCol(col)}>
                        <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-2 py-1">
                          <input type="checkbox" checked={checked} onChange={() => {}} className="cursor-pointer" />
                        </td>
                        <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-2 py-1 font-mono text-zinc-700 dark:text-zinc-300">{col}</td>
                        <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-2 py-1 text-zinc-500 truncate">{variables[col]?.label || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {error && <div className="text-xs text-red-500">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
          <button onClick={onClose} className="text-xs px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">cancel</button>
          <button onClick={handleMerge} disabled={loading} className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
            {loading ? 'merging...' : 'merge'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Edit Variables Page ──────────────────────────────────────────────────────
const EditVariablesPage: React.FC = () => {
  const { variables } = useStore();
  const navigate = useNavigate();
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  const variableEntries = Object.entries(variables);

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">variables</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 dark:text-zinc-600">{variableEntries.length}</span>
          <button
            onClick={() => setShowMergeDialog(true)}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            merge multiple response
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0">
            <tr className="bg-zinc-50 dark:bg-zinc-900">
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-500 font-medium w-28">key</th>
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-500 font-medium w-32">name</th>
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-500 font-medium">definition</th>
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left text-zinc-500 font-medium w-16">type</th>
              <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-right text-zinc-500 font-medium w-16">codes</th>
            </tr>
          </thead>
          <tbody>
            {variableEntries.map(([key, info]) => {
              const hiddenCount = info.codes.filter((c: any) => c.visibility === 'hidden').length;
              const removedCount = info.codes.filter((c: any) => c.visibility === 'removed').length;
              return (
                <tr
                  key={key}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer"
                  onClick={() => navigate(`/edit-variables/${encodeURIComponent(key)}`)}
                >
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-emerald-700 dark:text-emerald-400 font-medium truncate max-w-[7rem]">{key}</td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-zinc-700 dark:text-zinc-300 truncate max-w-[8rem]">{info.name || key}</td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-zinc-500 truncate">{info.label}</td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-zinc-400">{info.type}</td>
                  <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2 text-right text-zinc-400">
                    {info.codes.length}
                    {(hiddenCount > 0 || removedCount > 0) && (
                      <span className="ml-1 text-orange-500">
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

      {showMergeDialog && (
        <MergeMRDialog onClose={() => setShowMergeDialog(false)} />
      )}
    </div>
  );
};

// ─── Variable Detail Page ─────────────────────────────────────────────────────
const VariableDetailPage: React.FC = () => {
  const { varName: encodedVarName } = useParams<{ varName: string }>();
  const varKey = encodedVarName ? decodeURIComponent(encodedVarName) : '';
  const navigate = useNavigate();
  const {
    variables,
    mergeAndSetVariables,
    updateVariableLabel,
    updateVariableDisplayName,
    updateCodeLabel,
    updateCodeFactor,
    updateCodeVisibility,
    toggleVariableStat,
  } = useStore();

  const info: VariableInfo | undefined = variables[varKey];
  const isMerged = info?.type === 'multiple_response';

  if (!info) {
    return (
      <div className="p-6 text-zinc-500 text-sm">
        Variable <span className="font-mono">{varKey}</span> not found.{' '}
        <button onClick={() => navigate('/edit-variables')} className="text-blue-500 underline">back</button>
      </div>
    );
  }

  const handleDeleteMerged = async () => {
    if (!confirm(`Delete merged variable "${varKey}"?`)) return;
    try {
      await dataApi.deleteMergedVariable(varKey);
      const vars = await dataApi.getVariables();
      mergeAndSetVariables(vars);
      navigate('/edit-variables');
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Delete failed');
    }
  };

  const hiddenCount = info.codes.filter((c: any) => c.visibility === 'hidden').length;
  const removedCount = info.codes.filter((c: any) => c.visibility === 'removed').length;

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
        <span className="text-xs text-zinc-300 dark:text-zinc-700">/</span>
        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{varKey}</span>
        {isMerged && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">merged</span>}
        {(hiddenCount > 0 || removedCount > 0) && (
          <span className="text-xs text-orange-500 ml-1">
            {hiddenCount > 0 && `${hiddenCount} hidden`}
            {hiddenCount > 0 && removedCount > 0 && ', '}
            {removedCount > 0 && `${removedCount} removed`}
          </span>
        )}
        {isMerged && (
          <button onClick={handleDeleteMerged} className="ml-auto text-xs text-red-500 hover:text-red-600">delete</button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex gap-4 p-4">
        {/* Left: Metadata + Stats */}
        <div className="w-80 shrink-0 overflow-auto space-y-6 pr-2">
          {/* Name + Definition */}
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">name</label>
              <input
                type="text"
                value={info.name || varKey}
                onChange={(e) => updateVariableDisplayName(varKey, e.target.value)}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:border-blue-400 dark:focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">definition</label>
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
            <label className="text-xs text-zinc-500 block mb-2">show statistics</label>
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

        {/* Right: Codes table (scrollable) */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <label className="text-xs text-zinc-500 block mb-2">codes ({info.codes.length})</label>
          <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-700">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-50 dark:bg-zinc-800">
                  <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 w-16">code</th>
                  <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 flex-1">label</th>
                  <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 w-24">factor</th>
                  <th className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left text-zinc-500 w-28">visibility</th>
                </tr>
              </thead>
              <tbody>
                {info.codes.map((code) => {
                  const vis = code.visibility ?? 'visible';
                  const rowClass = vis === 'removed'
                    ? 'bg-red-50 dark:bg-red-900/10 opacity-50'
                    : vis === 'hidden'
                      ? 'opacity-60'
                      : '';
                  return (
                    <tr key={code.code} className={`${rowClass} hover:bg-zinc-50 dark:hover:bg-zinc-800/30`}>
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-700 dark:text-zinc-300 font-medium">{code.code}</td>
                      <td className="border border-zinc-200 dark:border-zinc-700 px-2 py-1">
                        <input
                          type="text"
                          value={code.label}
                          onChange={(e) => updateCodeLabel(varKey, code.code, e.target.value)}
                          className="w-full text-xs bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-blue-400 dark:focus:border-blue-500 px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 outline-none"
                        />
                      </td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
