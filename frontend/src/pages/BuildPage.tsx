import React, { useState } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, DragOverlay, useDroppable } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import { computeApi } from '../lib/api';
import { v4 as uuidv4 } from 'uuid';
import ResultTab from '../components/ResultTab';

interface DropZoneProps {
  id: string;
  label: string;
  items: { id: string; variable: string; codeDef: string }[];
  onRemove: (id: string) => void;
  orientation: 'horizontal' | 'vertical';
}

const DropZone: React.FC<DropZoneProps> = ({ id, label, items, onRemove, orientation }) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-4 transition-all duration-150 ${
        isOver ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-gray-300 bg-gray-50'
      } ${orientation === 'horizontal' ? 'min-h-[100px]' : 'min-h-[200px]'}`}
    >
      <div className="text-sm font-medium text-gray-500 mb-3">{label}</div>
      <div className={`flex gap-2 ${orientation === 'vertical' ? 'flex-col' : 'flex-wrap'}`}>
        {items.length === 0 ? (
          <div className="text-sm text-gray-400 italic">Drop variables here</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="group flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm">
              <span className="text-sm font-medium text-gray-700">{item.variable}</span>
              <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const BuildPage: React.FC = () => {
  const {
    activeTableId,
    tables,
    variables,
    addRowItem,
    addColItem,
    removeRowItem,
    removeColItem,
    setTableResult,
  } = useStore();

  const [isComputing, setIsComputing] = useState(false);
  const [localActiveTab, setLocalActiveTab] = useState<'build' | 'filter' | 'result'>('build');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !activeTableId) return;

    const variableName = String(active.id);
    const variableInfo = variables[variableName];
    if (!variableInfo) return;

    if (!variableInfo.codes || variableInfo.codes.length === 0) {
      alert(`Variable ${variableName} has no codes`);
      return;
    }

    const dropZone = String(over.id);
    const allCodes = variableInfo.codes.map(c => c.code).join(',');
    const item = { id: uuidv4(), variable: variableName, codeDef: allCodes };

    if (dropZone === 'row-zone') addRowItem(activeTableId, item);
    else if (dropZone === 'col-zone') addColItem(activeTableId, item);
  };

  const handleDragCancel = () => setActiveId(null);

  const activeTable = tables.find((t) => t.id === activeTableId);
  const activeVariable = activeId ? variables[activeId] : null;

  const expandCodes = (codeDef: string): string[] => {
    if (codeDef.includes('/')) {
      const [, codesPart] = codeDef.split('/', 2);
      return codesPart.split(',').map(c => c.trim()).filter(Boolean);
    }
    return codeDef.split(',').map(c => c.trim()).filter(Boolean);
  };

  const handleGenerate = async () => {
    if (!activeTable || activeTable.row_items.length === 0) {
      alert('Please add at least one item to Sidebreak');
      return;
    }

    setIsComputing(true);
    try {
      const result = await computeApi.crosstab({
        row_items: activeTable.row_items.map((item) => ({
          variable: item.variable,
          codeDef: `${item.variable}/${item.codeDef}`,
        })),
        col_items: activeTable.col_items.map((item) => ({
          variable: item.variable,
          codeDef: `${item.variable}/${item.codeDef}`,
        })),
        filter_def: activeTable.filter_def || undefined,
        weight_col: activeTable.weight_col || undefined,
      });

      if (activeTableId) setTableResult(activeTableId, result);
      setLocalActiveTab('result');
    } catch (error: any) {
      console.error('Failed to generate table:', error);
      alert(`Failed to generate table: ${error.message}`);
    } finally {
      setIsComputing(false);
    }
  };

  if (!activeTable) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Create a table first to start building</p>
      </div>
    );
  }

  const previewRows: string[] = [];
  activeTable.row_items.forEach(item => {
    expandCodes(item.codeDef).forEach(code => previewRows.push(`${item.variable}/${code}`));
  });

  const previewCols: string[] = [];
  activeTable.col_items.forEach(item => {
    expandCodes(item.codeDef).forEach(code => previewCols.push(`${item.variable}/${code}`));
  });

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full flex flex-col">
        {/* Tabs */}
        <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-200">
          {(['build', 'filter', 'result'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setLocalActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                localActiveTab === tab ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {localActiveTab === 'build' && (
            <div className="h-full flex flex-col gap-4">
              <DropZone id="col-zone" label="Header" items={activeTable.col_items} onRemove={(id) => removeColItem(activeTable.id, id)} orientation="horizontal" />
              <div className="flex-1 flex gap-4">
                <div className="w-40">
                  <DropZone id="row-zone" label="Sidebreak" items={activeTable.row_items} onRemove={(id) => removeRowItem(activeTable.id, id)} orientation="vertical" />
                </div>
                <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-auto">
                  {previewRows.length === 0 || previewCols.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-gray-400 text-sm">Add variables to Row and Column to see preview</span>
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700 w-32"></th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700 bg-gray-200 w-24">Total</th>
                          {previewCols.map((col) => <th key={col} className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700 w-24">{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-gray-50 font-medium">
                          <td className="border border-gray-300 px-3 py-2 text-gray-700">Base</td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-gray-700 bg-gray-100">—</td>
                          {previewCols.map((col) => <td key={`base-${col}`} className="border border-gray-300 px-3 py-2 text-center text-gray-700">—</td>)}
                        </tr>
                        {(() => {
                          const grouped: { [key: string]: string[] } = {};
                          previewRows.forEach((row) => {
                            const prefix = row.split('/')[0];
                            if (!grouped[prefix]) grouped[prefix] = [];
                            grouped[prefix].push(row);
                          });
                          return Object.entries(grouped).map(([prefix, codes]) => (
                            <React.Fragment key={prefix}>
                              {codes.map((row) => {
                                const codeLabel = row.split('/')[1] || row;
                                return (
                                  <tr key={row} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-3 py-2 text-gray-700 font-medium">{codeLabel}</td>
                                    <td className="border border-gray-300 px-3 py-2 text-center text-gray-400 bg-gray-50">—</td>
                                    {previewCols.map((col) => <td key={`${row}-${col}`} className="border border-gray-300 px-3 py-2 text-center text-gray-400">—</td>)}
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ));
                        })()}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleGenerate} disabled={isComputing} className="px-6 py-3 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                  {isComputing ? 'Generating...' : 'Generate Table'}
                </button>
              </div>
            </div>
          )}
          {localActiveTab === 'filter' && (
            <div className="h-full flex items-center justify-center text-gray-500">
              <p>Filter feature coming soon...</p>
            </div>
          )}
          {localActiveTab === 'result' && <ResultTab />}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeVariable ? (
          <div className="flex items-center justify-between p-3 rounded-md bg-green-50 border-2 border-green-400 shadow-2xl cursor-grabbing w-56 rotate-1">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-green-900">{activeId}</span>
              <span className="text-xs text-green-600">{activeVariable.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                {activeVariable.codes.length} codes
              </span>
              <span className="text-green-400 text-xs">⠿</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default BuildPage;
