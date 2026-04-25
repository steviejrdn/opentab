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
}

interface SortableCodeRowProps {
  code: VariableCode;
  varKey: string;
  onUpdateLabel: (varName: string, code: string, label: string) => void;
  onUpdateVisibility: (varName: string, code: string, visibility: 'visible' | 'hidden' | 'removed') => void;
  onUpdateFactor: (varName: string, code: string, factor: number | null) => void;
}

const SortableCodeRow: React.FC<SortableCodeRowProps> = ({
  code,
  varKey,
  onUpdateLabel,
  onUpdateVisibility,
  onUpdateFactor,
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
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600"
        >
          <GripIcon />
        </button>
      </td>
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700 font-mono text-sm">
        {code.code}
      </td>
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <input
          type="text"
          value={code.label || ''}
          onChange={(e) => onUpdateLabel(varKey, code.code, e.target.value)}
          className="w-full text-sm bg-transparent border border-zinc-300 dark:border-zinc-600 px-2 py-1 rounded"
          placeholder="Label"
        />
      </td>
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
      <td className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdateVisibility(varKey, code.code, visibility === 'visible' ? 'hidden' : 'visible')}
            className={`p-1 rounded ${visibility === 'visible' ? 'text-emerald-600' : 'text-zinc-400'}`}
            title={visibility === 'visible' ? 'Visible' : 'Hidden'}
          >
            {visibility === 'visible' ? <EyeIcon /> : <EyeOffIcon />}
          </button>
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
}) => {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [netLabel, setNetLabel] = useState('');

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

  const handleAddNet = useCallback(() => {
    if (selectedCodes.length >= 2 && netLabel.trim()) {
      onAddNetCode(variableKey, selectedCodes, netLabel.trim());
      setSelectedCodes([]);
      setNetLabel('');
    }
  }, [selectedCodes, netLabel, variableKey, onAddNetCode]);

  const toggleCodeSelection = useCallback((code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  const visibleCodes = variable.codes.filter((c) => c.visibility !== 'removed');
  const hiddenCount = variable.codes.filter((c) => c.visibility === 'hidden').length;
  const removedCount = variable.codes.filter((c) => c.visibility === 'removed').length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 w-[600px] bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col animate-slide-in-right">
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
            </div>

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
                      <th className="px-2 py-2 w-8"></th>
                      <th className="px-2 py-2 w-16">Code</th>
                      <th className="px-2 py-2">Label</th>
                      <th className="px-2 py-2 w-24">Factor</th>
                      <th className="px-2 py-2 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCodes.map((code) => (
                      <SortableCodeRow
                        key={code.code}
                        code={code}
                        varKey={variableKey}
                        onUpdateLabel={onUpdateCodeLabel}
                        onUpdateVisibility={onUpdateCodeVisibility}
                        onUpdateFactor={onUpdateCodeFactor}
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

          {/* Add Net Code Section */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              Create Net Code
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              Select 2 or more codes to combine into a net
            </p>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {variable.codes
                  .filter((c) => c.visibility !== 'removed' && !c.isNet)
                  .map((code) => (
                    <button
                      key={code.code}
                      onClick={() => toggleCodeSelection(code.code)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedCodes.includes(code.code)
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                          : 'bg-white border-zinc-300 text-zinc-600 hover:border-zinc-400'
                      }`}
                    >
                      {code.code}
                    </button>
                  ))}
              </div>

              {selectedCodes.length >= 2 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={netLabel}
                    onChange={(e) => setNetLabel(e.target.value)}
                    placeholder="Net code label"
                    className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg"
                  />
                  <button
                    onClick={handleAddNet}
                    disabled={!netLabel.trim()}
                    className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <PlusIcon />
                    Create Net
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
