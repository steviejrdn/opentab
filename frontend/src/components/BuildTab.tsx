import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import { computeApi } from '../lib/api';

interface DropZoneProps {
  id: string;
  label: string;
  items: { id: string; variable: string; codeDef: string }[];
  onRemove: (id: string) => void;
  orientation: 'horizontal' | 'vertical';
}

const DropZone: React.FC<DropZoneProps> = ({ id, label, items, onRemove, orientation }) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-4 transition-all ${
        isOver
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50'
      } ${orientation === 'horizontal' ? 'min-h-[100px]' : 'min-h-[200px]'}`}
    >
      <div className="text-sm font-medium text-gray-500 mb-3">{label}</div>

      <div className={`flex gap-2 ${orientation === 'vertical' ? 'flex-col' : 'flex-wrap'}`}>
        {items.length === 0 ? (
          <div className="text-sm text-gray-400 italic">
            Drop variables here
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm"
            >
              <span className="text-sm font-medium text-gray-700">
                {item.variable}
              </span>
              <button
                onClick={() => onRemove(item.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const BuildTab: React.FC = () => {
  const {
    activeTableId,
    tables,
    removeRowItem,
    removeColItem,
    setTableResult,
    setActiveTab,
    variables,
  } = useStore();

  const [isComputing, setIsComputing] = useState(false);

  const activeTable = tables.find((t) => t.id === activeTableId);

  if (!activeTable) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Create a table first to start building</p>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!activeTable || activeTable.row_items.length === 0) {
      alert('Please add at least one item to Sidebreak');
      return;
    }

    setIsComputing(true);
    
    // Debug: Log what's being sent
    const requestData = {
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
    };
    console.log('Sending request:', JSON.stringify(requestData, null, 2));
    
    try {
      const result = await computeApi.crosstab(requestData);

      if (activeTableId) setTableResult(activeTableId, result);
      setActiveTab('result');
    } catch (error: any) {
      console.error('Failed to generate table:', error);
      const errorMsg = error.response?.data?.detail || error.message;
      alert(`Failed to generate table: ${errorMsg}`);
    } finally {
      setIsComputing(false);
    }
  };

  // Helper to expand items into codes (same logic as backend)
  const expandCodes = (codeDef: string): string[] => {
    if (codeDef.includes('/')) {
      const [, codesPart] = codeDef.split('/', 2);
      return codesPart.split(',').map(c => c.trim()).filter(Boolean);
    }
    return codeDef.split(',').map(c => c.trim()).filter(Boolean);
  };

  const getCodeLabel = (rowOrColKey: string): string => {
    const parts = rowOrColKey.split('/');
    if (parts.length !== 2) return rowOrColKey;

    const [varName, code] = parts;
    const variable = variables[varName];
    if (!variable) return code;

    const codeObj = variable.codes.find((c) => c.code === code);
    return codeObj?.label || code;
  };

  // Generate preview rows and columns
  const previewRows: string[] = [];
  activeTable.row_items.forEach(item => {
    const codes = expandCodes(item.codeDef);
    codes.forEach(code => {
      previewRows.push(`${item.variable}/${code}`);
    });
  });

  const previewCols: string[] = [];
  activeTable.col_items.forEach(item => {
    const codes = expandCodes(item.codeDef);
    codes.forEach(code => {
      previewCols.push(`${item.variable}/${code}`);
    });
  });

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Column Drop Zone */}
      <DropZone
        id="col-zone"
        label="Header"
        items={activeTable.col_items}
        onRemove={(id) => removeColItem(activeTable.id, id)}
        orientation="horizontal"
      />

      {/* Row and Grid Area */}
      <div className="flex-1 flex gap-4">
        {/* Row Drop Zone */}
        <div className="w-40">
          <DropZone
            id="row-zone"
            label="Sidebreak"
            items={activeTable.row_items}
            onRemove={(id) => removeRowItem(activeTable.id, id)}
            orientation="vertical"
          />
        </div>

        {/* Table Preview - Match ResultTab Format */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-auto">
          {previewRows.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-gray-400 text-sm">
                Add variables to Sidebreak to see preview
              </span>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700 w-32">
                    
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700 bg-gray-200 w-24">
                    Total
                  </th>
                  {previewCols.map((col) => (
                    <th key={col} className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700 w-24">
                      {getCodeLabel(col)}
                    </th>
                  ))}

                </tr>
              </thead>
              <tbody>
                {/* Base Row */}
                <tr className="bg-gray-50 font-medium">
                  <td className="border border-gray-300 px-3 py-2 text-gray-700">Base</td>
                  <td className="border border-gray-300 px-3 py-2 text-center text-gray-700 bg-gray-100">—</td>
                  {previewCols.map((col) => (
                    <td key={`base-${col}`} className="border border-gray-300 px-3 py-2 text-center text-gray-700">—</td>
                  ))}
                </tr>

                {/* Group preview rows by variable prefix */}
                {(() => {
                  const grouped: { [key: string]: string[] } = {};
                  previewRows.forEach((row) => {
                    const prefix = row.split('/')[0];
                    if (!grouped[prefix]) grouped[prefix] = [];
                    grouped[prefix].push(row);
                  });

                  return Object.entries(grouped).map(([prefix, codes]) => (
                    <React.Fragment key={prefix}>
                      {/* Code rows */}
                      {codes.map((row) => {
                        const codeLabel = getCodeLabel(row);
                        return (
                          <tr key={row} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 text-gray-700 font-medium">
                              {codeLabel}
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-400 bg-gray-50">—</td>
                            {previewCols.map((col) => (
                              <td key={`${row}-${col}`} className="border border-gray-300 px-3 py-2 text-center text-gray-400">
                                —
                              </td>
                            ))}
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

      {/* Generate Button */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={isComputing}
          className="px-6 py-3 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isComputing ? 'Generating...' : 'Generate Table'}
        </button>
      </div>
    </div>
  );
};

export default BuildTab;
