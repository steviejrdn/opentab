import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useStore } from '../store/useStore';

interface DraggableVariableProps {
  name: string;
  label: string;
  type: string;
  codeCount: number;
}

const DraggableVariable: React.FC<DraggableVariableProps> = ({
  name,
  label,
  type,
  codeCount,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: name,
    data: { name, label, type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-between p-3 rounded-md cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? 'opacity-50 bg-blue-100 shadow-lg'
          : 'bg-green-50 border border-green-200 hover:border-green-300 hover:shadow-sm'
      }`}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-green-900">{name}</span>
        <span className="text-xs text-green-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
          {codeCount} codes
        </span>
        <span className="text-green-400 text-xs">⠿</span>
      </div>
    </div>
  );
};

const VariableList: React.FC = () => {
  const { variables, dataLoaded } = useStore();

  if (!dataLoaded) {
    return (
      <div className="flex flex-col h-full p-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Variables</h2>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Load data to see variables
        </div>
      </div>
    );
  }

  const variableEntries = Object.entries(variables);

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Variables</h2>
        <span className="text-xs text-gray-500">{variableEntries.length} items</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {variableEntries.map(([name, info]) => (
          <DraggableVariable
            key={name}
            name={name}
            label={info.label}
            type={info.type}
            codeCount={info.codes.length}
          />
        ))}
      </div>

      <div className="mt-2 text-xs text-gray-400 text-center">
        Drag variables to Row/Column zones
      </div>
    </div>
  );
};

export default VariableList;
