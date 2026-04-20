import React from 'react';
import { useStore } from '../store/useStore';

const ResultTab: React.FC = () => {
  const {
    activeTableId,
    tables,
    displayOptions,
    setDisplayOptions,
    variables,
  } = useStore();

  const activeTable = tables.find((t) => t.id === activeTableId);
  const result = activeTable?.result;

  if (!activeTable) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Create a table first to see results</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No results yet</p>
          <p className="text-sm">Go to Build tab and click Generate Table</p>
        </div>
      </div>
    );
  }

  const rowNames = Object.keys(result.counts).filter((k) => k !== 'Total');
  const colNames = Object.keys(result.counts[rowNames[0] || 'Total'] || {}).filter((k) => k !== 'Total');

  // Get variable labels from the table items
  const getRowVarLabel = () => {
    if (activeTable.row_items.length > 0) {
      const varName = activeTable.row_items[0].variable;
      return variables[varName]?.label || varName;
    }
    return 'Row';
  };

  const getColVarLabel = () => {
    if (activeTable.col_items.length > 0) {
      const varName = activeTable.col_items[0].variable;
      return variables[varName]?.label || varName;
    }
    return 'Column';
  };

  const rowVarLabel = getRowVarLabel();
  const colVarLabel = getColVarLabel();

  const formatPct = (val: number) => {
    const pct = val.toFixed(displayOptions.decimalPlaces);
    return displayOptions.showPctSign ? `${pct}%` : pct;
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

  const handleCopyTSV = () => {
    const lines: string[] = [];
    const header = ['', 'Total', ...colNames.map(c => getCodeLabel(c))].join('\t');
    lines.push(header);

    const baseRow = ['Base', String(result.counts['Total']?.['Total'] ?? result.base), ...colNames.map(c => String(result.counts['Total']?.[c] ?? 0))].join('\t');
    lines.push(baseRow);

    rowNames.forEach((row) => {
      const rowTotal = result.counts[row]?.['Total'] ?? 0;
      const rowLabel = getCodeLabel(row);
      const rowData = [rowLabel, String(rowTotal), ...colNames.map(c => String(result.counts[row]?.[c] ?? 0))];
      lines.push(rowData.join('\t'));

      if (displayOptions.colPct) {
        const pctRow = ['', formatPct(result.col_pct[row]?.['Total'] ?? 0), ...colNames.map(c => formatPct(result.col_pct[row]?.[c] ?? 0))];
        lines.push(pctRow.join('\t'));
      }
    });

    navigator.clipboard.writeText(lines.join('\n'));
    alert('Table copied to clipboard!');
  };

  // Group rows by variable prefix
  const groupedRows: { [key: string]: string[] } = {};
  rowNames.forEach((row) => {
    const prefix = row.split('/')[0];
    if (!groupedRows[prefix]) groupedRows[prefix] = [];
    groupedRows[prefix].push(row);
  });

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Display Options */}
      <div className="flex flex-wrap gap-6 items-center bg-gray-50 p-3 rounded-md">
        <span className="text-sm font-medium text-gray-700">Display:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={displayOptions.counts}
            onChange={(e) => setDisplayOptions({ counts: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Counts</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={displayOptions.colPct}
            onChange={(e) => setDisplayOptions({ colPct: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">%</span>
        </label>

        {displayOptions.colPct && (
          <>
            <label className="flex items-center gap-2 cursor-pointer ml-4 pl-4 border-l border-gray-300">
              <input
                type="checkbox"
                checked={displayOptions.showPctSign}
                onChange={(e) => setDisplayOptions({ showPctSign: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show % sign</span>
            </label>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm text-gray-600">Decimals:</span>
              <select
                value={displayOptions.decimalPlaces}
                onChange={(e) => setDisplayOptions({ decimalPlaces: parseInt(e.target.value) })}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          </>
        )}

        <div className="ml-auto">
          <button
            onClick={handleCopyTSV}
            className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Copy Table
          </button>
        </div>
      </div>

      <div className="space-y-1 text-sm text-gray-700">
        <p><strong>Row:</strong> {rowVarLabel}</p>
        <p><strong>Column:</strong> {colVarLabel}</p>
        <p><strong>Base:</strong> {result.base}</p>
      </div>

      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700 w-32"></th>
              <th className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700 bg-gray-200 w-24">Total</th>
              {colNames.map((col) => (
                <th key={col} className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700 w-24">{getCodeLabel(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Base Row */}
            <tr className="bg-gray-50 font-medium">
              <td className="border border-gray-300 px-3 py-2 text-gray-700">Base</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-gray-700 bg-gray-100">{result.counts['Total']?.['Total'] ?? result.base}</td>
              {colNames.map((col) => (
                <td key={`base-${col}`} className="border border-gray-300 px-3 py-2 text-center text-gray-700">{result.counts['Total']?.[col] ?? 0}</td>
              ))}
            </tr>

            {/* Data Rows */}
            {Object.entries(groupedRows).map(([prefix, codes]) => (
              <React.Fragment key={prefix}>
                {/* Code rows */}
                {codes.map((row) => {
                  const codeLabel = getCodeLabel(row);
                  const rowTotal = result.counts[row]?.['Total'] ?? 0;
                  
                  if (displayOptions.counts && displayOptions.colPct) {
                    return (
                      <React.Fragment key={row}>
                        <tr className="hover:bg-gray-50">
                          <td 
                            rowSpan={2}
                            className="border border-gray-300 px-3 py-1 text-gray-700 font-medium align-middle"
                          >
                            {codeLabel}
                          </td>
                          <td className="border border-gray-300 px-3 py-1 text-center text-gray-700 font-medium bg-gray-50">{rowTotal}</td>
                          {colNames.map((col) => (
                            <td key={`count-${col}`} className="border border-gray-300 px-3 py-1 text-center text-gray-700">{result.counts[row]?.[col] ?? 0}</td>
                          ))}
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-3 py-1 text-center text-gray-500 bg-gray-50">{formatPct(result.col_pct[row]?.['Total'] ?? 0)}</td>
                          {colNames.map((col) => (
                            <td key={`pct-${col}`} className="border border-gray-300 px-3 py-1 text-center text-gray-500">{formatPct(result.col_pct[row]?.[col] ?? 0)}</td>
                          ))}
                        </tr>
                      </React.Fragment>
                    );
                  } else if (displayOptions.counts) {
                    return (
                      <tr key={row} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 text-gray-700 font-medium">{codeLabel}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center text-gray-700 font-medium bg-gray-50">{rowTotal}</td>
                        {colNames.map((col) => (
                          <td key={col} className="border border-gray-300 px-3 py-2 text-center text-gray-700">{result.counts[row]?.[col] ?? 0}</td>
                        ))}
                      </tr>
                    );
                  } else if (displayOptions.colPct) {
                    return (
                      <tr key={row} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 text-gray-700 font-medium">{codeLabel}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center text-gray-700 font-medium bg-gray-50">{formatPct(result.col_pct[row]?.['Total'] ?? 0)}</td>
                        {colNames.map((col) => (
                          <td key={col} className="border border-gray-300 px-3 py-2 text-center text-gray-700">{formatPct(result.col_pct[row]?.[col] ?? 0)}</td>
                        ))}
                      </tr>
                    );
                  }
                  return null;
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultTab;
