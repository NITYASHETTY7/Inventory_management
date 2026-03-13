import { useState, useRef, useEffect } from 'react';

export default function DropdownTab({ 
  label, 
  active, 
  options 
}: { 
  label: string; 
  active: boolean; 
  options: { id: string; label: string; badge?: string; onClick: () => void }[];
}) {
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
          active ? 'bg-white/5 text-white shadow-inner' : 'text-neutral-400 hover:text-neutral-300 hover:bg-white/5'
        }`}
      >
        {label}
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#0A0A0A]/60 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                opt.onClick();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white transition-colors flex justify-between items-center"
            >
              {opt.label}
              {opt.badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">{opt.badge}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
