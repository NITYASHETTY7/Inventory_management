import React, { useState, useMemo } from "react";
import { OtbRow } from "../types/otb_types";

interface OtbTableProps {
  rows: OtbRow[];
  onRowClick?: (row: OtbRow) => void;
  selectedImCode?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: string) => void;
  searchQuery?: string;
}

export const OtbTable: React.FC<OtbTableProps> = ({
  rows,
  onRowClick,
  selectedImCode,
  sortKey = "effective_otb",
  sortDir = "desc",
  onSortChange,
  searchQuery = "",
}) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (e: React.MouseEvent, imCode: string, row: OtbRow) => {
    e.stopPropagation();
    setExpandedRows((prev) => ({ ...prev, [imCode]: !prev[imCode] }));
    if (onRowClick) onRowClick(row);
  };

  const handleHeaderClick = (key: string) => {
    if (onSortChange) onSortChange(key);
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const lowerQ = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.item_model.toLowerCase().includes(lowerQ) ||
        r.im_code.toLowerCase().includes(lowerQ)
    );
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a: any, b: any) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortKey, sortDir]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-neutral-400 border border-dashed border-white/10 rounded">
        No OTB records found.
      </div>
    );
  }

  const renderSortIcon = (key: string) => {
    if (sortKey !== key) return <span className="text-zinc-700 ml-1">↕</span>;
    return <span className="text-sky-400 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="overflow-x-auto glass-panel">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="text-xs text-neutral-500 font-semibold tracking-wider uppercase bg-transparent">
          <tr>
            <th
              className="px-4 py-3 cursor-pointer hover:text-neutral-300"
              onClick={() => handleHeaderClick("item_model")}
            >
              Model {renderSortIcon("item_model")}
            </th>
            <th
              className="px-4 py-3 cursor-pointer hover:text-neutral-300"
              onClick={() => handleHeaderClick("brand")}
            >
              Brand {renderSortIcon("brand")}
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-neutral-300"
              onClick={() => handleHeaderClick("current_stock")}
            >
              Stock {renderSortIcon("current_stock")}
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-neutral-300"
              onClick={() => handleHeaderClick("msp_20d")}
            >
              MSP 20d {renderSortIcon("msp_20d")}
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-neutral-300"
              onClick={() => handleHeaderClick("raw_otb")}
            >
              Raw OTB {renderSortIcon("raw_otb")}
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-neutral-300"
              onClick={() => handleHeaderClick("shuffle_reduction")}
            >
              Shuffle ↓ {renderSortIcon("shuffle_reduction")}
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-neutral-300"
              onClick={() => handleHeaderClick("effective_otb")}
            >
              Net OTB {renderSortIcon("effective_otb")}
            </th>
            <th className="px-4 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {sortedRows.map((row, idx) => {
            const isExpanded = !!expandedRows[row.im_code];
            const isDimmed = !row.needs_purchase;

            return (
              <React.Fragment key={row.im_code || idx}>
                <tr
                  className={`hover:bg-white/5 cursor-pointer transition-colors ${
                    isDimmed ? "opacity-60" : ""
                  }`}
                  onClick={(e) => toggleRow(e, row.im_code, row)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-200">{row.item_model}</div>
                    <div className="text-xs text-neutral-400">{row.im_code}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{row.brand}</td>
                  <td className="px-4 py-3 text-right font-mono text-sky-300">
                    {row.current_stock.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-300">
                    {row.msp_20d.toLocaleString("en-IN")}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      row.raw_otb > 0 ? "text-amber-400" : "text-neutral-400"
                    }`}
                  >
                    {row.raw_otb.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sky-400">
                    {row.shuffle_reduction > 0
                      ? `−${row.shuffle_reduction.toLocaleString("en-IN")}`
                      : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-bold ${
                      row.effective_otb > 0 ? "text-red-400" : "text-neutral-400"
                    }`}
                  >
                    {row.effective_otb.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.needs_purchase ? (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
                        RAISE PO
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
                        SUFFICIENT
                      </span>
                    )}
                  </td>
                </tr>

                {/* Expanded Row */}
                {isExpanded && row.donor_detail && row.donor_detail.length > 0 && (
                  <tr className="bg-transparent">
                    <td colSpan={8} className="p-4 border-b border-white/5">
                      <div className="bg-[#0A0A0A]/60 border border-white/10 rounded p-4 max-w-3xl ml-8 shadow-inner">
                        <h4 className="text-xs font-medium text-neutral-400 mb-3 uppercase tracking-wider">
                          Shuffle Sources
                        </h4>
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-neutral-400 bg-transparent">
                            <tr>
                              <th className="px-3 py-2">Donor Branch</th>
                              <th className="px-3 py-2 text-right">Excess</th>
                              <th className="px-3 py-2 text-right">Suggested Transfer</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {row.donor_detail.map((donor, dIdx) => (
                              <tr key={dIdx} className="hover:bg-white/5">
                                <td className="px-3 py-2 text-neutral-300 font-medium">
                                  {donor.branch}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-emerald-400/80">
                                  {donor.excess.toLocaleString("en-IN")} units
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-sky-400 font-bold">
                                  {donor.suggested_transfer.toLocaleString("en-IN")} units
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
                {isExpanded && (!row.donor_detail || row.donor_detail.length === 0) && (
                  <tr className="bg-transparent">
                    <td colSpan={8} className="p-4 border-b border-white/5">
                      <div className="text-xs text-neutral-400 ml-8 italic">
                        No ASM shuffle sources available for this model.
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
