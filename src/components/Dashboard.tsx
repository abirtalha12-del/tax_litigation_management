import React from "react";
import { LitigationCase } from "../types";
import { AlertTriangle, BookOpen, Briefcase, Calendar, CheckCircle2, DollarSign, FileDown, FolderArchive, Landmark, ShieldCheck, TrendingUp } from "lucide-react";

interface DashboardProps {
  cases: LitigationCase[];
  onSelectCase: (caseId: string) => void;
  onSwitchTab: (tab: string) => void;
}

export default function Dashboard({ cases, onSelectCase, onSwitchTab }: DashboardProps) {
  // Metric Calculators
  const totalCases = cases.length;
  
  const openCases = cases.filter(
    (c) => 
      c.outcomeInfo.currentStatus.toLowerCase() !== "closed" &&
      c.proceedingsInfo.currentStage.toLowerCase() !== "concluded with full relief"
  ).length;

  const closedCases = totalCases - openCases;

  const appealsPending = cases.filter(
    (c) => 
      c.proceedingsInfo.currentStage.toLowerCase().includes("appeal") || 
      c.outcomeInfo.currentStatus.toLowerCase().includes("appeal")
  ).length;

  // Exposure calculators
  const totalTaxExposure = cases.reduce((acc, c) => acc + (c.financialInfo.taxDemand || 0), 0);
  const totalPenaltyExposure = cases.reduce((acc, c) => acc + (c.financialInfo.penalty || 0), 0);
  const totalSurchargeExposure = cases.reduce((acc, c) => acc + (c.financialInfo.defaultSurcharge || 0), 0);
  const totalRefunds = cases.reduce((acc, c) => acc + (c.financialInfo.refundAmount || 0), 0);
  const totalCombinedExposure = totalTaxExposure + totalPenaltyExposure + totalSurchargeExposure;
  
  // Confirmed, deleted, remanded
  const totalConfirmed = cases.reduce((acc, c) => acc + (c.outcomeInfo.amountConfirmed || 0), 0);
  const totalDeleted = cases.reduce((acc, c) => acc + (c.outcomeInfo.amountDeleted || 0), 0);
  const totalRemanded = cases.reduce((acc, c) => acc + (c.outcomeInfo.amountRemanded || 0), 0);

  // Group by Authority
  const authorityCounts: Record<string, number> = {};
  cases.forEach((c) => {
    const auth = c.caseInfo.authorityForum || "Other";
    let group = "Other";
    if (auth.includes("FBR") || auth.toUpperCase().includes("FEDERAL BOARD")) group = "FBR (Federal)";
    else if (auth.includes("PRA") || auth.toUpperCase().includes("PUNJAB REVENUE")) group = "PRA (Punjab)";
    else if (auth.includes("SRB") || auth.toUpperCase().includes("SINDH REVENUE")) group = "SRB (Sindh)";
    else if (auth.toUpperCase().includes("CUSTOMS")) group = "Customs";
    else if (auth.toUpperCase().includes("HIGH COURT") || auth.toUpperCase().includes("LHC")) group = "High Court";
    else if (auth.toUpperCase().includes("SUPREME")) group = "Supreme Court";
    else group = auth;

    authorityCounts[group] = (authorityCounts[group] || 0) + 1;
  });

  // Group by Tax Type
  const taxTypeCounts: Record<string, number> = {};
  cases.forEach((c) => {
    const type = c.caseInfo.taxType || "Other";
    taxTypeCounts[type] = (taxTypeCounts[type] || 0) + 1;
  });

  // Group by Year
  const yearCounts: Record<string, number> = {};
  cases.forEach((c) => {
    const dateStr = c.caseInfo.documentDate || "";
    let year = "Unknown";
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) {
      year = yearMatch[0];
    } else if (c.caseInfo.taxPeriod.match(/\d{4}/)) {
      year = c.caseInfo.taxPeriod.match(/\d{4}/)?.[0] || "Unknown";
    }
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });

  // Run validation checks on cases to highlight active issues
  const validationIssuesList: { caseId: string; taxpayer: string; issues: string[] }[] = [];
  cases.forEach((c) => {
    const issues: string[] = [];
    
    // Duplicate check
    const isDuplicateRef = cases.filter(other => other.id !== c.id && other.caseInfo.referenceNumber === c.caseInfo.referenceNumber && c.caseInfo.referenceNumber.trim() !== "");
    if (isDuplicateRef.length > 0) {
      issues.push(`Duplicate reference number: ${c.caseInfo.referenceNumber}`);
    }

    // Missing fields
    if (!c.caseInfo.ntn) issues.push("Missing Taxpayer NTN");
    if (!c.caseInfo.strn && c.caseInfo.taxType.toLowerCase().includes("sales")) issues.push("Sales tax case missing STRN");
    if (!c.caseInfo.documentDate) issues.push("Missing Document Date");
    
    // Math checks
    const exposureSum = (c.financialInfo.taxDemand || 0) + (c.financialInfo.penalty || 0) + (c.financialInfo.defaultSurcharge || 0);
    if (Math.abs(c.financialInfo.totalExposure - exposureSum) > 10) {
      issues.push(`Imbalanced financial total. Claimed total exposure: PKR ${c.financialInfo.totalExposure.toLocaleString()}, calculated sum: PKR ${exposureSum.toLocaleString()}`);
    }

    // Status conflict
    if (c.proceedingsInfo.currentStage.toLowerCase().includes("concluded") && c.outcomeInfo.currentStatus.toLowerCase() === "open") {
      issues.push("Status dispute: Stage is Concluded but Status remains Open");
    }

    if (issues.length > 0 || (c.hasOwnProperty("validationIssues") && (c as any).validationIssues && (c as any).validationIssues.length > 0)) {
      const allIssues = [
        ...issues,
        ...((c as any).validationIssues || [])
      ];
      validationIssuesList.push({
        caseId: c.id,
        taxpayer: c.caseInfo.taxpayerName,
        issues: Array.from(new Set(allIssues)) // unique
      });
    }
  });

  // Prepare upcoming hearing calendar events
  const hearingsList: { caseId: string; date: string; taxpayer: string; forum: string }[] = [];
  cases.forEach((c) => {
    // If case is closed, all scheduled dates should not be shown
    if (c.outcomeInfo.currentStatus.toLowerCase() === "closed") {
      return;
    }
    if (c.proceedingsInfo.hearingDates && c.proceedingsInfo.hearingDates.length > 0) {
      c.proceedingsInfo.hearingDates.forEach((date) => {
        // filter future or current hearings
        hearingsList.push({
          caseId: c.id,
          date,
          taxpayer: c.caseInfo.taxpayerName,
          forum: c.caseInfo.authorityForum,
        });
      });
    }
  });
  const sortedHearings = hearingsList.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const formatPKR = (amt: number) => {
    if (amt >= 10000000) {
      return `PKR ${(amt / 10000000).toFixed(2)} Crore`;
    } else if (amt >= 100000) {
      return `PKR ${(amt / 100000).toFixed(2)} Lakh`;
    }
    return `PKR ${amt.toLocaleString()}`;
  };

  return (
    <div id="dashboard-tab" className="space-y-8 animate-fade-in">
      {/* Header and Quick Summary Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
            Litigation Dashboard
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-sans">
            Corporate Tax Controversy, Analytics, and Regulatory Proceedings at a glance.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <button
            onClick={() => onSwitchTab("uploader")}
            className="flex items-center gap-2 bg-amber-500 text-slate-950 px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-400 transition shadow-sm cursor-pointer"
          >
            <TrendingUp size={16} />
            Analyze New File
          </button>
          <button
            onClick={() => onSwitchTab("sheets")}
            className="flex items-center gap-2 border border-slate-800 bg-[#0f172a]/40 hover:bg-[#0f172a]/80 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition"
          >
            <FileDown size={16} />
            Excel Registers
          </button>
        </div>
      </div>

      {/* Numerical Metrics Grids */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cases */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Total Dossiers</span>
            <span className="text-4xl font-extrabold text-white mt-1 block">{totalCases}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300">
            <Briefcase size={24} />
          </div>
        </div>

        {/* Open Cases */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Open & Active</span>
            <span className="text-4xl font-extrabold text-amber-400 mt-1 block">{openCases}</span>
          </div>
          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-400">
            <BookOpen size={24} />
          </div>
        </div>

        {/* Appeals Pending */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Appeals Pending</span>
            <span className="text-4xl font-extrabold text-[#38bdf8] mt-1 block">{appealsPending}</span>
          </div>
          <div className="bg-[#38bdf8]/10 p-3 rounded-xl border border-[#38bdf8]/20 text-[#38bdf8]">
            <Landmark size={24} />
          </div>
        </div>

        {/* Closed Cases */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Closed / Settled</span>
            <span className="text-4xl font-extrabold text-emerald-400 mt-1 block">{closedCases}</span>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* Financial Exposure Section */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 md:p-8 shadow-md border border-slate-800">
        <h2 className="text-lg font-semibold tracking-tight text-slate-205 mb-6 flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-400" />
          Financial Controversy Exposure Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="border-r border-slate-800 pr-4">
            <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Total Tax Demand</span>
            <span className="text-2xl font-bold block mt-1 text-white">{formatPKR(totalTaxExposure)}</span>
            <p className="text-xs text-slate-500 mt-1">Principal demand raised</p>
          </div>
          <div className="border-r border-slate-800 pr-4 md:pl-4">
            <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Total Penalty Exposure</span>
            <span className="text-2xl font-bold block mt-1 text-slate-300">{formatPKR(totalPenaltyExposure)}</span>
            <p className="text-xs text-slate-500 mt-1">Levies for non-compliance</p>
          </div>
          <div className="border-r border-slate-800 pr-4 lg:pl-4">
            <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Default Surcharges</span>
            <span className="text-2xl font-bold block mt-1 text-slate-300">{formatPKR(totalSurchargeExposure)}</span>
            <p className="text-xs text-slate-500 mt-1">Calculated interest accumulate</p>
          </div>
          <div className="pl-0 md:pl-4">
            <span className="text-xs text-emerald-400 block uppercase tracking-wider font-semibold">Total Audited Controversy</span>
            <span className="text-3xl font-extrabold block mt-1 text-emerald-400">{formatPKR(totalCombinedExposure)}</span>
            <p className="text-xs text-slate-400 mt-1 font-medium">Surcharge + Penalty + Tax principal</p>
          </div>
        </div>

        {/* Detailed Resolution / Appeal Relief Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-6 border-t border-slate-800">
          <div className="bg-[#0f172a]/60 p-4 rounded-xl border border-slate-800/40">
            <div className="flex justify-between items-center text-xs text-amber-400 font-bold mb-1 uppercase tracking-wider">
              <span>Upheld / Confirmed</span>
              <span>{totalCombinedExposure > 0 ? ((totalConfirmed / totalCombinedExposure) * 100).toFixed(0) : 0}%</span>
            </div>
            <span className="text-xl font-bold block text-slate-100">{formatPKR(totalConfirmed)}</span>
            <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden border border-slate-800/30">
              <div 
                className="bg-amber-400 h-1.5 rounded-full" 
                style={{ width: `${totalCombinedExposure > 0 ? Math.min(100, (totalConfirmed / totalCombinedExposure) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-[#0f172a]/60 p-4 rounded-xl border border-slate-800/40">
            <div className="flex justify-between items-center text-xs text-emerald-400 font-bold mb-1 uppercase tracking-wider">
              <span>Vacated / Deleted Relief</span>
              <span>{totalCombinedExposure > 0 ? ((totalDeleted / totalCombinedExposure) * 100).toFixed(0) : 0}%</span>
            </div>
            <span className="text-xl font-bold block text-slate-100">{formatPKR(totalDeleted)}</span>
            <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden border border-slate-800/30">
              <div 
                className="bg-emerald-400 h-1.5 rounded-full" 
                style={{ width: `${totalCombinedExposure > 0 ? Math.min(100, (totalDeleted / totalCombinedExposure) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-[#0f172a]/60 p-4 rounded-xl border border-slate-800/40">
            <div className="flex justify-between items-center text-xs text-sky-400 font-bold mb-1 uppercase tracking-wider">
              <span>Sent Back / Remanded</span>
              <span>{totalCombinedExposure > 0 ? ((totalRemanded / totalCombinedExposure) * 100).toFixed(0) : 0}%</span>
            </div>
            <span className="text-xl font-bold block text-slate-100">{formatPKR(totalRemanded)}</span>
            <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden border border-slate-800/30">
              <div 
                className="bg-sky-400 h-1.5 rounded-full" 
                style={{ width: `${totalCombinedExposure > 0 ? Math.min(100, (totalRemanded / totalCombinedExposure) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Distributions of Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases by Forum/Authority */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800/80 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <Landmark size={18} className="text-slate-400" />
            <h3 className="font-semibold text-white uppercase tracking-widest text-[11px]">Forum Distribution</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(authorityCounts).map(([auth, count]) => {
              const perc = ((count / totalCases) * 100).toFixed(0);
              return (
                <div key={auth} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="font-semibold">{auth}</span>
                    <span className="text-slate-400">{count} {count === 1 ? 'case' : 'cases'} ({perc}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                    <div 
                      className="bg-amber-500 h-2 rounded-full" 
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(authorityCounts).length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4 italic">No data available</p>
            )}
          </div>
        </div>

        {/* Cases by Tax Type */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800/80 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <BookOpen size={18} className="text-slate-400" />
            <h3 className="font-semibold text-white uppercase tracking-widest text-[11px]">Type of Levies</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(taxTypeCounts).map(([type, count]) => {
              const perc = ((count / totalCases) * 100).toFixed(0);
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="font-semibold">{type}</span>
                    <span className="text-slate-400">{count} {count === 1 ? 'case' : 'cases'} ({perc}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                    <div 
                      className="bg-[#38bdf8] h-2 rounded-full" 
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(taxTypeCounts).length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4 italic">No data available</p>
            )}
          </div>
        </div>

        {/* Cases by Year */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800/80 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <Calendar size={18} className="text-slate-400" />
            <h3 className="font-semibold text-white uppercase tracking-widest text-[11px]">Timeline Breakdown</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(yearCounts).sort((a, b) => b[0].localeCompare(a[0])).map(([year, count]) => {
              const perc = ((count / totalCases) * 100).toFixed(0);
              return (
                <div key={year} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="font-semibold">Year {year}</span>
                    <span className="text-slate-400">{count} {count === 1 ? 'case' : 'cases'} ({perc}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full" 
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(yearCounts).length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4 italic">No data available</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hearing Calendar Quick View */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800/80 shadow-2xs">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-amber-500" />
              <h3 className="font-semibold text-white text-sm">Upcoming Hearing Calendars</h3>
            </div>
            <button 
              onClick={() => onSwitchTab("sheets")} 
              className="text-xs text-slate-400 hover:text-amber-400 transition font-semibold"
            >
              See Schedule
            </button>
          </div>
          
          <div className="space-y-3">
            {sortedHearings.map((hearing, idx) => (
              <div 
                key={`${hearing.caseId}-${idx}`} 
                onClick={() => onSelectCase(hearing.caseId)}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-950/50 border border-transparent hover:border-slate-800 transition cursor-pointer"
              >
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1.5 rounded-lg text-center font-mono text-xs font-bold min-w-[75px]">
                  <span className="block text-[8px] font-bold uppercase tracking-wider text-amber-500/80 leading-none mb-1">Scheduled</span>
                  {hearing.date}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 truncate block">
                      {hearing.taxpayer}
                    </span>
                    <span className="bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider font-mono">
                      {hearing.caseId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-1 font-medium">{hearing.forum}</p>
                </div>
              </div>
            ))}
            {sortedHearings.length === 0 && (
              <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                <p className="text-xs text-slate-500 italic">No hearings on current roster</p>
              </div>
            )}
          </div>
        </div>

        {/* Database Quality / Integrity Warnings */}
        <div className="bg-[#0f172a] p-6 rounded-[#18212f]/80 rounded-2xl border border-slate-800/80 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <AlertTriangle size={18} className="text-rose-500 animate-pulse" />
            <h3 className="font-semibold text-white text-sm">Controversy Register Data Audits</h3>
          </div>
          
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
            {validationIssuesList.length > 0 ? (
              validationIssuesList.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-rose-500/10 rounded-xl border border-rose-550/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-rose-300 font-sans">{item.taxpayer}</span>
                    <button 
                      onClick={() => onSelectCase(item.caseId)}
                      className="text-[10px] font-mono text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 px-2 py-0.5 rounded font-bold"
                    >
                      {item.caseId}
                    </button>
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-xs text-rose-205/90 font-sans font-semibold">
                    {item.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <div className="py-8 text-center bg-emerald-500/10 rounded-xl border border-dashed border-emerald-500/20 flex flex-col items-center">
                <ShieldCheck size={36} className="text-emerald-400 mb-2 animate-bounce" />
                <p className="text-xs text-emerald-400 font-semibold">Perfect Database Integrity!</p>
                <p className="text-[11px] text-emerald-500/80 mt-1 max-w-sm px-6 leading-relaxed">Checked duplicates, amounts match, mandatory NTNs/STRNs provided.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
