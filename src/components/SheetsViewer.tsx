import React, { useState } from "react";
import { LitigationCase } from "../types";
import { FileDown, Table, Calendar, Activity, TrendingUp, HelpCircle, Filter, Search, X } from "lucide-react";
import * as XLSX from "xlsx";

interface SheetsViewerProps {
  cases: LitigationCase[];
}

type TabType = "case_register" | "proceedings_log" | "appeals_register" | "recovery_register" | "hearing_calendar";

export default function SheetsViewer({ cases }: SheetsViewerProps) {
  const [activeSheet, setActiveSheet] = useState<TabType>("case_register");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("all");
  const [caseSearchQuery, setCaseSearchQuery] = useState<string>("");

  // Compile individual lists
  const caseRegisterData = cases.map((c) => ({
    caseId: c.id,
    taxpayer: c.caseInfo.taxpayerName,
    ntn: c.caseInfo.ntn,
    strn: c.caseInfo.strn || "N/A",
    taxType: c.caseInfo.taxType,
    period: c.caseInfo.taxPeriod,
    caseType: c.caseInfo.documentType,
    authority: c.caseInfo.authorityForum,
    status: c.outcomeInfo.currentStatus,
    demand: c.financialInfo.taxDemand,
    penalty: c.financialInfo.penalty,
    stage: c.proceedingsInfo.currentStage,
    remarks: c.outcomeInfo.decisionSummary || c.outcomeInfo.departmentPosition || "N/A",
  }));

  const proceedingsLogData: any[] = [];
  cases.forEach((c) => {
    if (c.chronology && c.chronology.length > 0) {
      c.chronology.forEach((evt) => {
        proceedingsLogData.push({
          caseId: c.id,
          date: evt.date,
          eventType: evt.event,
          authority: evt.authority,
          referenceNo: evt.referenceNo,
          summary: evt.summary,
        });
      });
    }
  });

  const appealsRegisterData = cases.map((c) => ({
    caseId: c.id,
    appealNo: c.caseInfo.referenceNumber || "N/A",
    forum: c.caseInfo.authorityForum,
    appealDate: c.proceedingsInfo.appealDate || "N/A",
    decisionDate: c.proceedingsInfo.decisionDate || "Pending",
    result: c.outcomeInfo.reliefGranted || "Pending adjudication",
    status: c.outcomeInfo.currentStatus,
  }));

  const recoveryRegisterData = cases.map((c) => {
    const demandRaised = (c.financialInfo.taxDemand || 0) + (c.financialInfo.penalty || 0) + (c.financialInfo.defaultSurcharge || 0);
    const amountCleared = (c.outcomeInfo.amountDeleted || 0) + (c.outcomeInfo.amountRemanded || 0);
    const balance = Math.max(0, demandRaised - amountCleared);
    let recStatus = "Pending";
    if (balance === 0 && demandRaised > 0) recStatus = "Full Relief/Resolved";
    else if (c.outcomeInfo.currentStatus.toLowerCase() === "closed") recStatus = "Concluded/Cleared";
    else if (c.outcomeInfo.currentStatus.toLowerCase().includes("stay")) recStatus = "Stay Granted";

    return {
      caseId: c.id,
      demandRaised,
      amountCleared,
      balance,
      status: recStatus,
    };
  });

  const hearingCalendarData: any[] = [];
  cases.forEach((c) => {
    // If case is closed, all scheduled dates should not be shown
    if (c.outcomeInfo.currentStatus.toLowerCase() === "closed") {
      return;
    }
    if (c.proceedingsInfo.hearingDates && c.proceedingsInfo.hearingDates.length > 0) {
      c.proceedingsInfo.hearingDates.forEach((date) => {
        hearingCalendarData.push({
          caseId: c.id,
          nextHearingDate: date,
          forum: c.caseInfo.authorityForum,
          responsibleOfficer: c.chronology[0]?.authority || "Tax Litigation Specialist",
          remarks: c.proceedingsInfo.currentStage,
        });
      });
    }
  });

  // Dynamic filter lists for Sheets 2, 3, 4, 5
  const matchesCaseFilter = (itemCaseId: string) => {
    const cleanId = itemCaseId.toLowerCase();
    const cleanSelect = selectedCaseId.toLowerCase();
    const cleanQuery = caseSearchQuery.trim().toLowerCase();

    const matchesSelect = selectedCaseId === "all" || cleanId === cleanSelect;
    const matchesQuery = !cleanQuery || cleanId.includes(cleanQuery);

    return matchesSelect && matchesQuery;
  };

  const filteredProceedings = proceedingsLogData.filter((item) => matchesCaseFilter(item.caseId));
  const filteredAppeals = appealsRegisterData.filter((item) => matchesCaseFilter(item.caseId));
  const filteredRecovery = recoveryRegisterData.filter((item) => matchesCaseFilter(item.caseId));
  const filteredHearing = hearingCalendarData.filter((item) => matchesCaseFilter(item.caseId));

  // Excel generation master function
  const handleDownloadWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // 1. Case Register Sheet
    const sheet1Rows = cases.map((c) => ({
      "Case ID": c.id,
      "Taxpayer Name": c.caseInfo.taxpayerName,
      "NTN": c.caseInfo.ntn,
      "STRN": c.caseInfo.strn,
      "Tax Type": c.caseInfo.taxType,
      "Tax Period": c.caseInfo.taxPeriod,
      "Document/Case Type": c.caseInfo.documentType,
      "Authority Forum": c.caseInfo.authorityForum,
      "Dossier Status": c.outcomeInfo.currentStatus,
      "Tax Demand Principal (PKR)": c.financialInfo.taxDemand,
      "Penalties (PKR)": c.financialInfo.penalty,
      "Surcharge (PKR)": c.financialInfo.defaultSurcharge,
      "Total Financial Exposure (PKR)": c.financialInfo.totalExposure,
      "Current Stage": c.proceedingsInfo.currentStage,
      "Remarks": c.outcomeInfo.decisionSummary || c.outcomeInfo.departmentPosition,
    }));
    const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);
    XLSX.utils.book_append_sheet(wb, ws1, "Case Register");

    // 2. Proceedings Log Sheet
    const sheet2Rows = proceedingsLogData.map((p) => ({
      "Case ID": p.caseId,
      "Proceeding Date": p.date,
      "Event/Action Type": p.eventType,
      "Handling Authority": p.authority,
      "Official Reference No.": p.referenceNo,
      "Event Summary": p.summary,
    }));
    const ws2 = XLSX.utils.json_to_sheet(sheet2Rows.length > 0 ? sheet2Rows : [{ "Status": "No proceedings logged." }]);
    XLSX.utils.book_append_sheet(wb, ws2, "Proceedings Log");

    // 3. Appeals Register Sheet
    const sheet3Rows = cases.map((c) => ({
      "Case ID": c.id,
      "Appeal / Reference No.": c.caseInfo.referenceNumber,
      "Forum Name": c.caseInfo.authorityForum,
      "Appeal Filing Date": c.proceedingsInfo.appealDate || "N/A",
      "Decision Date": c.proceedingsInfo.decisionDate || "Pending",
      "Granted Relief Details": c.outcomeInfo.reliefGranted || "Pending",
      "Appeal Status": c.outcomeInfo.currentStatus,
    }));
    const ws3 = XLSX.utils.json_to_sheet(sheet3Rows);
    XLSX.utils.book_append_sheet(wb, ws3, "Appeals Register");

    // 4. Recovery Register Sheet
    const sheet4Rows = recoveryRegisterData.map((r) => ({
      "Case ID": r.caseId,
      "Total Disputed Demand (PKR)": r.demandRaised,
      "Amount Cleared/Deleted (PKR)": r.amountCleared,
      "Balance Recoverable (PKR)": r.balance,
      "Recovery Stage Status": r.status,
    }));
    const ws4 = XLSX.utils.json_to_sheet(sheet4Rows);
    XLSX.utils.book_append_sheet(wb, ws4, "Recovery Register");

    // 5. Hearing Calendar Sheet
    const sheet5Rows = hearingCalendarData.map((h) => ({
      "Case ID": h.caseId,
      "Scheduled Hearing Date": h.nextHearingDate,
      "Forum Name": h.forum,
      "Enterprise Representative": h.responsibleOfficer,
      "Hearing Cause/Stage": h.remarks,
    }));
    const ws5 = XLSX.utils.json_to_sheet(sheet5Rows.length > 0 ? sheet5Rows : [{ "Status": "No hearings on roster." }]);
    XLSX.utils.book_append_sheet(wb, ws5, "Hearing Calendar");

    // File download trigger
    XLSX.writeFile(wb, `Pakistan_Tax_Litigation_Registers.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
            Excel Consolidated Registers
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-sans">
            Preview live grid matrices and compile professionally formatted multi-sheet Excel workbooks instantly.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={handleDownloadWorkbook}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs cursor-pointer transition"
          >
            <FileDown size={18} />
            Download Excel Workbook (.xlsx)
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSheet("case_register")}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
            activeSheet === "case_register"
              ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm"
              : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/30 hover:text-white"
          }`}
        >
          Sheet 1: Case Register
        </button>
        <button
          onClick={() => setActiveSheet("proceedings_log")}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
            activeSheet === "proceedings_log"
              ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm"
              : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/30 hover:text-white"
          }`}
        >
          Sheet 2: Proceedings Log
        </button>
        <button
          onClick={() => setActiveSheet("appeals_register")}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
            activeSheet === "appeals_register"
              ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm"
              : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/30 hover:text-white"
          }`}
        >
          Sheet 3: Appeals Register
        </button>
        <button
          onClick={() => setActiveSheet("recovery_register")}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
            activeSheet === "recovery_register"
              ? "bg-amber-500 border-amber-500 text-slate-955 shadow-sm"
              : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/30 hover:text-white"
          }`}
        >
          Sheet 4: Recovery Register
        </button>
        <button
          onClick={() => setActiveSheet("hearing_calendar")}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
            activeSheet === "hearing_calendar"
              ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm"
              : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/30 hover:text-white"
          }`}
        >
          Sheet 5: Hearing Calendar
        </button>
      </div>

      {/* Case filter for supplementary logs/registers */}
      {activeSheet !== "case_register" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <Filter size={16} className="text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Filter by Case Reference
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                Isolate specific dossier logs and transaction schedules cleanly
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Case Select:</span>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-amber-500 [&>option]:bg-slate-900 transition"
              >
                <option value="all">All Cases (No Filter)</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} - {c.caseInfo.taxpayerName}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Search Case ID:</span>
              <div className="relative">
                <input
                  type="text"
                  value={caseSearchQuery}
                  onChange={(e) => setCaseSearchQuery(e.target.value)}
                  placeholder="e.g. CASE-2024..."
                  className="bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs rounded-xl pl-8 pr-8 py-2 w-44 focus:outline-none focus:border-amber-500 placeholder:text-slate-600 transition"
                />
                <Search size={12} className="text-slate-500 absolute left-3 top-2.5" />
                {caseSearchQuery && (
                  <button
                    onClick={() => setCaseSearchQuery("")}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-800 text-slate-400 transition"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid registers preview */}
      <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-3xs overflow-hidden">
        
        {activeSheet === "case_register" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/65 border-b border-slate-800 select-none">
                  <th className="p-3.5 pl-5 font-bold uppercase tracking-wider text-slate-400 text-[10px] font-mono">Case ID</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Taxpayer Name</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">NTN</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">STRN</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Tax Type</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Period</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Case Type</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Forum</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Tax Demand</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Penalty</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Current Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {caseRegisterData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="p-3.5 pl-5 font-bold font-mono text-amber-400">{row.caseId}</td>
                    <td className="p-3.5 font-bold text-white">{row.taxpayer}</td>
                    <td className="p-3.5 font-mono text-slate-400">{row.ntn}</td>
                    <td className="p-3.5 font-mono text-slate-400">{row.strn}</td>
                    <td className="p-3.5 font-bold text-slate-200">{row.taxType}</td>
                    <td className="p-3.5 text-slate-300">{row.period}</td>
                    <td className="p-3.5 text-slate-300 truncate max-w-[150px]">{row.caseType}</td>
                    <td className="p-3.5 text-slate-300 font-medium truncate max-w-[150px]">{row.authority}</td>
                    <td className="p-3.5 font-mono font-semibold text-white">PKR {row.demand.toLocaleString()}</td>
                    <td className="p-3.5 font-mono font-semibold text-white">PKR {row.penalty.toLocaleString()}</td>
                    <td className="p-3.5 text-slate-400 font-medium">{row.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeSheet === "proceedings_log" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/65 border-b border-slate-800 select-none">
                  <th className="p-3.5 pl-5 font-bold uppercase tracking-wider text-slate-400 text-[10px] font-mono">Case ID</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Log Date</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Action-Event Type</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Authority Forum</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px] font-mono">Reference Code</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Proceeding Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProceedings.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="p-3.5 pl-5 font-bold font-mono text-amber-400">{row.caseId}</td>
                    <td className="p-3.5 font-mono text-white font-bold">{row.date}</td>
                    <td className="p-3.5 font-bold text-slate-205">{row.eventType}</td>
                    <td className="p-3.5 text-slate-300">{row.authority}</td>
                    <td className="p-3.5 text-slate-400 font-mono">{row.referenceNo}</td>
                    <td className="p-3.5 text-slate-300 max-w-sm leading-relaxed">{row.summary}</td>
                  </tr>
                ))}
                {filteredProceedings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 italic">No proceedings records logged for current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSheet === "appeals_register" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/65 border-b border-slate-800 select-none">
                  <th className="p-3.5 pl-5 font-bold uppercase tracking-wider text-slate-400 text-[10px] font-mono">Case ID</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Appeal / SCN Ref No.</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Adjudication Forum</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Filing Date</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Decision Date</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Granted Relief Summary</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAppeals.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="p-3.5 pl-5 font-bold font-mono text-amber-400">{row.caseId}</td>
                    <td className="p-3.5 font-mono text-white font-bold">{row.appealNo}</td>
                    <td className="p-3.5 font-bold text-slate-205">{row.forum}</td>
                    <td className="p-3.5 text-slate-300">{row.appealDate}</td>
                    <td className="p-3.5 text-slate-300">{row.decisionDate}</td>
                    <td className="p-3.5 text-slate-300 max-w-xs truncate">{row.result}</td>
                    <td className="p-3.5 font-semibold text-slate-200">{row.status}</td>
                  </tr>
                ))}
                {filteredAppeals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500 italic">No appeal records found for current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSheet === "recovery_register" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/65 border-b border-slate-800 select-none">
                  <th className="p-3.5 pl-5 font-bold uppercase tracking-wider text-slate-400 text-[10px] font-mono">Case ID</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Total Demand Raised</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Amount Deleted / Settled</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Outstanding Controversy Balance</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Recovery Stage Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecovery.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="p-3.5 pl-5 font-bold font-mono text-amber-400">{row.caseId}</td>
                    <td className="p-3.5 font-mono text-white font-bold">PKR {row.demandRaised.toLocaleString()}</td>
                    <td className="p-3.5 font-mono text-emerald-400 font-bold">PKR {row.amountCleared.toLocaleString()}</td>
                    <td className="p-3.5 font-mono text-rose-400 font-bold">PKR {row.balance.toLocaleString()}</td>
                    <td className="p-3.5 text-slate-200 font-semibold">{row.status}</td>
                  </tr>
                ))}
                {filteredRecovery.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 italic">No recovery records found for current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSheet === "hearing_calendar" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/65 border-b border-slate-800 select-none">
                  <th className="p-3.5 pl-5 font-bold uppercase tracking-wider text-slate-400 text-[10px] font-mono">Case ID</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Next Scheduled Hearing</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Adjudication Forum</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Lead Legal Officer / Representative</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">Cause Sub-heading</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredHearing.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="p-3.5 pl-5 font-bold font-mono text-amber-400">{row.caseId}</td>
                    <td className="p-3.5 font-mono font-bold text-amber-405 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5 inline-block my-1">{row.nextHearingDate}</td>
                    <td className="p-3.5 font-bold text-slate-205">{row.forum}</td>
                    <td className="p-3.5 text-slate-300">{row.responsibleOfficer}</td>
                    <td className="p-3.5 text-slate-400 font-medium">{row.remarks}</td>
                  </tr>
                ))}
                {filteredHearing.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 italic">No future trial dates scheduled match filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
