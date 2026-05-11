'use client';
import { ReactNode } from 'react';

interface TabsProps {
  tabs: string[];
  activeTab: number;
  onChange: (index: number) => void;
  title?: string;
  subtitle?: string;
  tabSideContent?: ReactNode;
  afterTabsContent?: ReactNode;
  rightContent?: ReactNode;
}

export default function Tabs({
  tabs,
  activeTab,
  onChange,
  title,
  subtitle,
  tabSideContent,
  afterTabsContent,
  rightContent,
}: TabsProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 border-b border-slate-900/30 bg-[linear-gradient(135deg,#1f3d67_0%,#2a4b78_48%,#29446b_100%)] shadow-[0_12px_28px_rgba(16,32,61,0.28)]">
      <div className="flex min-h-[74px] items-center gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#ffd85a_0%,#f0b90c_100%)] text-xl font-black text-slate-900 shadow-sm">
            $
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-bold tracking-tight text-white">
              {title ?? tabs[activeTab]}
            </div>
            <div className="truncate text-[11px] text-slate-200/85">
              {subtitle ?? 'F&F financial simulation dashboard'}
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {tabSideContent}
          {afterTabsContent}
          {rightContent}
        </div>
      </div>
      {tabs.length > 1 && (
        <div className="flex items-center gap-2 border-t border-white/10 px-6 pb-3">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => onChange(index)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === index
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-white/10 text-slate-100 hover:bg-white/18'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
      {tabs.length === 1 && (
        <div className="h-1 bg-[linear-gradient(90deg,#f0b90c_0%,#ffd85a_24%,rgba(255,255,255,0)_78%)]" />
      )}
    </div>
  );
}


