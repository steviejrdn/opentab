import React, { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { VariableInfo, VariableCode } from '../lib/api';

// Simple icons using text/symbols
const XIcon = () => <span className="text-xl">×</span>;
const GripIcon = () => <span className="text-zinc-400">⋮⋮</span>;
const EyeIcon = () => <span>👁</span>;
const EyeOffIcon = () => <span className="opacity-50">👁</span>;
const TrashIcon = () => <span>🗑</span>;
const PlusIcon = () => <span className="text-lg">+</span>;
const EditIcon = () => <span>✎</span>;

interface VariableEditPanelProps {
  variableKey: string;
  variable: VariableInfo;
  variables: Record<string, VariableInfo>;
  onClose: () => void;
  onUpdateLabel: (varName: string, label: string) => void;
  onUpdateDisplayName: (varName: string, displayName: string) => void;
  onUpdateCodeLabel: (varName: string, code: string, label: string) => void;
  onUpdateCodeVisibility: (varName: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  onUpdateCodeFactor: (varName: string, code: string, factor: number | null) => void;
  onUpdateCodeSyntax: (varName: string, code: string, syntax: string) => void;
  onUpdateNetCode?: (varName: string, code: string, syntax: string) => void;
  onReorderCodes: (varName: string, orderedCodes: string[]) => void;
  onAddNetCode: (varName: string, netOf: string[], label: string) => void;
  onAddCode?: (varName: string, label: string, syntax: string) => void;
  onToggleVariableStat?: (varName: string, stat: 'showMean' | 'showStdError' | 'showStdDev' | 'showVariance') => void;
}

interface SortableCodeRowProps {
  code: VariableCode;
  varKey: string;
  varName: string;
  isSelected: boolean;
  onToggleSelect: (code: string) => void;
  onUpdateLabel: (varName: string, code: string, label: string) => void;
  onUpdateVisibility: (varName: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  onUpdateFactor: (varName: string, code: string, factor: number | null) => void;
  onEditSyntax: (code: VariableCode, currentSyntax: string) => void;
}

// Build name to key mapping for syntax builder
const buildNameToKeyMap = (variables: Record<string, VariableInfo>): Record<string, string> => {
  const map: Record<string, string> = {};
  Object.entries(variables).forEach(([key, info]) => {
    const name = info.name || key;
    map[name] = key;
  });
  return map;
};

// Syntax Builder Modal Component
interface SyntaxBuilderModalProps {
  variables: Record<string, VariableInfo>;
  initialSyntax: string;
  onSave: (syntax: string) => void;
  onClose: () => void;
}

const SyntaxBuilderModal: React.FC<SyntaxBuilderModalProps> = ({ variables, initialSyntax, onSave, onClose }) => {
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
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
                        {vInfo.codes?.filter((c: any) => c.visibility !== 'removed').map((c: any) => (
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
                <div className="text-xs">
                  {(() => {
                    const elements: React.ReactNode[] = [];
                    let lastEnd = 0;
                    atoms.forEach((atom, idx) => {
                      const before = rawSyntax.slice(lastEnd, atom.start);
                      if (before) {
                        const tokens = before.match(/[+.]|\(|\)/g) || [];
                        tokens.forEach((tok, ti) => {
                          if (tok === '+') elements.push(<span key={`op-${idx}-${ti}`} className="mx-1 text-emerald-600 dark:text-emerald-400 font-medium">OR</span>);
                          else if (tok === '.') elements.push(<span key={`op-${idx}-${ti}`} className="mx-1 text-blue-500 font-medium">AND</span>);
                          else if (tok === '(') elements.push(<span key={`op-${idx}-${ti}`} className="text-zinc-400">(</span>);
                          else if (tok === ')') elements.push(<span key={`op-${idx}-${ti}`} className="text-zinc-400">)</span>);
                        });
                      }
                      const cleanCode = atom.isNot ? atom.codePart.slice(1) : atom.codePart;
                      const { codeLabel } = getLabelForAtom(atom.varName, atom.codePart, atom.isNot);
                      const displayCode = atom.isNot ? `n${cleanCode}` : cleanCode;
                      elements.push(
                        <span key={`atom-${idx}`} className="inline-flex items-center">
                          {atom.isNot && <span className="text-[9px] font-bold text-red-500 dark:text-red-400 mr-1">NOT</span>}
                          <span className="font-mono text-purple-600 dark:text-purple-400">{atom.varName}/{displayCode}</span>
                          <span className="text-zinc-400 mx-1">=</span>
                          <span className="text-zinc-600 dark:text-zinc-300">{codeLabel}</span>
                        </span>
                      );
                      lastEnd = atom.end;
                    });
                    const after = rawSyntax.slice(lastEnd);
                    if (after) {
                      const tokens = after.match(/[+.]|\(|\)/g) || [];
                      tokens.forEach((tok, ti) => {
                        if (tok === '+') elements.push(<span key={`op-after-${ti}`} className="mx-1 text-emerald-600 dark:text-emerald-400 font-medium">OR</span>);
                        else if (tok === '.') elements.push(<span key={`op-after-${ti}`} className="mx-1 text-blue-500 font-medium">AND</span>);
                        else if (tok === '(') elements.push(<span key={`op-after-${ti}`} className="text-zinc-400">(</span>);
                        else if (tok === ')') elements.push(<span key={`op-after-${ti}`} className="text-zinc-400">)</span>);
                      });
                    }
                    return <div className="flex items-center gap-1 flex-wrap">{elements}</div>;
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

const SortableCodeRow: React.FC<SortableCodeRowProps> = ({
  code,
  varKey,
  varName,
  isSelected,
  onToggleSelect,
  onUpdateLabel,
  onUpdateVisibility,
  onUpdateFactor,
  onEditSyntax,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: code.code });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const visibility = code.visibility ?? 'visible';
  const isRemoved = visibility === 'removed';
  const isHidden = visibility === 'hidden';

  // Get syntax for display - use code.syntax directly, not from code_syntax array
  // to avoid index misalignment when codes are filtered/removed
  const netSyntax = code.isNet && code.netOf
    ? code.netOf.map((nc) => `${varName}/${nc}`).join('+')
    : null;
  const displaySyntax = netSyntax || code.syntax || `${varName}/${code.code}`;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${isRemoved ? 'opacity-40 bg-red-50' : ''} ${isHidden ? 'opacity-60' : ''}`}
    >
      {/* Checkbox for netting */}
      <td className="px-1 py-1 border-b border-zinc-200 dark:border-zinc-700 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(code.code)}
          className="cursor-pointer w-3.5 h-3.5"
        />
      </td>
      {/* Drag handle */}
      <td className="px-1 py-1 border-b border-zinc-200 dark:border-zinc-700">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 text-xs"
        >
          <GripIcon />
        </button>
      </td>
      {/* Code */}
      <td className="px-1 py-1 border-b border-zinc-200 dark:border-zinc-700 font-mono text-xs">
        {code.code}
      </td>
      {/* Label */}
      <td className="px-1 py-1 border-b border-zinc-200 dark:border-zinc-700">
        <input
          type="text"
          value={code.label || ''}
          onChange={(e) => onUpdateLabel(varKey, code.code, e.target.value)}
          className="w-full text-xs bg-transparent border border-zinc-300 dark:border-zinc-600 px-1.5 py-0.5 rounded"
          placeholder="Label"
        />
      </td>
      {/* Syntax */}
      <td className="px-1 py-1 border-b border-zinc-200 dark:border-zinc-700 font-mono text-[10px] text-zinc-500">
        <div className="flex items-center gap-0.5">
          <span className="truncate max-w-[120px]">{displaySyntax}</span>
          {(code.isNet || code.isCustom) && (
            <button
              onClick={() => onEditSyntax(code, displaySyntax)}
              className="p-0.5 rounded text-zinc-400 hover:text-blue-600 shrink-0"
              title="Edit syntax"
            >
              <EditIcon />
            </button>
          )}
        </div>
      </td>
      {/* Factor */}
      <td className="px-1 py-1 border-b border-zinc-200 dark:border-zinc-700">
        <input
          type="number"
          value={code.factor ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onUpdateFactor(varKey, code.code, val ? parseFloat(val) : null);
          }}
          placeholder="-"
          className="w-14 text-xs bg-transparent border border-zinc-300 dark:border-zinc-600 px-1.5 py-0.5 rounded"
        />
      </td>
      {/* Actions */}
      <td className="px-1 py-1 border-b border-zinc-200 dark:border-zinc-700 text-right">
        <div className="flex items-center justify-end gap-0.5">
          {/* Visibility toggle */}
          <button
            onClick={() => onUpdateVisibility(varKey, code.code, visibility === 'visible' ? 'hidden' : 'visible')}
            className={`p-0.5 rounded ${visibility === 'visible' ? 'text-emerald-600' : 'text-zinc-400'}`}
            title={visibility === 'visible' ? 'Visible' : 'Hidden'}
          >
            {visibility === 'visible' ? <EyeIcon /> : <EyeOffIcon />}
          </button>
          {/* Remove button */}
          <button
            onClick={() => onUpdateVisibility(varKey, code.code, visibility === 'removed' ? 'visible' : 'removed')}
            className={`p-0.5 rounded ${visibility === 'removed' ? 'text-red-600' : 'text-zinc-400'}`}
            title={visibility === 'removed' ? 'Removed' : 'Remove'}
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  );
};

export const VariableEditPanel: React.FC<VariableEditPanelProps> = ({
  variableKey,
  variable,
  variables,
  onClose,
  onUpdateLabel,
  onUpdateDisplayName,
  onUpdateCodeLabel,
  onUpdateCodeVisibility,
  onUpdateCodeFactor,
  onUpdateCodeSyntax,
  onUpdateNetCode,
  onReorderCodes,
  onAddNetCode,
  onAddCode,
  onToggleVariableStat,
}) => {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [showNetInput, setShowNetInput] = useState(false);
  const [netLabel, setNetLabel] = useState('');
  const [showAddCode, setShowAddCode] = useState(false);
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [newCodeSyntax, setNewCodeSyntax] = useState('');
  const [showSyntaxBuilder, setShowSyntaxBuilder] = useState(false);
  const [editingCode, setEditingCode] = useState<VariableCode | null>(null);
  const [editingSyntax, setEditingSyntax] = useState('');

  // Copy/Paste labels & factors state
  const [copiedLabels, setCopiedLabels] = useState<{code: string; label: string; factor: number | null}[] | null>(null);

  const handleCopyLabels = useCallback(() => {
    const labelsToCopy = variable.codes
      .filter((c) => c.visibility !== 'removed')
      .map((c) => ({ code: c.code, label: c.label || '', factor: c.factor ?? null }));
    setCopiedLabels(labelsToCopy);
  }, [variable.codes]);

  const handlePasteLabels = useCallback(() => {
    if (!copiedLabels || copiedLabels.length === 0) return;
    
    // Match codes by code value and apply labels/factors
    copiedLabels.forEach((copied) => {
      const targetCode = variable.codes.find((c) => c.code === copied.code);
      if (targetCode) {
        onUpdateCodeLabel(variableKey, copied.code, copied.label);
        onUpdateCodeFactor(variableKey, copied.code, copied.factor);
      }
    });
  }, [copiedLabels, variable.codes, variableKey, onUpdateCodeLabel, onUpdateCodeFactor]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = variable.codes.findIndex((c) => c.code === active.id);
      const newIndex = variable.codes.findIndex((c) => c.code === over?.id);
      const newCodes = arrayMove(variable.codes, oldIndex, newIndex);
      onReorderCodes(variableKey, newCodes.map((c) => c.code));
    }
  }, [variable.codes, variableKey, onReorderCodes]);

  const toggleCodeSelection = useCallback((code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  const handleCreateNet = useCallback(() => {
    if (selectedCodes.length >= 2 && netLabel.trim()) {
      onAddNetCode(variableKey, selectedCodes, netLabel.trim());
      setSelectedCodes([]);
      setNetLabel('');
      setShowNetInput(false);
    }
  }, [selectedCodes, netLabel, variableKey, onAddNetCode]);

  const handleAddNewCode = useCallback(() => {
    if (onAddCode && newCodeLabel.trim() && newCodeSyntax.trim()) {
      onAddCode(variableKey, newCodeLabel.trim(), newCodeSyntax.trim());
      setNewCodeLabel('');
      setNewCodeSyntax('');
      setShowAddCode(false);
    }
  }, [onAddCode, newCodeLabel, newCodeSyntax, variableKey]);

  const handleEditSyntax = useCallback((code: VariableCode, currentSyntax: string) => {
    setEditingCode(code);
    setEditingSyntax(currentSyntax);
    setShowSyntaxBuilder(true);
  }, []);

  const handleSaveSyntax = useCallback((syntax: string) => {
    if (editingCode) {
      if (editingCode.isNet && onUpdateNetCode) {
        onUpdateNetCode(variableKey, editingCode.code, syntax);
      } else {
        onUpdateCodeSyntax(variableKey, editingCode.code, syntax);
      }
      setEditingCode(null);
      setEditingSyntax('');
    } else {
      // New code
      setNewCodeSyntax(syntax);
    }
    setShowSyntaxBuilder(false);
  }, [editingCode, variableKey, onUpdateCodeSyntax, onUpdateNetCode]);

  const handleOpenSyntaxForNewCode = useCallback(() => {
    setEditingCode(null);
    setEditingSyntax(newCodeSyntax);
    setShowSyntaxBuilder(true);
  }, [newCodeSyntax]);

  const visibleCodes = variable.codes.filter((c) => c.visibility !== 'removed');
  const canNet = selectedCodes.length >= 2;
  const varName = variable.name || variableKey;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 w-[750px] bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
              {variable.name || variableKey}
            </h2>
            <p className="text-xs text-zinc-500">
              {variable.type} • {variable.answerType === 'multiple_answer' ? 'Multiple Answer' : 'Single Answer'}
              {variable.codes.length > 0 && ` • ${variable.codes.length} codes`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Fixed Content - Variable Info & Statistics */}
        <div className="px-4 py-3 space-y-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          {/* Variable Info - Compact */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-0.5">
                Display Name
              </label>
              <input
                type="text"
                value={variable.name || ''}
                onChange={(e) => onUpdateDisplayName(variableKey, e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-0.5">
                Label / Definition
              </label>
              <input
                type="text"
                value={variable.label || ''}
                onChange={(e) => onUpdateLabel(variableKey, e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
              />
            </div>
          </div>

          {/* Statistics Section - Compact */}
          {onToggleVariableStat && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Stats:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onToggleVariableStat(variableKey, 'showMean')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    variable.showMean
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Mean
                </button>
                <button
                  onClick={() => onToggleVariableStat(variableKey, 'showStdError')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    variable.showStdError
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Std Error
                </button>
                <button
                  onClick={() => onToggleVariableStat(variableKey, 'showStdDev')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    variable.showStdDev
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Std Dev
                </button>
                <button
                  onClick={() => onToggleVariableStat(variableKey, 'showVariance')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    variable.showVariance
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  Variance
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Toolbar */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 shrink-0 flex items-center gap-2">
          {/* Netting button - appears when 2+ codes selected */}
          {canNet && !showNetInput && (
            <button
              onClick={() => setShowNetInput(true)}
              className="px-2.5 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded transition-colors flex items-center gap-1"
            >
              <PlusIcon />
              Net ({selectedCodes.length})
            </button>
          )}
          {/* Add new code button */}
          {!showAddCode && (
            <button
              onClick={() => setShowAddCode(true)}
              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded transition-colors flex items-center gap-1"
            >
              <PlusIcon />
              Code
            </button>
          )}
          
          <div className="flex-1" />
          
          {/* Copy/Paste Labels buttons */}
          <button
            onClick={handleCopyLabels}
            className="px-2.5 py-1.5 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition-colors flex items-center gap-1"
            title="Copy labels and factor scores"
          >
            <span>📋</span>
            Copy Labels
          </button>
          <button
            onClick={handlePasteLabels}
            disabled={!copiedLabels || copiedLabels.length === 0}
            className="px-2.5 py-1.5 bg-slate-500 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors flex items-center gap-1"
            title={copiedLabels ? `Paste ${copiedLabels.length} codes` : 'No labels copied'}
          >
            <span>📥</span>
            Paste Labels
            {copiedLabels && <span className="text-[10px] opacity-75">({copiedLabels.length})</span>}
          </button>
        </div>

        {/* Scrollable Codes Section */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Codes Header */}
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Codes</h3>
          </div>

          {/* Net Input */}
          {showNetInput && (
            <div className="mb-3 p-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap">
                  Label:
                </span>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. T2B"
                  value={netLabel}
                  onChange={(e) => setNetLabel(e.target.value)}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') handleCreateNet(); 
                    if (e.key === 'Escape') { setShowNetInput(false); setNetLabel(''); } 
                  }}
                  className="flex-1 text-xs px-2 py-1 border border-purple-300 dark:border-purple-700 rounded bg-white dark:bg-zinc-800"
                />
                <button 
                  onClick={handleCreateNet} 
                  disabled={!netLabel.trim()}
                  className="text-xs px-2.5 py-1 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white rounded"
                >
                  Create
                </button>
                <button 
                  onClick={() => { setShowNetInput(false); setNetLabel(''); }}
                  className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-700"
                >
                  ×
                </button>
              </div>
              <p className="text-[10px] text-purple-500 mt-1 truncate">
                Selected: {selectedCodes.join(', ')}
              </p>
            </div>
          )}

          {/* Add Code Input */}
          {showAddCode && (
            <div className="mb-3 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded space-y-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Label"
                  value={newCodeLabel}
                  onChange={(e) => setNewCodeLabel(e.target.value)}
                  className="flex-1 text-xs px-2 py-1 border border-emerald-300 dark:border-emerald-700 rounded bg-white dark:bg-zinc-800"
                />
                <div className="flex-1 flex gap-1">
                  <input
                    type="text"
                    placeholder="Syntax: Q1/1+Q1/2"
                    value={newCodeSyntax}
                    onChange={(e) => setNewCodeSyntax(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 border border-emerald-300 dark:border-emerald-700 rounded bg-white dark:bg-zinc-800 font-mono"
                  />
                  <button
                    onClick={handleOpenSyntaxForNewCode}
                    className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                  >
                    ...
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleAddNewCode}
                  disabled={!newCodeLabel.trim() || !newCodeSyntax.trim()}
                  className="text-xs px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded"
                >
                  Add
                </button>
                <button 
                  onClick={() => { setShowAddCode(false); setNewCodeLabel(''); setNewCodeSyntax(''); }}
                  className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Codes Table */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleCodes.map((c) => c.code)}
              strategy={verticalListSortingStrategy}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="px-1 py-1.5 w-6 text-center">☑</th>
                    <th className="px-1 py-1.5 w-6"></th>
                    <th className="px-1 py-1.5 w-12">Code</th>
                    <th className="px-1 py-1.5">Label</th>
                    <th className="px-1 py-1.5 w-32">Syntax</th>
                    <th className="px-1 py-1.5 w-16">Factor</th>
                    <th className="px-1 py-1.5 w-16 text-right">Act</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCodes.map((code) => (
                    <SortableCodeRow
                      key={code.code}
                      code={code}
                      varKey={variableKey}
                      varName={varName}
                      isSelected={selectedCodes.includes(code.code)}
                      onToggleSelect={toggleCodeSelection}
                      onUpdateLabel={onUpdateCodeLabel}
                      onUpdateVisibility={onUpdateCodeVisibility}
                      onUpdateFactor={onUpdateCodeFactor}
                      onEditSyntax={handleEditSyntax}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>

          {visibleCodes.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">
              No codes available
            </p>
          )}
        </div>
      </div>

      {/* Syntax Builder Modal */}
      {showSyntaxBuilder && (
        <SyntaxBuilderModal
          variables={variables}
          initialSyntax={editingSyntax}
          onSave={handleSaveSyntax}
          onClose={() => { setShowSyntaxBuilder(false); setEditingCode(null); }}
        />
      )}
    </>
  );
};
