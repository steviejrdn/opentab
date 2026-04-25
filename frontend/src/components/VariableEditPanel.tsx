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
  onClose: () => void;
  onUpdateLabel: (varName: string, label: string) => void;
  onUpdateDisplayName: (varName: string, displayName: string) => void;
  onUpdateCodeLabel: (varName: string, code: string, label: string) => void;
  onUpdateCodeVisibility: (varName: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  onUpdateCodeFactor: (varName: string, code: string, factor: number | null) => void;
  onReorderCodes: (varName: string, orderedCodes: string[]) => void;
  onAddNetCode: (varName: string, netOf: string[], label: string) => void;
  onAddCode?: (varName: string, label: string, syntax: string) => void;
}

interface SortableCodeRowProps {
  code: VariableCode;
  varKey: string;
  isSelected: boolean;
  onToggleSelect: (code: string) => void;
  onUpdateLabel: (varName: string, code: string, label: string) => void;
  onUpdateVisibility: (varName: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  onUpdateFactor: (varName: string, code: string, factor: number | null) => void;
  onEdit?: (code: VariableCode) => void;
}

const SortableCodeRow: React.FC<SortableCodeRowProps> = ({
  code,
  varKey,
  isSelected,
  onToggleSelect,
  onUpdateLabel,
  onUpdateVisibility,
  onUpdateFactor,
  onEdit,
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

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${isRemoved ? 'opacity-40 bg-red-50' : ''} ${isHidden ? 'opacity-60' : ''}`}
    >
      {/* Checkbox for netting */}
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(code.code)}
          className="cursor-pointer w-4 h-4"
        />
      </td>
      {/* Drag handle */}
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600"
        >
          <GripIcon />
        </button>
      </td>
      {/* Code */}
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700 font-mono text-sm">
        {code.code}
      </td>
      {/* Label */}
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <input
          type="text"
          value={code.label || ''}
          onChange={(e) => onUpdateLabel(varKey, code.code, e.target.value)}
          className="w-full text-sm bg-transparent border border-zinc-300 dark:border-zinc-600 px-2 py-1 rounded"
          placeholder="Label"
        />
      </td>
      {/* Factor */}
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <input
          type="number"
          value={code.factor ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onUpdateFactor(varKey, code.code, val ? parseFloat(val) : null);
          }}
          placeholder="Factor"
          className="w-20 text-sm bg-transparent border border-zinc-300 dark:border-zinc-600 px-2 py-1 rounded"
        />
      </td>
      {/* Actions */}
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-1">
          {/* Edit button */}
          {onEdit && (
            <button
              onClick={() => onEdit(code)}
              className="p-1 rounded text-zinc-400 hover:text-blue-600"
              title="Edit code"
            >
              <EditIcon />
            </button>
          )}
          {/* Visibility toggle */}
          <button
            onClick={() => onUpdateVisibility(varKey, code.code, visibility === 'visible' ? 'hidden' : 'visible')}
            className={`p-1 rounded ${visibility === 'visible' ? 'text-emerald-600' : 'text-zinc-400'}`}
            title={visibility === 'visible' ? 'Visible' : 'Hidden'}
          >
            {visibility === 'visible' ? <EyeIcon /> : <EyeOffIcon />}
          </button>
          {/* Remove button */}
          <button
            onClick={() => onUpdateVisibility(varKey, code.code, visibility === 'removed' ? 'visible' : 'removed')}
            className={`p-1 rounded ${visibility === 'removed' ? 'text-red-600' : 'text-zinc-400'}`}
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
  onClose,
  onUpdateLabel,
  onUpdateDisplayName,
  onUpdateCodeLabel,
  onUpdateCodeVisibility,
  onUpdateCodeFactor,
  onReorderCodes,
  onAddNetCode,
  onAddCode,
}) => {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [showNetInput, setShowNetInput] = useState(false);
  const [netLabel, setNetLabel] = useState('');
  const [showAddCode, setShowAddCode] = useState(false);
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [newCodeSyntax, setNewCodeSyntax] = useState('');

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

  const visibleCodes = variable.codes.filter((c) => c.visibility !== 'removed');
  const hiddenCount = variable.codes.filter((c) => c.visibility === 'hidden').length;
  const removedCount = variable.codes.filter((c) => c.visibility === 'removed').length;
  const canNet = selectedCodes.length >= 2;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 w-[650px] bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              {variable.name || variableKey}
            </h2>
            <p className="text-sm text-zinc-500">
              {variable.type} • {variable.answerType === 'multiple_answer' ? 'Multiple Answer' : 'Single Answer'}
              {variable.codes.length > 0 && ` • ${variable.codes.length} codes`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Variable Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={variable.name || ''}
                onChange={(e) => onUpdateDisplayName(variableKey, e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Label / Definition
              </label>
              <input
                type="text"
                value={variable.label || ''}
                onChange={(e) => onUpdateLabel(variableKey, e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800"
              />
            </div>
          </div>

          {/* Codes Section */}
          <div>
            {/* Codes Header with Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Codes
                {(hiddenCount > 0 || removedCount > 0) && (
                  <span className="ml-2 text-xs font-normal text-orange-500">
                    {hiddenCount > 0 && `${hiddenCount} hidden`}
                    {hiddenCount > 0 && removedCount > 0 && ', '}
                    {removedCount > 0 && `${removedCount} removed`}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {/* Netting button - appears when 2+ codes selected */}
                {canNet && !showNetInput && (
                  <button
                    onClick={() => setShowNetInput(true)}
                    className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors flex items-center gap-1"
                  >
                    <PlusIcon />
                    Netting ({selectedCodes.length})
                  </button>
                )}
                {/* Add new code button */}
                {!showAddCode && (
                  <button
                    onClick={() => setShowAddCode(true)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg transition-colors flex items-center gap-1"
                  >
                    <PlusIcon />
                    New Code
                  </button>
                )}
              </div>
            </div>

            {/* Net Input */}
            {showNetInput && (
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                    Net label:
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
                    className="flex-1 text-xs px-2 py-1.5 border border-purple-300 dark:border-purple-700 rounded bg-white dark:bg-zinc-800"
                  />
                  <button 
                    onClick={handleCreateNet} 
                    disabled={!netLabel.trim()}
                    className="text-xs px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white rounded"
                  >
                    Create
                  </button>
                  <button 
                    onClick={() => { setShowNetInput(false); setNetLabel(''); }}
                    className="text-xs px-3 py-1.5 text-zinc-500 hover:text-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-[10px] text-purple-500 mt-1">
                  Selected: {selectedCodes.join(', ')}
                </p>
              </div>
            )}

            {/* Add Code Input */}
            {showAddCode && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-2">
                <div>
                  <label className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Label</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Code label"
                    value={newCodeLabel}
                    onChange={(e) => setNewCodeLabel(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-emerald-300 dark:border-emerald-700 rounded bg-white dark:bg-zinc-800 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Syntax</label>
                  <input
                    type="text"
                    placeholder="e.g. Q1/1+Q1/2"
                    value={newCodeSyntax}
                    onChange={(e) => setNewCodeSyntax(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-emerald-300 dark:border-emerald-700 rounded bg-white dark:bg-zinc-800 mt-1 font-mono"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={handleAddNewCode}
                    disabled={!newCodeLabel.trim() || !newCodeSyntax.trim()}
                    className="text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded"
                  >
                    Add
                  </button>
                  <button 
                    onClick={() => { setShowAddCode(false); setNewCodeLabel(''); setNewCodeSyntax(''); }}
                    className="text-xs px-3 py-1.5 text-zinc-500 hover:text-zinc-700"
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                      <th className="px-2 py-2 w-8 text-center">☑</th>
                      <th className="px-2 py-2 w-8"></th>
                      <th className="px-2 py-2 w-16">Code</th>
                      <th className="px-2 py-2">Label</th>
                      <th className="px-2 py-2 w-24">Factor</th>
                      <th className="px-2 py-2 w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCodes.map((code) => (
                      <SortableCodeRow
                        key={code.code}
                        code={code}
                        varKey={variableKey}
                        isSelected={selectedCodes.includes(code.code)}
                        onToggleSelect={toggleCodeSelection}
                        onUpdateLabel={onUpdateCodeLabel}
                        onUpdateVisibility={onUpdateCodeVisibility}
                        onUpdateFactor={onUpdateCodeFactor}
                        onEdit={(c) => console.log('Edit code:', c)}
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
      </div>
    </>
  );
};
