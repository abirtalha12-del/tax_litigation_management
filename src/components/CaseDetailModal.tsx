import React from "react";
import { LitigationCase } from "../types";
import { X, Calendar, DollarSign, Landmark, ChevronRight, FileText, Scale, TrendingUp, AlertCircle, Download } from "lucide-react";
import { downloadManagementCaseSummary } from "../utils/docxGenerator";

interface CaseDetailModalProps {
  caseObj: LitigationCase | null;
  onClose: () => void;
}

export default function CaseDetailModal({ caseObj, onClose }: CaseDetailModalProps) {
  if (!caseObj) return null;

  const getStatusBadge = (status: string) => {
    const norm = status.toLowerCase();
    if (norm === "closed" || norm.includes("withdrawn") || norm.includes("concluded")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold";
    }
    if (norm.includes("relief") || norm.includes("stay")) {
      return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-bold";
    }
    if (norm.includes("appeal") || norm.includes("hearing") || norm === "open") {
      return "bg-amber-500/10 text-amber-450 border-amber-500/20 font-bold";
    }
    return "bg-slate-800 text-slate-300 border-slate-700 font-bold";
  };

  const formatPKR = (amt: number) => {
    return `PKR ${amt.toLocaleString()}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-6 max-w-4xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto my-6">
        
        {/* Header Block */}
        <div className="flex justify-between items-start border-b border-slate-805 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-slate-450 text-sm">{caseObj.id}</span>
              <span className={`border px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${getStatusBadge(caseObj.outcomeInfo.currentStatus)}`}>
                {caseObj.outcomeInfo.currentStatus}
              </span>
              <span className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] uppercase font-semibold font-mono">
                {caseObj.caseInfo.taxType}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 font-sans">{caseObj.caseInfo.taxpayerName}</h2>
            <p className="text-slate-400 font-mono text-[10px] mt-0.5">NTN: {caseObj.caseInfo.ntn} | STRN: {caseObj.caseInfo.strn}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold p-1 w-8 h-8 flex items-center justify-center bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-808 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left detailed panel (8 columns) */}
          <div className="md:col-span-8 space-y-6">
            
            {/* Case Info details */}
            <div className="bg-[#020617]/50 p-5 rounded-2xl border border-slate-850 space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                <Landmark size={14} />
                Core Litigation Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div>
                  <span className="text-slate-450 block font-semibold text-[10px]">Tax Period / Year</span>
                  <span className="font-bold text-white">{caseObj.caseInfo.taxPeriod}</span>
                </div>
                <div>
                  <span className="text-slate-450 block font-semibold text-[10px]">Authority Forum</span>
                  <span className="font-bold text-white">{caseObj.caseInfo.authorityForum}</span>
                </div>
                <div>
                  <span className="text-slate-450 block font-semibold text-[10px]">Reference / Code No.</span>
                  <span className="font-mono font-bold text-white">{caseObj.caseInfo.referenceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-450 block font-semibold text-[10px]">Document Category</span>
                  <span className="font-bold text-white">{caseObj.caseInfo.documentType}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-450 block font-semibold text-[10px] mb-0.5">Legal Mandate Clauses</span>
                  <span className="font-semibold text-slate-200 leading-relaxed block bg-slate-950/30 border border-slate-850/60 p-2 rounded-lg">{caseObj.caseInfo.relevantLegalSections || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-450 block font-semibold text-[10px]">Notice Official Date</span>
                  <span className="font-bold text-white">{caseObj.caseInfo.documentDate || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Trial Strategy Stances */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Scale size={14} />
                Trial Defense grounds
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-rose-950/10 border border-rose-900/30 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">Department Accusation</span>
                  <p className="text-xs text-rose-200 mt-1 leading-relaxed font-sans font-medium">{caseObj.outcomeInfo.departmentPosition || "No Position recorded."}</p>
                </div>
                <div className="p-4 bg-emerald-950/10 border border-emerald-900/25 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Taxpayer Defense Ground</span>
                  <p className="text-xs text-emerald-250 mt-1 leading-relaxed font-sans font-medium">{caseObj.outcomeInfo.taxpayerPosition || "No Position recorded."}</p>
                </div>
              </div>

              {caseObj.outcomeInfo.decisionSummary && (
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block">Judicial Adjudication Summary</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans font-medium">{caseObj.outcomeInfo.decisionSummary}</p>
                </div>
              )}
            </div>

            {/* Event Chronology Chain */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                <Calendar size={14} />
                Chronological Proceeding Trail
              </h3>
              <div className="space-y-4 border-l-2 border-slate-800 pl-4 max-h-[250px] overflow-y-auto pr-2">
                {caseObj.chronology && caseObj.chronology.length > 0 ? (
                  caseObj.chronology.map((event, idx) => (
                    <div key={idx} className="relative pb-3 last:pb-0 font-sans">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-slate-900" />
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[9px] font-bold font-mono text-slate-300 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded leading-none shrink-0 animate-pulse">
                          {event.date}
                        </span>
                        <span className="text-[10px] text-slate-450 font-mono truncate">Ref: {event.referenceNo}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-1">{event.event}</h4>
                      <p className="text-[10px] text-slate-450 font-semibold">{event.authority}</p>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed font-medium">{event.summary}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No timeline events captured</p>
                )}
              </div>
            </div>

          </div>

          {/* Right Summary Side panel (4 columns) */}
          <div className="md:col-span-4 space-y-6">
            
            {/* Financial exposure block card */}
            <div className="bg-[#020617]/75 text-white p-5 rounded-2xl border border-slate-850 space-y-4 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300">Financial Exposure</h4>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span className="text-xs text-slate-400">Principal Demand</span>
                  <span className="text-xs font-bold font-mono">{formatPKR(caseObj.financialInfo.taxDemand)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span className="text-xs text-slate-400">Penalty Levied</span>
                  <span className="text-xs font-bold font-mono">{formatPKR(caseObj.financialInfo.penalty)}</span>
                </div>
                {caseObj.financialInfo.defaultSurcharge > 0 && (
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-xs text-slate-400">Default Surcharge</span>
                    <span className="text-xs font-bold font-mono">{formatPKR(caseObj.financialInfo.defaultSurcharge)}</span>
                  </div>
                )}
                {caseObj.financialInfo.refundAmount > 0 && (
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-xs text-emerald-400">Refund Claims</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">{formatPKR(caseObj.financialInfo.refundAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2">
                  <span className="text-xs font-bold text-amber-400">Total Quantum</span>
                  <span className="text-base font-extrabold font-mono text-amber-400 animate-pulse">{formatPKR(caseObj.financialInfo.totalExposure)}</span>
                </div>
              </div>
            </div>

            {/* Relief results */}
            <div className="bg-[#020617]/50 p-5 rounded-2xl border border-slate-850 space-y-3.5">
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <TrendingUp size={14} />
                Relief status
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Upheld Confirmed:</span>
                  <span className="font-bold text-slate-200 font-mono">{formatPKR(caseObj.outcomeInfo.amountConfirmed || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium font-sans">Relieved / Deleted:</span>
                  <span className="font-bold text-emerald-400 font-mono">-{formatPKR(caseObj.outcomeInfo.amountDeleted || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Remanded back:</span>
                  <span className="font-bold text-sky-400 font-mono">{formatPKR(caseObj.outcomeInfo.amountRemanded || 0)}</span>
                </div>
              </div>
            </div>

            {/* Trial Proceedings and Stage */}
            <div className="bg-[#020617]/50 p-5 rounded-2xl border border-slate-850 space-y-3.5">
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Proceedings Log</h4>
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-450 text-[10px] block font-semibold leading-normal">Current litigation stage</span>
                  <span className="font-bold text-white mt-0.5 inline-block">{caseObj.proceedingsInfo.currentStage}</span>
                </div>
                {caseObj.outcomeInfo.currentStatus.toLowerCase() !== "closed" && caseObj.proceedingsInfo.hearingDates && caseObj.proceedingsInfo.hearingDates.length > 0 && (
                  <div>
                    <span className="text-slate-450 text-[10px] block font-semibold leading-normal">On schedule trial hearings</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {caseObj.proceedingsInfo.hearingDates.map((date, i) => (
                        <span key={i} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold font-mono px-2 py-0.5 rounded text-[10px]">
                          {date}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Source Audit logs */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Analysed Files Audit</span>
              <div className="space-y-1.5">
                {caseObj.sourceFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-305 bg-slate-950/40 p-2 rounded-xl border border-slate-850">
                    <FileText size={14} className="text-slate-450 shrink-0" />
                    <span className="truncate font-sans font-medium">{file}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-805">
          <button
            onClick={() => downloadManagementCaseSummary(caseObj)}
            className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-xs"
            title="Download MS Word brief written for executive management review"
          >
            <Download size={14} />
            Download Case Summary (.doc)
          </button>
          <button
            onClick={onClose}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-xs transition"
          >
            Acknowledge & Close
          </button>
        </div>

      </div>
    </div>
  );
}
