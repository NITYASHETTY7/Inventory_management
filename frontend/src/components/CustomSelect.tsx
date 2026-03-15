import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
  formatLabel?: (o: string) => string;
  groupedOptions?: { groupName: string; items: string[] }[];
  icon?: React.ElementType;
}

export default function CustomSelect({ label, value, options, onChange, placeholder, formatLabel, groupedOptions, icon: Icon }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDisplayValue = () => {
    if (!value) return <span className="text-neutral-500">{placeholder}</span>;
    return formatLabel ? formatLabel(value) : value;
  };

  const OptionItem = ({ o }: { o: string }) => {
    const isSelected = value === o;
    return (
      <div 
        onClick={() => { onChange(o); setIsOpen(false); }}
        className={`px-3 py-2 cursor-pointer text-sm transition-all duration-200 ${
          isSelected 
            ? 'bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-amber-500/20 text-white font-medium border-l-2 border-amber-400' 
            : 'text-neutral-300 hover:bg-white/10 hover:text-white border-l-2 border-transparent hover:border-white/20'
        }`}
      >
        {formatLabel ? formatLabel(o) : o}
      </div>
    );
  };

  return (
    <div className={`relative ${isOpen ? "z-50" : "z-10"}`} ref={dropdownRef}>
      <label className="text-xs font-semibold tracking-wide text-neutral-400 mb-1.5 flex items-center gap-1.5 transition-colors group-hover:text-white">
        {Icon && <Icon size={14} className="text-neutral-500" />}
        {label}
      </label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#0A0A0A]/40 border border-white/10 rounded-lg p-2.5 text-sm flex justify-between items-center cursor-pointer hover:border-white/20 transition-all hover:bg-white/[0.03] shadow-inner text-white"
      >
        <span className="truncate pr-4">{getDisplayValue()}</span>
        <ChevronDown size={14} className={`text-neutral-500 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-white' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#0A0A0A]/95 border border-white/10 rounded-xl shadow-glass overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto custom-scrollbar">
          <div 
            onClick={() => { onChange(''); setIsOpen(false); }}
            className={`px-3 py-2.5 cursor-pointer text-sm italic transition-colors border-b border-white/5 ${!value ? 'text-amber-400 bg-amber-500/10' : 'text-neutral-500 hover:bg-white/5 hover:text-white'}`}
          >
            {placeholder}
          </div>
          
          {groupedOptions ? (
            groupedOptions.map(g => (
              <div key={g.groupName}>
                <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-neutral-500 uppercase bg-black/40 border-y border-white/5 sticky top-0 backdrop-blur-md">
                  {g.groupName}
                </div>
                {g.items.map(o => <OptionItem key={o} o={o} />)}
              </div>
            ))
          ) : (
            options.map(o => <OptionItem key={o} o={o} />)
          )}
        </div>
      )}
    </div>
  );
}
