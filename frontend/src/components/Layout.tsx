import React from 'react';
import TableList from './TableList';
import VariableList from './VariableList';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Panel */}
      <div className="w-72 bg-slate-50 border-r border-gray-200 flex flex-col">
        {/* Tables Section */}
        <div className="h-1/2 flex flex-col border-b border-gray-200">
          <TableList />
        </div>

        {/* Variables Section */}
        <div className="h-1/2 flex flex-col">
          <VariableList />
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col bg-white">
        {children}
      </div>
    </div>
  );
};

export default Layout;
