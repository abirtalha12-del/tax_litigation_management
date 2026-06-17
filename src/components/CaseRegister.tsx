import React, { useState } from "react";
import { LitigationCase } from "../types";
import { Calendar, ChevronDown, ChevronUp, Edit2, FileDown, Landmark, Plus, Search, Trash2, Eye, Info, Database, Filter } from "lucide-react";
import MasterFileImporter from "./MasterFileImporter";
import { downloadManagementCaseSummary } from "../utils/docxGenerator";

interface CaseRegisterProps {
  cases: LitigationCase[];
  onSelectCase: (caseId: string) => void;
  onEditCase: (c: LitigationCase) => void;
  onDeleteCase: (caseId: string) => void;
  onAddCase: (c: LitigationCase) => void;
  onImportCases: (imported: LitigationCase[], isMerge: boolean) => void;
}

export default function CaseRegister({ cases, onSelectCase, onEditCase, onDeleteCase, onAddCase, onImportCases }: CaseRegisterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTaxType, setFilterTaxType] = useState("All");
  const [filterForum, setFilterForum] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  // Specific user targeted search and filter bar states
  const [filterTaxpayer, setFilterTaxpayer] = useState("");
  const [filterNtn, setFilterNtn] = useState("");
  const [filterStage, setFilterStage] = useState("All");

  const [showImporter, setShowImporter] = useState(false);

  // Manual Add Case Modal/Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCase, setNewCase] = useState<Partial<LitigationCase>>({
    caseInfo: {
      caseId: "",
      taxpayerName: "",
      ntn: "",
      strn: "",
      taxPeriod: "Tax Year 2024",
      taxType: "Income Tax",
      relevantLegalSections: "",
      authorityForum: "FBR",
      documentType: "Show Cause Notice (SCN)",
      referenceNumber: "",
      documentDate: new Date().toISOString().split('T')[0],
    },
    financialInfo: {
      taxDemand: 0,
      penalty: 0,
      defaultSurcharge: 0,
      refundAmount: 0,
      totalExposure: 0
    },
    proceedingsInfo: {
      dateOfNotice: new Date().toISOString().split('T')[0],
      dateOfReply: "",
      hearingDates: [],
      orderDate: "",
      appealDate: "",
      decisionDate: "",
      currentStage: "Show Cause Notice"
    },
    outcomeInfo: {
      departmentPosition: "",
      taxpayerPosition: "",
      decisionSummary: "",
      reliefGranted: "",
      amountConfirmed: 0,
      amountDeleted: 0,
      amountRemanded: 0,
      currentStatus: "Open"
    },
    chronology: []
  });

  // Expandable row state (chronology display)
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

  // Filter calculations
  const taxTypes = ["All", ...Array.from(new Set(cases.map((c) => c.caseInfo.taxType).filter(Boolean)))];
  const forums = ["All", ...Array.from(new Set(cases.map((c) => {
    const forum = c.caseInfo.authorityForum;
    if (!forum) return "FBR";
    if (forum.includes("FBR") || forum.includes("Federal")) return "FBR";
    if (forum.includes("PRA") || forum.includes("Punjab")) return "PRA";
    return forum;
  })))];
  const statuses = ["All", "Open", "Closed", "Active Appeal", "Under Review"];
  
  // Dynamic extraction of unique proceedings stages from dockets
  const stagesList = ["All", ...Array.from(new Set(cases.map((c) => c.proceedingsInfo?.currentStage).filter(Boolean)))];

  const filteredCases = cases.filter((c) => {
    // 1. Global text search match query
    const matchesSearch = 
      !searchQuery ||
      c.caseInfo.taxpayerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseInfo.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseInfo.ntn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseInfo.relevantLegalSections.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Targeted user requested filters: Taxpayer Name, NTN, and Current Stage
    const matchesTargetTaxpayer = !filterTaxpayer || c.caseInfo.taxpayerName.toLowerCase().includes(filterTaxpayer.toLowerCase());
    const matchesTargetNtn = !filterNtn || c.caseInfo.ntn.toLowerCase().includes(filterNtn.toLowerCase());
    const matchesTargetStage = filterStage === "All" || c.proceedingsInfo.currentStage === filterStage;

    // 3. Category drop-down selectors
    const matchesTaxType = filterTaxType === "All" || c.caseInfo.taxType === filterTaxType;
    
    const matchesForum = filterForum === "All" || 
      (filterForum === "FBR" && (c.caseInfo.authorityForum.includes("FBR") || c.caseInfo.authorityForum.includes("Federal"))) ||
      (filterForum === "PRA" && (c.caseInfo.authorityForum.includes("PRA") || c.caseInfo.authorityForum.includes("Punjab"))) ||
      c.caseInfo.authorityForum === filterForum;

    const matchesStatus = filterStatus === "All" || 
      (filterStatus === "Open" && c.outcomeInfo.currentStatus.toLowerCase() !== "closed") ||
      (filterStatus === "Closed" && c.outcomeInfo.currentStatus.toLowerCase() === "closed") ||
      c.outcomeInfo.currentStatus.toLowerCase().includes(filterStatus.toLowerCase());

    return matchesSearch && matchesTargetTaxpayer && matchesTargetNtn && matchesTargetStage && matchesTaxType && matchesForum && matchesStatus;
  });

  // Calculate exposures on filtered list
  const filteredExposure = filteredCases.reduce((acc, c) => acc + (c.financialInfo.totalExposure || 0), 0);

  const toggleRow = (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
    } else {
      setExpandedCaseId(caseId);
    }
  };

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    const year = new Date().getFullYear();
    const serial = Math.floor(100 + Math.random() * 900);
    const computedId = `CASE-${year}-${serial}`;

    const completedCase: LitigationCase = {
      id: computedId,
      caseInfo: {
        ...(newCase.caseInfo as any),
        caseId: computedId
      },
      financialInfo: {
        ...(newCase.financialInfo as any),
        totalExposure: (newCase.financialInfo?.taxDemand || 0) + (newCase.financialInfo?.penalty || 0) + (newCase.financialInfo?.defaultSurcharge || 0)
      },
      proceedingsInfo: newCase.proceedingsInfo as any,
      outcomeInfo: newCase.outcomeInfo as any,
      chronology: [
        {
          date: newCase.caseInfo?.documentDate || "",
          event: "Dossier Logged",
          authority: newCase.caseInfo?.authorityForum || "Internal",
          referenceNo: newCase.caseInfo?.referenceNumber || "N/A",
          summary: "Initial manual loading of controversy record."
        }
      ],
      updatedAt: new Date().toISOString(),
      sourceFiles: ["Manual Register Interface"]
    };

    onAddCase(completedCase);
    setShowAddForm(false);
    // Reset form
    setNewCase({
      caseInfo: {
        caseId: "",
        taxpayerName: "",
        ntn: "",
        strn: "",
        taxPeriod: "Tax Year 2024",
        taxType: "Income Tax",
        relevantLegalSections: "",
        authorityForum: "FBR",
        documentType: "Show Cause Notice (SCN)",
        referenceNumber: "",
        documentDate: new Date().toISOString().split('T')[0],
      },
      financialInfo: {
        taxDemand: 0,
        penalty: 0,
        defaultSurcharge: 0,
        refundAmount: 0,
        totalExposure: 0
      },
      proceedingsInfo: {
        dateOfNotice: new Date().toISOString().split('T')[0],
        dateOfReply: "",
        hearingDates: [],
        orderDate: "",
        appealDate: "",
        decisionDate: "",
        currentStage: "Show Cause Notice"
      },
      outcomeInfo: {
        departmentPosition: "",
        taxpayerPosition: "",
        decisionSummary: "",
        reliefGranted: "",
        amountConfirmed: 0,
        amountDeleted: 0,
        amountRemanded: 0,
        currentStatus: "Open"
      },
      chronology: []
    });
  };

  const getStatusBadge = (status: string) => {
    const norm = status.toLowerCase();
    if (norm === "closed" || norm.includes("withdrawn") || norm.includes("concluded")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (norm.includes("relief") || norm.includes("stay")) {
      return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    }
    if (norm.includes("appeal") || norm.includes("hearing") || norm === "open") {
      return "bg-amber-500/10 text-amber-450 border-amber-500/20";
    }
    return "bg-slate-850 text-slate-300 border-slate-800";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
            Litigation Master Registers
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-sans">
            Manage comprehensive taxpayer dossiers, legal grounds, and chronological proceeding event chains.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 mt-2 md:mt-0">
          <button
            onClick={() => setShowImporter(!showImporter)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border cursor-pointer transition duration-200 ${
              showImporter
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-855 hover:border-slate-700"
            }`}
            title="Import/Reload master database files"
          >
            <Database size={15} />
            Database Wizard
          </button>
          
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs cursor-pointer transition duration-240"
          >
            <Plus size={16} />
            Add Register Entry
          </button>
        </div>
      </div>

      {/* Render the Master Importer helper dynamically when toggled */}
      {showImporter && (
        <div className="animate-slide-down">
          <MasterFileImporter
            onImportCases={(imported, isMerge) => {
              onImportCases(imported, isMerge);
              setShowImporter(false);
            }}
            existingCount={cases.length}
          />
        </div>
      )}

      {/* Grid search and filters block */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800/80 p-5 shadow-3xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2 relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search globally by reference, legal clause, or docket ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-amber-500/80 focus:bg-[#020617]/80 text-slate-100 placeholder:text-slate-500 transition"
            />
          </div>

          <div>
            <select
              value={filterTaxType}
              onChange={(e) => setFilterTaxType(e.target.value)}
              className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/80 [&>option]:bg-[#0f172a] [&>option]:text-white"
            >
              <option value="All">All Tax Categories</option>
              {taxTypes.filter(t => t !== "All").map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/80 [&>option]:bg-[#0f172a] [&>option]:text-white"
            >
              <option value="All">All Statuses</option>
              {statuses.filter(s => s !== "All").map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dedicated targeted search & filter fields (Mandated Specific Search) */}
        <div className="border-t border-slate-800/60 pt-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">
            Targeted Specific Search & Filters
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Specific Taxpayer Name input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">
                <Filter size={13} className="text-amber-500/70" />
              </span>
              <input
                type="text"
                placeholder="Filter by Taxpayer Name..."
                value={filterTaxpayer}
                onChange={(e) => setFilterTaxpayer(e.target.value)}
                className="w-full bg-[#020617]/55 border border-slate-805 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-amber-500/80 text-white placeholder:text-slate-500 transition"
              />
            </div>

            {/* 2. Specific NTN filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 pointer-events-none">
                <span className="text-[9px] font-bold font-mono text-amber-500/70">NTN</span>
              </span>
              <input
                type="text"
                placeholder="Filter by NTN (numbers & hyphens)..."
                value={filterNtn}
                onChange={(e) => setFilterNtn(e.target.value)}
                className="w-full bg-[#020617]/55 border border-slate-805 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-amber-500/80 text-white font-mono placeholder:text-slate-500 transition"
              />
            </div>

            {/* 3. Current Proceedings Stage Select list */}
            <div>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="w-full bg-[#020617]/55 border border-slate-805 rounded-lg p-2 text-xs text-slate-205 focus:outline-none focus:border-amber-505 [&>option]:bg-[#0f172a] [&>option]:text-white"
              >
                <option value="All">All Proceeding Stages (Current)</option>
                {stagesList.filter(s => s !== "All").map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic statistics metrics strip */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#020617]/50 px-4 py-3 rounded-xl border border-slate-800/80 gap-2">
          <span className="text-xs text-slate-400 font-sans">
            Showing <strong className="text-white font-semibold">{filteredCases.length}</strong> of {cases.length} litigation folders
          </span>
          <span className="text-xs text-slate-400 font-sans">
            Disputed Exposure in View: <strong className="text-amber-400 font-bold font-mono">PKR {filteredExposure.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {/* Registers Grid View */}
      <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-3xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/65 select-none">
                <th className="py-3.5 px-5 text-[11px] font-bold text-slate-450 uppercase tracking-wider font-mono">Case ID</th>
                <th className="py-3.5 px-4 text-[11px] font-bold text-slate-450 uppercase tracking-wider">Taxpayer Identity</th>
                <th className="py-3.5 px-4 text-[11px] font-bold text-slate-450 uppercase tracking-wider">Forum / Code</th>
                <th className="py-3.5 px-4 text-[11px] font-bold text-slate-450 uppercase tracking-wider">Category</th>
                <th className="py-3.5 px-4 text-[11px] font-bold text-slate-450 uppercase tracking-wider ">Demands Exposure</th>
                <th className="py-3.5 px-4 text-[11px] font-bold text-slate-450 uppercase tracking-wider">Current Stage</th>
                <th className="py-3.5 px-4 text-[11px] font-bold text-slate-450 uppercase tracking-wider">Dossier Status</th>
                <th className="py-3.5 px-5 text-[11px] font-bold text-slate-450 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredCases.map((c) => {
                const isExpanded = expandedCaseId === c.id;
                return (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-slate-900/40 transition group">
                      <td className="py-4 px-5 font-mono font-bold text-amber-400">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c.id)}
                          className="hover:underline hover:text-amber-350 text-left font-bold"
                        >
                          {c.id}
                        </button>
                      </td>
                      <td className="py-4 px-4 font-sans font-medium text-white">
                        <div className="max-w-[200px]">
                          <span className="block font-bold leading-normal truncate">{c.caseInfo.taxpayerName}</span>
                          <span className="block text-[10px] text-slate-450 font-mono mt-0.5">NTN: {c.caseInfo.ntn}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-sans text-slate-205">
                        <div className="max-w-[150px]">
                          <span className="block font-semibold truncate text-[11px]">{c.caseInfo.authorityForum}</span>
                          <span className="block text-[10px] text-slate-450 leading-normal truncate mt-0.5">{c.caseInfo.referenceNumber}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                          {c.caseInfo.taxType}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-white">
                        PKR {c.financialInfo.totalExposure.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-slate-300 font-medium">
                        {c.proceedingsInfo.currentStage}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block border px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(c.outcomeInfo.currentStatus)}`}>
                          {c.outcomeInfo.currentStatus}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(c.id);
                            }}
                            title="Chronology Event Sequence"
                            className="p-1 px-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCase(c.id);
                            }}
                            title="Interactive Dossier Viewer"
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadManagementCaseSummary(c);
                            }}
                            title="Download Word Case Summary (.doc)"
                            className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 transition"
                          >
                            <FileDown size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCase(c);
                            }}
                            title="Direct Register Modification"
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCase(c.id);
                            }}
                            title="Expunge Record"
                            className="p-1.5 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Timeline Collapsible Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-[#020617]/50 p-6 border-b border-slate-800">
                          <div className="max-w-4xl space-y-4">
                            <div className="flex items-center gap-2">
                              <Landmark size={15} className="text-slate-400" />
                              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider font-sans">
                                Complete Legal Chronology: {c.id}
                              </h4>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                              {/* Left column brief notes */}
                              <div className="md:col-span-4 p-4 bg-[#0f172a] border border-slate-800/80 rounded-xl space-y-3 shadow-3xs">
                                <div>
                                  <span className="text-[10px] text-amber-400 font-bold block uppercase tracking-wider">Legal Sections</span>
                                  <p className="text-xs font-semibold text-slate-200 mt-0.5">{c.caseInfo.relevantLegalSections || "N/A"}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-amber-400 font-bold block uppercase tracking-wider">Department Charge</span>
                                  <p className="text-xs text-slate-350 mt-1 leading-relaxed font-sans font-medium">{c.outcomeInfo.departmentPosition || "N/A"}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-amber-400 font-bold block uppercase tracking-wider">Enterprise Defense</span>
                                  <p className="text-xs text-slate-350 mt-1 leading-relaxed font-sans font-medium">{c.outcomeInfo.taxpayerPosition || "N/A"}</p>
                                </div>
                              </div>

                              {/* Right column sequence timeline */}
                              <div className="md:col-span-8 space-y-3.5 max-h-[300px] overflow-y-auto pr-2">
                                {c.chronology && c.chronology.length > 0 ? (
                                  c.chronology.map((event, idx) => (
                                    <div key={idx} className="relative pl-5 border-l-2 border-slate-800 pb-3 last:pb-0 font-sans">
                                      <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-slate-900" />
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                        <span className="text-[9px] font-mono font-bold bg-slate-950 text-slate-300 border border-slate-800 px-1.5 py-0.5 rounded shrink-0 self-start">
                                          {event.date}
                                        </span>
                                        <span className="text-[10px] text-slate-450 font-semibold truncate">Ref: {event.referenceNo}</span>
                                      </div>
                                      <h5 className="text-xs font-bold text-white mt-1">{event.event}</h5>
                                      <p className="text-[10px] text-slate-450 font-bold">{event.authority}</p>
                                      <p className="text-xs text-slate-355 leading-normal mt-1 font-medium">{event.summary}</p>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-slate-500 italic">No chronology timeline events found for this index.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-505 dark:text-slate-450">
                    <p className="text-sm text-slate-400 italic">No litigation dockets found matching the filter query.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Case Modal Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-6 max-w-3xl w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto my-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Add Manual Litigation Folder</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-white font-bold p-1 text-base transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-6">
              {/* Case Information fields */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">1. Case Dossier Identifiers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Taxpayer Enterprise legal name</label>
                    <input
                      type="text"
                      required
                      value={newCase.caseInfo?.taxpayerName}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        caseInfo: { ...newCase.caseInfo!, taxpayerName: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                      placeholder="e.g. Chenab Weaving Co"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">National Tax Number (NTN)</label>
                    <input
                      type="text"
                      required
                      value={newCase.caseInfo?.ntn}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        caseInfo: { ...newCase.caseInfo!, ntn: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500/80 transition"
                      placeholder="e.g. 1234567-8"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Sales Tax Reg Number (STRN)</label>
                    <input
                      type="text"
                      value={newCase.caseInfo?.strn}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        caseInfo: { ...newCase.caseInfo!, strn: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500/80 transition"
                      placeholder="e.g. 0300123456711"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Tax Period</label>
                    <input
                      type="text"
                      required
                      value={newCase.caseInfo?.taxPeriod}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        caseInfo: { ...newCase.caseInfo!, taxPeriod: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                      placeholder="e.g. Tax Year 2024"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Levy Jurisdiction</label>
                    <select
                      value={newCase.caseInfo?.taxType}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        caseInfo: { ...newCase.caseInfo!, taxType: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 [&>option]:bg-[#0f172a] [&>option]:text-white transition"
                    >
                      <option value="Income Tax">Income Tax</option>
                      <option value="Sales Tax">Sales Tax</option>
                      <option value="PRA Sales Tax">PRA Sales Tax</option>
                      <option value="Customs Duty">Customs Duty</option>
                      <option value="FED">FED</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Forum Authority</label>
                    <input
                      type="text"
                      required
                      value={newCase.caseInfo?.authorityForum}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        caseInfo: { ...newCase.caseInfo!, authorityForum: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                      placeholder="e.g. FBR, LTO Lahore, PRA"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Official Reference Number</label>
                    <input
                      type="text"
                      required
                      value={newCase.caseInfo?.referenceNumber}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        caseInfo: { ...newCase.caseInfo!, referenceNumber: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                      placeholder="e.g. SCN-LTO-WHT/2024"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Document Date</label>
                    <input
                      type="date"
                      required
                      value={newCase.caseInfo?.documentDate}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        caseInfo: { ...newCase.caseInfo!, documentDate: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Financial exposures fields */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">2. Financial Exposure (PKR)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Tax Claim Principal</label>
                    <input
                      type="number"
                      value={newCase.financialInfo?.taxDemand}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        financialInfo: { ...newCase.financialInfo!, taxDemand: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Compliance Penalties</label>
                    <input
                      type="number"
                      value={newCase.financialInfo?.penalty}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        financialInfo: { ...newCase.financialInfo!, penalty: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Default Surcharge estimate</label>
                    <input
                      type="number"
                      value={newCase.financialInfo?.defaultSurcharge}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        financialInfo: { ...newCase.financialInfo!, defaultSurcharge: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Proceedings and Outcome status */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">3. Current Status & Legal Positions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Current Proceedings Stage</label>
                    <input
                      type="text"
                      required
                      value={newCase.proceedingsInfo?.currentStage}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        proceedingsInfo: { ...newCase.proceedingsInfo!, currentStage: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition"
                      placeholder="e.g. SCN Issued, Hearings ongoing"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Dossier Status</label>
                    <select
                      value={newCase.outcomeInfo?.currentStatus}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        outcomeInfo: { ...newCase.outcomeInfo!, currentStatus: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 [&>option]:bg-[#0f172a] [&>option]:text-white transition"
                    >
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                      <option value="Active Appeal">Active Appeal</option>
                      <option value="Stay Granted">Stay Granted</option>
                      <option value="Under Review">Under Review</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Charge/Position summary</label>
                    <textarea
                      value={newCase.outcomeInfo?.departmentPosition}
                      onChange={(e) => setNewCase({
                        ...newCase,
                        outcomeInfo: { ...newCase.outcomeInfo!, departmentPosition: e.target.value }
                      })}
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded p-2 text-xs text-slate-100 h-16 focus:outline-none focus:border-amber-500/80 transition"
                      placeholder="Describe the main allegation or audit finding..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-900 rounded-xl text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Save Dossier Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
