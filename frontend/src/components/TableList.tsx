import React, { useState, useRef, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { useStore } from '../store/useStore';
import type { Folder } from '../store/useStore';
import { tablesApi } from '../lib/api';
import type { Table } from '../lib/api';

interface DraggableTableRowProps {
  table: Table;
  isActive: boolean;
  onActivate: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
  folders: Folder[];
  onMoveToFolder: (folderId: string | null) => void;
}

const DraggableTableRow: React.FC<DraggableTableRowProps> = ({
  table, isActive, onActivate, onDelete, onRename, folders, onMoveToFolder,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `table-${table.id}`,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(table.name);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== table.name) onRename(trimmed);
    else setEditName(table.name);
    setIsEditing(false);
  };

  const otherFolders = folders.filter((f) => f.id !== table.folderId);

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-all ${
        isDragging ? 'opacity-40' : ''
      } ${
        isActive
          ? 'bg-blue-50 border border-blue-300 shadow-sm'
          : 'bg-white border border-gray-200 hover:border-gray-300'
      }`}
      onClick={onActivate}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          {...listeners}
          {...attributes}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </div>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`} />
        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setEditName(table.name); setIsEditing(false); }
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 outline-none"
          />
        ) : (
          <span
            className={`text-sm font-medium truncate ${isActive ? 'text-blue-900' : 'text-gray-700'}`}
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            {table.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="text-gray-400 hover:text-gray-600 px-1 text-xs leading-none"
            title="More options"
          >
            ⋮
          </button>
          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-5 z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 w-44 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              {otherFolders.map((f) => (
                <button
                  key={f.id}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
                  onClick={() => { onMoveToFolder(f.id); setShowMenu(false); }}
                >
                  Move to "{f.name}"
                </button>
              ))}
              {table.folderId && (
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
                  onClick={() => { onMoveToFolder(null); setShowMenu(false); }}
                >
                  Remove from folder
                </button>
              )}
              {otherFolders.length === 0 && !table.folderId && (
                <div className="px-3 py-1.5 text-gray-400 italic">No folders yet</div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 transition-colors px-1 text-xs"
          title="Delete table"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

interface FolderItemProps {
  folder: Folder;
  tables: Table[];
  activeTableId: string | null;
  onActivate: (id: string) => void;
  onDeleteTable: (id: string, e: React.MouseEvent) => void;
  onRenameTable: (id: string, name: string) => void;
  onMoveTable: (tableId: string, folderId: string | null) => void;
  onToggle: () => void;
  onRenameFolder: (name: string) => void;
  onDeleteFolder: () => void;
  allFolders: Folder[];
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder, tables, activeTableId, onActivate, onDeleteTable, onRenameTable,
  onMoveTable, onToggle, onRenameFolder, onDeleteFolder, allFolders,
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: `folder-${folder.id}` });
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) onRenameFolder(trimmed);
    else setEditName(folder.name);
    setIsEditing(false);
  };

  return (
    <div className="rounded-md overflow-visible">
      <div
        ref={setNodeRef}
        className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-all rounded-md ${
          isOver
            ? 'bg-blue-100 border border-blue-400'
            : 'bg-gray-100 border border-gray-200 hover:border-gray-300'
        }`}
        onClick={onToggle}
      >
        <span className="text-gray-500 text-xs w-3 text-center">{folder.isOpen ? '▾' : '▸'}</span>
        <span className="text-xs">📁</span>
        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setEditName(folder.name); setIsEditing(false); }
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium flex-1 bg-white border border-blue-400 rounded px-1 outline-none"
          />
        ) : (
          <span
            className="text-sm font-medium text-gray-700 flex-1 truncate"
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            {folder.name}
          </span>
        )}
        <span className="text-xs text-gray-400">{tables.length}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteFolder(); }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity text-xs ml-1"
          title="Delete folder"
        >
          ✕
        </button>
      </div>

      {folder.isOpen && (
        <div className="ml-4 mt-1 space-y-1">
          {tables.length === 0 ? (
            <div className={`text-xs text-gray-400 italic px-3 py-2 rounded border border-dashed transition-colors ${isOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
              Drag tables here
            </div>
          ) : (
            tables.map((table) => (
              <DraggableTableRow
                key={table.id}
                table={table}
                isActive={activeTableId === table.id}
                onActivate={() => onActivate(table.id)}
                onDelete={(e) => onDeleteTable(table.id, e)}
                onRename={(name) => onRenameTable(table.id, name)}
                folders={allFolders.filter((f) => f.id !== folder.id)}
                onMoveToFolder={(fid) => onMoveTable(table.id, fid)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const RootDroppable: React.FC<{ children: React.ReactNode; hasItems: boolean }> = ({ children, hasItems }) => {
  const { isOver, setNodeRef } = useDroppable({ id: 'folder-root' });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-1 rounded-md transition-colors min-h-[4px] ${isOver && !hasItems ? 'bg-blue-50 ring-1 ring-blue-300 p-1' : ''}`}
    >
      {children}
    </div>
  );
};

const TableList: React.FC = () => {
  const {
    tables, activeTableId, folders,
    addTable, setActiveTable, deleteTable, updateTable,
    addFolder, deleteFolder, renameFolder, toggleFolder,
  } = useStore();

  const handleCreateTable = async () => {
    try {
      const newTable = await tablesApi.create(`Table ${tables.length + 1}`);
      addTable(newTable);
      setActiveTable(newTable.id);
    } catch (error) {
      console.error('Failed to create table:', error);
    }
  };

  const handleDeleteTable = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await tablesApi.delete(id);
      deleteTable(id);
    } catch (error) {
      console.error('Failed to delete table:', error);
    }
  };

  const handleRenameTable = (id: string, name: string) => {
    updateTable(id, { name });
  };

  const handleMoveTable = (tableId: string, folderId: string | null) => {
    updateTable(tableId, { folderId });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const tableId = String(active.id).replace('table-', '');
    const overId = String(over.id);
    if (overId === 'folder-root') handleMoveTable(tableId, null);
    else if (overId.startsWith('folder-')) handleMoveTable(tableId, overId.replace('folder-', ''));
  };

  const ungroupedTables = tables.filter((t) => !t.folderId);
  const total = tables.length + folders.length;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full p-3">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Tables</h2>
          <span className="text-xs text-gray-500">{total} items</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              tables={tables.filter((t) => t.folderId === folder.id)}
              activeTableId={activeTableId}
              onActivate={setActiveTable}
              onDeleteTable={handleDeleteTable}
              onRenameTable={handleRenameTable}
              onMoveTable={handleMoveTable}
              onToggle={() => toggleFolder(folder.id)}
              onRenameFolder={(name) => renameFolder(folder.id, name)}
              onDeleteFolder={() => deleteFolder(folder.id)}
              allFolders={folders}
            />
          ))}

          <RootDroppable hasItems={ungroupedTables.length > 0}>
            {ungroupedTables.map((table) => (
              <DraggableTableRow
                key={table.id}
                table={table}
                isActive={activeTableId === table.id}
                onActivate={() => setActiveTable(table.id)}
                onDelete={(e) => handleDeleteTable(table.id, e)}
                onRename={(name) => handleRenameTable(table.id, name)}
                folders={folders}
                onMoveToFolder={(fid) => handleMoveTable(table.id, fid)}
              />
            ))}
          </RootDroppable>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleCreateTable}
            className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 text-sm hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            + Table
          </button>
          <button
            onClick={() => addFolder(`Folder ${folders.length + 1}`)}
            className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 text-sm hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            + Folder
          </button>
        </div>
      </div>
    </DndContext>
  );
};

export default TableList;
