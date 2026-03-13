import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function AsmDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedAsm, setExpandedAsm] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.getAsmData();
        setData(res || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load ASM data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        <span className="ml-3 text-neutral-400">Loading ASM mapping...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-transparent text-neutral-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-amber-500 tracking-tight">ASM Store Mapping</h2>
        <p className="text-sm text-neutral-400 mt-1">View stores and branches mapped under each Area Sales Manager.</p>
      </div>

      <div className="flex flex-col gap-3 max-w-5xl">
        {data.length === 0 ? (
          <div className="text-neutral-400 p-4 bg-[#0A0A0A]/60 rounded-xl border border-white/10">
            No ASM data available. Please ensure the ASM.xlsx file is present in the backend.
          </div>
        ) : (
          data.map((asmGroup, idx) => {
            const isExpanded = expandedAsm === asmGroup.asm;
            return (
              <div key={idx} className="bg-[#0A0A0A]/60 border border-white/10 rounded-xl overflow-hidden shadow-lg shadow-zinc-900/20 transition-all">
                <button
                  onClick={() => setExpandedAsm(isExpanded ? null : asmGroup.asm)}
                  className="w-full flex items-center justify-between p-4 bg-[#0A0A0A]/60 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold border border-amber-500/30">
                      {asmGroup.asm.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{asmGroup.asm}</h3>
                      <p className="text-xs text-neutral-400">{asmGroup.store_count} stores assigned</p>
                    </div>
                  </div>
                  <div className="text-neutral-400">
                    <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="p-4 bg-transparent border-t border-white/10">
                    <div className="overflow-x-auto rounded-lg border border-white/10">
                      <table className="w-full text-left text-sm text-neutral-300">
                        <thead className="bg-[#0A0A0A]/60 text-xs uppercase text-neutral-400 border-b border-white/5/50">
                          <tr>
                            <th className="px-4 py-3 font-medium">Branch</th>
                            <th className="px-4 py-3 font-medium">Short Name</th>
                            <th className="px-4 py-3 font-medium">Geography</th>
                            <th className="px-4 py-3 font-medium">District</th>
                            <th className="px-4 py-3 font-medium">Sales Head</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {asmGroup.branches.map((b: any, bIdx: number) => (
                            <tr key={bIdx} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-2.5 whitespace-nowrap">{b.branch || '-'}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">{b.short_name || '-'}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">{b.geography || '-'}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400">{b.district || '-'}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400">{b.sales_head || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
