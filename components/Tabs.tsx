'use client';
import { ReactNode } from 'react';

interface TabsProps {
  tabs: string[];
  activeTab: number;
  onChange: (index: number) => void;
  tabSideContent?: ReactNode;
  afterTabsContent?: ReactNode;
  rightContent?: ReactNode;
}

export default function Tabs({ tabs, activeTab, onChange, tabSideContent, afterTabsContent, rightContent }: TabsProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-navy shadow-md">
      <div className="flex items-center border-b border-gray-700">
        <div className="flex">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => onChange(index)}
              className={`
                w-[220px] px-6 py-4 text-sm font-medium transition-colors relative text-center
                ${activeTab === index
                  ? 'text-white'
                  : 'text-gray-300 hover:text-white'}
              `}
            >
              {tab}
              {activeTab === index && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent-yellow" />
              )}
            </button>
          ))}
        </div>
        {tabSideContent && <div className="pl-3 flex-shrink-0">{tabSideContent}</div>}
        {afterTabsContent && <div className="pl-3">{afterTabsContent}</div>}
        {rightContent && <div className="ml-auto pr-6">{rightContent}</div>}
      </div>
    </div>
  );
}


