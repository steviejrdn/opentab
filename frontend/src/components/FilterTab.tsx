import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import type { FilterCondition } from '../lib/api';

const CONDITION_LABELS: Record<FilterCondition, string> = {
  includes_any: 'includes any of',
  includes_none: 'includes none of',
  has_value: 'has a value',
  has_no_value: 'has no value',
};

const FilterTab: React.FC = () => {
  const { activeTableId, tables, variables, updateFilterItem, removeFilterItem } = useStore();
  const activeTable = tables.find((t) => t.id === activeTableId);

  const { isOver, setNodeRef } = useDroppable({ id: 'filter-zone' });

  if (!activeTable) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-sm">
        create a table first
      </div>
    );
  }

  const needsCodes = (condition: FilterCondition) =>
    condition === 'includes_any' || condition === 'includes_none';

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`border border-dashed px-4 py-3 transition-all ${
          isOver
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'
        }`}
      >
        <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">
          {isOver ? 'drop to add filter' : 'drop a variable here to add a filter'}
        </span>
      </div>

      {/* Filter Items */}
      {activeTable.filter_items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-xs">
          no filters — all respondents included
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1">
          {activeTable.filter_items.map((item) => {
            const varInfo = variables[item.variable];
            const showCodes = needsCodes(item.condition);
            const missingCodes = showCodes && item.selectedCodes.length === 0;

            return (
              <div
                key={item.id}
                className={`bg-zinc-50 dark:bg-zinc-900 border p-3 ${
                  missingCodes
                    ? 'border-amber-400 dark:border-amber-500/50'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-2.5">
                  <div>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{item.variable}</span>
                    {varInfo && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-600 ml-2">{varInfo.label}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeFilterItem(activeTable.id, item.id)}
                    className="text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 text-sm leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Condition Selector */}
                <select
                  value={item.condition}
                  onChange={(e) =>
                    updateFilterItem(activeTable.id, item.id, {
                      condition: e.target.value as FilterCondition,
                      selectedCodes: [],
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-1.5 mb-2.5"
                >
                  {(Object.keys(CONDITION_LABELS) as FilterCondition[]).map((c) => (
                    <option key={c} value={c}>
                      {CONDITION_LABELS[c]}
                    </option>
                  ))}
                </select>

                {/* Code Picker */}
                {showCodes && varInfo && (
                  <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 max-h-52 overflow-y-auto">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">
                        {missingCodes ? (
                          <span className="text-amber-600 dark:text-amber-500">select at least one</span>
                        ) : (
                          `${item.selectedCodes.length} selected`
                        )}
                      </span>
                      <div className="flex gap-3">
                        <button
                          onClick={() =>
                            updateFilterItem(activeTable.id, item.id, {
                              selectedCodes: varInfo.codes.map((c) => c.code),
                            })
                          }
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          all
                        </button>
                        <button
                          onClick={() =>
                            updateFilterItem(activeTable.id, item.id, { selectedCodes: [] })
                          }
                          className="text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400"
                        >
                          none
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {varInfo.codes.map((c) => (
                        <label
                          key={c.code}
                          className="flex items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 px-1 py-1"
                        >
                          <input
                            type="checkbox"
                            checked={item.selectedCodes.includes(c.code)}
                            onChange={(e) => {
                              const newCodes = e.target.checked
                                ? [...item.selectedCodes, c.code]
                                : item.selectedCodes.filter((sc) => sc !== c.code);
                              updateFilterItem(activeTable.id, item.id, { selectedCodes: newCodes });
                            }}
                            className="w-3.5 h-3.5 accent-blue-500"
                          />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            <span className="text-zinc-400 dark:text-zinc-600 mr-1">{c.code}</span>
                            {c.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {activeTable.filter_items.length > 1 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-700 text-center">
              all filters combined with AND logic
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterTab;
