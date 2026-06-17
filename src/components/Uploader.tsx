import React, { useState, useRef } from "react";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { AnalysisResponse, CaseChronologyEvent, CaseInformation, FinancialInformation, LitigationCase, OutcomeInformation, ProceedingsInformation } from "../types";

interface UploaderProps {
  onCommitCase: (newCase: LitigationCase, updatedExisting: boolean) => void;
  existingCases: LitigationCase[];
}

const SAMPLE_TEXTS = [
  {
    name: "FBR Notice Sec. 161 (Withholding Tax default)",
    text: `GOVERNMENT OF PAKISTAN
REVENUE DIVISION
LARGE TAXPAYERS OFFICE (LTO), LAHORE
No. LTO-WHT/2023/88921
Dated: 2023-09-12

SHOW CAUSE NOTICE UNDER SECTION 161 / 205
OF THE INCOME TAX ORDINANCE, 2001

To:
M/S Style Textile Mills Ltd
NTN: 2940182-4
STRN: 0300294018211
Address: 10-Kilometer, Multan Road, Lahore

TAX PERIOD: Tax Year 2023

WHEREAS on examination of your withholding tax statements and bank ledger accounts, it is observed that your company failed to deduct withholding tax on payments made to unregistered construction contractors for civil works on the weaving spinning unit during the period under tax year 2023. Total payments of Rs. 35,000,000 were released without deduction of 10% withholding tax.

THEREFORE, you are hereby called upon to show cause as to why withholding tax of Rs. 3,500,000 (Rupees Three Million Five Hundred Thousand) shouldn't be recovered from you under section 161. Additionally, a penalty of 5% (Rs. 175,000) under Section 182 and default surcharge of Rs. 420,000 under Section 205 is also calculated. Total financial default exposure is Rs. 4,095,000.

You are requested to reply by 2023-10-05. A personal hearing is scheduled on 2023-10-12 at Room 14, LTO, Lahore before the undersigned.

(MOHAMMAD SAFDAR)
Deputy Commissioner Inland Revenue (WHT)
LTO Lahore`
  },
  {
    name: "PRA Notice Sec. 11 (Punjab Service Sales Tax)",
    text: `OFFICE OF THE DEPUTY COMMISSIONER
PUNJAB REVENUE AUTHORITY (PRA)
84-Abu Bakar Block, Garden Town, Lahore
No. PRA-O-229/2024
Dated: 2024-02-18

NOTICE UNDER SECTION 11(2) OF THE PUNJAB SALES TAX ON SERVICES ACT 2012

Subject: COMPLIANCE STATUS ON TEXTILE DYEING AND PRINTING TARIFFS

Taxpayer Legal Identity:
Chenab Weaving & Finishing Pvt Ltd
NTN: 1482019-3
STRN: 0309148201915
Tax period: July 2023 to December 2023

AND WHEREAS it is noticed that the taxpayer had imported certain textile chemicals and booked dyeing services from third parties under provincial zero-rated regimes without registering actual invoice inputs under the proper provincial HS Code 9815.4000. 

IT IS APPARENT that a service sales tax on dyeing works is applicable at 16% on services worth Rs. 60,000,000, creating an unpaid sales tax service liability of Rs. 9,600,000. Default surcharge has been computed as Rs. 840,000 and penalty under section 48 is Rs. 480,000. Total exposure outstanding is Rs. 10,920,000.

YOU ARE DIRECTED to reply to this show cause notice on or before 2024-03-05. A first hearing is fixed for 2024-03-12, followed by a second hearing on 2024-03-18. Failure to represent will attract recovery proceedings on banking channels.

(AMARA KHAN)
Deputy Commissioner (Audit)
PRA Lahore`
  }
];

export default function Uploader({ onCommitCase, existingCases }: UploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [committedMsg, setCommittedMsg] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States to allow editing extracted fields before commitment
  const [editableCaseInfo, setEditableCaseInfo] = useState<Omit<CaseInformation, "caseId">>({
    taxpayerName: "",
    ntn: "",
    strn: "",
    taxPeriod: "",
    taxType: "Income Tax",
    relevantLegalSections: "",
    authorityForum: "",
    documentType: "",
    referenceNumber: "",
    documentDate: "",
  });

  const [editableFinancialInfo, setEditableFinancialInfo] = useState<FinancialInformation>({
    taxDemand: 0,
    penalty: 0,
    defaultSurcharge: 0,
    refundAmount: 0,
    totalExposure: 0
  });

  const [editableProceedingsInfo, setEditableProceedingsInfo] = useState<ProceedingsInformation>({
    dateOfNotice: "",
    dateOfReply: "",
    hearingDates: [],
    orderDate: "",
    appealDate: "",
    decisionDate: "",
    currentStage: "Show Cause Notice"
  });

  const [editableOutcomeInfo, setEditableOutcomeInfo] = useState<OutcomeInformation>({
    departmentPosition: "",
    taxpayerPosition: "",
    decisionSummary: "",
    reliefGranted: "",
    amountConfirmed: 0,
    amountDeleted: 0,
    amountRemanded: 0,
    currentStatus: "Open"
  });

  const [editableChronology, setEditableChronology] = useState<CaseChronologyEvent[]>([]);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [rawPastedText, setRawPastedText] = useState("");
  const [showPastedBox, setShowPastedBox] = useState(false);

  // Match existing records preview
  const getMatchingStatus = () => {
    if (!editableCaseInfo.referenceNumber) return null;
    const ref = editableCaseInfo.referenceNumber.trim().toLowerCase();
    const ntn = editableCaseInfo.ntn.trim().toLowerCase();
    
    // Attempt match
    const matched = existingCases.find(
      (c) => 
        (c.caseInfo.referenceNumber.trim().toLowerCase() === ref) ||
        (c.caseInfo.ntn.trim().toLowerCase() === ntn && c.caseInfo.taxPeriod.toLowerCase() === editableCaseInfo.taxPeriod.toLowerCase() && c.caseInfo.taxType === editableCaseInfo.taxType)
    );
    
    return matched ? { exists: true, id: matched.id, details: matched } : { exists: false };
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setShowPastedBox(false);
      setRawPastedText("");
      await analyzeSelectedFile(droppedFile);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setShowPastedBox(false);
      setRawPastedText("");
      await analyzeSelectedFile(selectedFile);
    }
  };

  const loadSampleText = (text: string) => {
    setRawPastedText(text);
    setShowPastedBox(true);
    setFile(null);
    setErrorMsg("");
  };

  const analyzeSelectedFile = async (currentFile: File) => {
    setAnalyzing(true);
    setErrorMsg("");
    setAnalysisResult(null);
    setCommittedMsg("");

    try {
      // Read file to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(currentFile);
      });
      const base64Data = await base64Promise;

      const payload = {
        fileName: currentFile.name,
        fileType: currentFile.type,
        base64Data: base64Data
      };

      const response = await fetch("/api/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const parsed = await response.json();

      if (!response.ok) {
        throw new Error(parsed.error || parsed.details || "Request failed");
      }

      populateDetails(parsed);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while analyzing the document with Gemini AI.");
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzePastedText = async () => {
    if (!rawPastedText.trim()) {
      setErrorMsg("Please paste some litigation content first.");
      return;
    }
    setAnalyzing(true);
    setErrorMsg("");
    setAnalysisResult(null);
    setCommittedMsg("");

    try {
      const payload = {
        textContent: rawPastedText
      };

      const response = await fetch("/api/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const parsed = await response.json();

      if (!response.ok) {
        throw new Error(parsed.error || parsed.details || "Request failed");
      }

      populateDetails(parsed);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while analyzing the raw text.");
    } finally {
      setAnalyzing(false);
    }
  };

  const populateDetails = (data: AnalysisResponse) => {
    setAnalysisResult(data);
    setEditableCaseInfo(data.caseInfo);
    setEditableFinancialInfo(data.financialInfo);
    setEditableProceedingsInfo(data.proceedingsInfo);
    setEditableOutcomeInfo(data.outcomeInfo);
    setEditableChronology(data.chronology || []);
    setValidationIssues(data.validationIssues || []);
  };

  const addHearingDate = () => {
    setEditableProceedingsInfo((prev) => ({
      ...prev,
      hearingDates: [...prev.hearingDates, ""]
    }));
  };

  const removeHearingDate = (index: number) => {
    setEditableProceedingsInfo((prev) => ({
      ...prev,
      hearingDates: prev.hearingDates.filter((_, i) => i !== index)
    }));
  };

  const updateHearingDateValue = (index: number, val: string) => {
    setEditableProceedingsInfo((prev) => {
      const copy = [...prev.hearingDates];
      copy[index] = val;
      return { ...prev, hearingDates: copy };
    });
  };

  const handleCommit = () => {
    // Generate case logic
    const matchingStatus = getMatchingStatus();
    let computedId = "";
    let isUpdate = false;

    if (matchingStatus && matchingStatus.exists && matchingStatus.id) {
      computedId = matchingStatus.id;
      isUpdate = true;
    } else {
      // Generate standard case ID
      const year = new Date().getFullYear();
      const serial = Math.floor(100 + Math.random() * 900);
      computedId = `CASE-${year}-${serial}`;
    }

    const compiledCase: LitigationCase = {
      id: computedId,
      caseInfo: {
        caseId: computedId,
        ...editableCaseInfo
      },
      financialInfo: {
        ...editableFinancialInfo,
        // Enforce exposure logic in the final DB write
        totalExposure: (editableFinancialInfo.taxDemand || 0) + (editableFinancialInfo.penalty || 0) + (editableFinancialInfo.defaultSurcharge || 0)
      },
      proceedingsInfo: editableProceedingsInfo,
      outcomeInfo: editableOutcomeInfo,
      chronology: editableChronology,
      updatedAt: new Date().toISOString(),
      sourceFiles: [file?.name || "Pasted_Litigation_Record.txt"]
    };

    onCommitCase(compiledCase, isUpdate);
    setCommittedMsg(isUpdate 
      ? `Case ${computedId} successfully merged & updated in Master Register!` 
      : `Case ${computedId} successfully recorded as a new litigation entry!`
    );
    // Reset file uploads or analyzed screen on user's content
    setAnalysisResult(null);
    setFile(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles size={28} className="text-amber-400 animate-pulse" />
          AI Document Docket Analysis
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload tax notifications, observations, or judgements to extract registers, logs, and calendar elements immediately.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Box (Left Column) */}
        <div className={`lg:col-span-4 space-y-6`}>
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[300px] transition group bg-[#0f172a] border-slate-800 hover:border-slate-700 shadow-3xs ${
              dragActive 
                ? "border-amber-500 bg-[#020617]/70" 
                : "hover:bg-[#090d16]/45"
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,.png,.jpg,.jpeg,.txt" 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <div className="bg-slate-950 p-4 rounded-full group-hover:bg-slate-900 border border-slate-850 transition text-slate-400 group-hover:text-amber-400 mb-4 ">
              <Upload size={32} />
            </div>
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{file.name}</p>
                <p className="text-xs text-slate-400 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-2 max-w-[250px]">
                <p className="text-sm font-semibold text-slate-205 leading-snug">Drag & drop tax dossier here</p>
                <p className="text-xs text-slate-450 leading-relaxed">Supports PDF, JPG, PNG, and plain-text files</p>
              </div>
            )}
            
            <div className="mt-6">
              <button 
                type="button"
                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 px-4 py-1.5 rounded-lg text-xs font-semibold select-none group-hover:border-amber-550/30 transition shadow"
              >
                Choose File
              </button>
            </div>
          </div>

          {/* Quick templates helper */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800/80 p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-450">Or Paste Pakistani SCN Sample</h3>
            <div className="flex flex-col gap-2">
              {SAMPLE_TEXTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => loadSampleText(sample.text)}
                  className="w-full text-left p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900 transition truncate text-xs font-semibold text-slate-305 flex items-center gap-2"
                >
                  <FileText size={14} className="text-slate-550 mr-1 shrink-0" />
                  {sample.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Work Area / Text Pasting Box or Processing Panel (Right Column) */}
        <div className="lg:col-span-8">
          {analyzing && (
            <div className="bg-[#0f172a] rounded-3xl p-12 border border-slate-850 shadow-3xs flex flex-col items-center justify-center min-h-[460px] space-y-4 animate-pulse">
              <Loader2 className="animate-spin text-amber-400" size={48} />
              <div className="text-center space-y-2 max-w-sm">
                <h3 className="font-bold text-white">Senior Tax Specialist scanning dossier...</h3>
                <p className="text-xs text-slate-400 leading-normal">Gemini AI fits litigation sections, compiles chronology math, and structures recovery entries dynamically...</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl text-rose-200 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-rose-400 shrink-0" />
                <h3 className="font-bold text-rose-300">Analysis Interrupt</h3>
              </div>
              <p className="text-xs leading-relaxed font-sans font-medium">{errorMsg}</p>
            </div>
          )}

          {committedMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl text-emerald-205 space-y-4 text-center py-12">
              <div className="flex justify-center">
                <CheckCircle className="text-emerald-400" size={56} />
              </div>
              <h3 className="font-extrabold text-white text-lg">{committedMsg}</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                All proceedings records, financial exposure matrices, and upcoming hearing alerts have been fully consolidated and persisted.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => setCommittedMsg("")}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs cursor-pointer inline-flex items-center gap-2 transition shadow-md"
                >
                  Acknowledge and proceed
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Show raw copy pasted box */}
          {showPastedBox && !analyzing && !analysisResult && !committedMsg && (
            <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-3xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-semibold text-white text-sm">Pasted Raw Pakistan Litigation Record</h3>
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded text-slate-400">Manual / Text entry</span>
              </div>
              <textarea
                value={rawPastedText}
                onChange={(e) => setRawPastedText(e.target.value)}
                className="w-full h-80 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 leading-relaxed bg-[#020617]/50 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
                placeholder="Paste SCN, Assessment Order, or Appeal judgements here..."
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPastedBox(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold hover:bg-slate-800 rounded-lg transition"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={analyzePastedText}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow"
                >
                  <Sparkles size={14} />
                  Analyze Text with Gemini AI
                </button>
              </div>
            </div>
          )}

          {!analysisResult && !analyzing && !committedMsg && !showPastedBox && (
            <div className="bg-[#0f172a] p-12 rounded-3xl border border-slate-800/80 shadow-3xs text-center flex flex-col items-center justify-center min-h-[460px] space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-full text-slate-500 mb-2">
                <FileText size={48} />
              </div>
              <div className="max-w-sm space-y-2">
                <h3 className="font-bold text-white text-base">Awaiting Litigation Document</h3>
                <p className="text-xs text-slate-450 leading-relaxed font-medium">
                  Drag a PDF/Image of the taxpayer notice, or select a sample textile taxpayer show cause notice on the left to start immediate litigation metrics aggregation.
                </p>
              </div>
            </div>
          )}

          {/* Analysis result & editor screen */}
          {analysisResult && !analyzing && !committedMsg && (
            <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-6 space-y-8 animate-fade-in shadow-xs">
              
              {/* Alert matched status */}
              {getMatchingStatus()?.exists && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3 text-amber-205">
                  <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-xs font-bold text-amber-400">Matching Dossier Located</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Notice reference <span className="font-mono text-white font-semibold block sm:inline">{editableCaseInfo.referenceNumber}</span> matches Case file <span className="font-mono text-amber-400 font-bold">{getMatchingStatus()?.id}</span> in master register. Saving this form will safely merge/update that case dossier's history & outcome.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded">Extracted Meta</span>
                  <h2 className="text-lg font-bold text-white mt-2">Litigation Docket Dossier</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAnalysisResult(null);
                      setFile(null);
                    }}
                    className="border border-slate-800 hover:bg-slate-800 px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 transition"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleCommit}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition"
                  >
                    <CheckCircle size={14} />
                    {getMatchingStatus()?.exists ? "Merge and Update master record" : "Commit to master register"}
                  </button>
                </div>
              </div>

              {/* Executive Briefing Upload Summary (Responsive Dashboard Card) */}
              <div className="bg-[#0b1329] border border-amber-500/20 rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <div className="bg-amber-500/10 p-1.5 rounded-lg">
                    <CheckCircle className="text-amber-400" size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#f8fafc]">
                      Executive Upload Summary
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Immediate high-level operational briefing of the parsed document
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Scope & Taxpayer info */}
                  <div className="bg-[#0c1630]/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Dossier Target</span>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {editableCaseInfo.taxpayerName || "Niagara Mills (PVT) Ltd"}
                      </span>
                      <span className="text-[11px] text-amber-400 font-medium block mt-0.5">
                        NTN: {editableCaseInfo.ntn || "N/A"} | STRN: {editableCaseInfo.strn || "N/A"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">
                        Tax Period: {editableCaseInfo.taxPeriod || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Financial exposure chips */}
                  <div className="bg-[#0c1630]/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Financial Exposure (PKR)</span>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Principal Tax:</span>
                        <span className="font-mono text-slate-200">PKR {editableFinancialInfo.taxDemand.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Penalties/Surcharge:</span>
                        <span className="font-mono text-slate-300">PKR {(editableFinancialInfo.penalty + editableFinancialInfo.defaultSurcharge).toLocaleString()}</span>
                      </div>
                      <div className="h-px bg-slate-850 my-1" />
                      <div className="flex justify-between items-center font-bold text-amber-400 text-xs">
                        <span>Net Exposure:</span>
                        <span className="font-mono">PKR {editableFinancialInfo.totalExposure.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational status & dates */}
                  <div className="bg-[#0c1630]/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Operational Docket Summary</span>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Document Date:</span>
                        <span className="text-[11px] font-semibold text-slate-200 font-mono">{editableCaseInfo.documentDate || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Current Stage:</span>
                        <span className="text-[11px] font-bold text-slate-200">{editableProceedingsInfo.currentStage || "Show Cause Notice"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Status:</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {editableOutcomeInfo.currentStatus || "Open"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Brief Paragraph Summaries */}
                <div className="bg-[#0c1630]/60 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs text-slate-300 leading-relaxed">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400 block mb-0.5">Assessing Forum Allegations</span>
                    <p className="italic text-slate-200">
                      "{editableOutcomeInfo.departmentPosition || "The assessing officer raised procedural questions on transaction records, proposing demand of tax liabilities along with penalties."}"
                    </p>
                  </div>
                  <div className="h-px bg-slate-800/50 my-1" />
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 block mb-0.5">Taxpayer Core Action Plan</span>
                    <p className="italic text-slate-200">
                      "{editableOutcomeInfo.taxpayerPosition || "We contend all transactions conform fully with the provisions of Pakistani Tax laws, and are filing written rejoinders detailing proof."}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Editable forms */}
              <div className="space-y-6">
                
                {/* 1. Case Information */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-400 block border-b border-slate-800 pb-2">1. Case Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Taxpayer Name</label>
                      <input
                        type="text"
                        value={editableCaseInfo.taxpayerName}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, taxpayerName: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">National Tax Number (NTN)</label>
                      <input
                        type="text"
                        value={editableCaseInfo.ntn}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, ntn: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Sales Tax Reg. Number (STRN)</label>
                      <input
                        type="text"
                        value={editableCaseInfo.strn}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, strn: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Tax Period / Year</label>
                      <input
                        type="text"
                        value={editableCaseInfo.taxPeriod}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, taxPeriod: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Tax Type</label>
                      <select
                        value={editableCaseInfo.taxType}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, taxType: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-550 [&>option]:bg-[#0f172a] [&>option]:text-white"
                      >
                        <option value="Income Tax">Income Tax</option>
                        <option value="Sales Tax">Sales Tax</option>
                        <option value="PRA Sales Tax">PRA Sales Tax</option>
                        <option value="SRB Sales Tax">SRB Sales Tax</option>
                        <option value="Customs Duty">Customs Duty</option>
                        <option value="FED">FED</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Authority / Forum</label>
                      <input
                        type="text"
                        value={editableCaseInfo.authorityForum}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, authorityForum: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Relevant Legal Sections</label>
                      <input
                        type="text"
                        value={editableCaseInfo.relevantLegalSections}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, relevantLegalSections: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Document Type</label>
                      <input
                        type="text"
                        value={editableCaseInfo.documentType}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, documentType: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Notice / Reference Number</label>
                      <input
                        type="text"
                        value={editableCaseInfo.referenceNumber}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, referenceNumber: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Document Date</label>
                      <input
                        type="text"
                        value={editableCaseInfo.documentDate}
                        onChange={(e) => setEditableCaseInfo({ ...editableCaseInfo, documentDate: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Financial Information */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-400 block border-b border-slate-800 pb-2">2. Financial Exposure (PKR)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Tax Demand Principal</label>
                      <input
                        type="number"
                        value={editableFinancialInfo.taxDemand}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditableFinancialInfo({ 
                             ...editableFinancialInfo, 
                            taxDemand: val,
                            totalExposure: val + editableFinancialInfo.penalty + editableFinancialInfo.defaultSurcharge
                          });
                        }}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Penalty levied</label>
                      <input
                        type="number"
                        value={editableFinancialInfo.penalty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditableFinancialInfo({ 
                             ...editableFinancialInfo, 
                            penalty: val,
                            totalExposure: editableFinancialInfo.taxDemand + val + editableFinancialInfo.defaultSurcharge
                          });
                        }}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Default Surcharge</label>
                      <input
                        type="number"
                        value={editableFinancialInfo.defaultSurcharge}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditableFinancialInfo({ 
                            ...editableFinancialInfo, 
                            defaultSurcharge: val,
                            totalExposure: editableFinancialInfo.taxDemand + editableFinancialInfo.penalty + val
                          });
                        }}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Refund Claim (if applicable)</label>
                      <input
                        type="number"
                        value={editableFinancialInfo.refundAmount}
                        onChange={(e) => setEditableFinancialInfo({ ...editableFinancialInfo, refundAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Total Controversy Exposure (Locked)</label>
                      <div className="w-full border border-slate-800 bg-[#020617] rounded-lg p-2 text-xs text-amber-400 font-bold font-mono text-base shadow-inner">
                        PKR {((editableFinancialInfo.taxDemand || 0) + (editableFinancialInfo.penalty || 0) + (editableFinancialInfo.defaultSurcharge || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Proceedings and Timeline info */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-400 block border-b border-slate-800 pb-2">3. Proceedings Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Date of Notice</label>
                      <input
                        type="text"
                        value={editableProceedingsInfo.dateOfNotice}
                        onChange={(e) => setEditableProceedingsInfo({ ...editableProceedingsInfo, dateOfNotice: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Date of Reply Filing</label>
                      <input
                        type="text"
                        value={editableProceedingsInfo.dateOfReply}
                        onChange={(e) => setEditableProceedingsInfo({ ...editableProceedingsInfo, dateOfReply: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                        placeholder="N/A or Pending Reply"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Current Stage of controversy</label>
                      <input
                        type="text"
                        value={editableProceedingsInfo.currentStage}
                        onChange={(e) => setEditableProceedingsInfo({ ...editableProceedingsInfo, currentStage: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Order Date (if ONO/OIA passed)</label>
                      <input
                        type="text"
                        value={editableProceedingsInfo.orderDate}
                        onChange={(e) => setEditableProceedingsInfo({ ...editableProceedingsInfo, orderDate: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
                        placeholder="Pending adjudication"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-slate-400">Upcoming Hearing Calendar Dates</label>
                        <button
                          type="button"
                          onClick={addHearingDate}
                          className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 px-2.5 py-1 rounded font-bold transition cursor-pointer"
                        >
                          + Add Hearing Date
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {editableProceedingsInfo.hearingDates.map((date, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 border border-slate-800 bg-slate-950/40 p-1.5 rounded-lg">
                            <input
                              type="text"
                              value={date}
                              placeholder="YYYY-MM-DD"
                              onChange={(e) => updateHearingDateValue(idx, e.target.value)}
                              className="border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-105 bg-slate-900 focus:outline-none focus:border-amber-500/80 flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => removeHearingDate(idx)}
                              className="text-rose-500 hover:text-rose-400 font-extrabold text-xs p-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {editableProceedingsInfo.hearingDates.length === 0 && (
                          <p className="text-xs text-slate-500 capitalize col-span-2 sm:col-span-3 italic py-2 font-medium">No hearing dates defined</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Outcomes Positions */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-400 block border-b border-slate-800 pb-2">4. Positions & Outcomes</h3>
                  <div className="grid grid-cols-1 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Department Charge / Position Statement</label>
                      <textarea
                        value={editableOutcomeInfo.departmentPosition}
                        onChange={(e) => setEditableOutcomeInfo({ ...editableOutcomeInfo, departmentPosition: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 h-16 resize-y focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Taxpayer/Enterprise Legal Defense Stance</label>
                      <textarea
                        value={editableOutcomeInfo.taxpayerPosition}
                        onChange={(e) => setEditableOutcomeInfo({ ...editableOutcomeInfo, taxpayerPosition: e.target.value })}
                        className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 h-16 resize-y focus:outline-none focus:border-amber-500/80"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Adjudication / Decision Summary</label>
                        <textarea
                          value={editableOutcomeInfo.decisionSummary}
                          onChange={(e) => setEditableOutcomeInfo({ ...editableOutcomeInfo, decisionSummary: e.target.value })}
                          className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 h-20 focus:outline-none focus:border-amber-500/80"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Quantum Relief Details</label>
                        <textarea
                          value={editableOutcomeInfo.reliefGranted}
                          onChange={(e) => setEditableOutcomeInfo({ ...editableOutcomeInfo, reliefGranted: e.target.value })}
                          className="w-full bg-[#020617]/50 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 h-20 focus:outline-none focus:border-amber-505 placeholder:text-slate-600"
                          placeholder="e.g., Confirmed Rs. 5M, Deleted Rs. 10M"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation and Chronology Logs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-800">
                  {/* Generated Chronology */}
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-amber-400 mb-3 block">5. Chronological Sequence</h4>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto border border-slate-800 bg-slate-950/20 p-4 rounded-xl">
                      {editableChronology.map((event, idx) => (
                        <div key={idx} className="relative pl-4 border-l-2 border-slate-800 pb-3 last:pb-0">
                          <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-550 border border-slate-900" />
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-950 px-1.5 border border-slate-800 rounded">
                              {event.date}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white mt-1 leading-snug">{event.event}</p>
                          <p className="text-[10px] text-slate-450 font-semibold truncate mt-0.5">{event.authority} • Ref:{event.referenceNo}</p>
                          <p className="text-xs text-slate-350 mt-1.5 font-medium leading-relaxed">{event.summary}</p>
                        </div>
                      ))}
                      {editableChronology.length === 0 && (
                        <p className="text-xs text-slate-500 italic py-4">No chronological events extracted.</p>
                      )}
                    </div>
                  </div>

                  {/* Gemini validation check results */}
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-amber-400 mb-3 block">6. FBR/PRA Integrity Validation Issues</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {validationIssues.map((issue, idx) => (
                        <div key={idx} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 flex items-start gap-2">
                          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-xs leading-normal font-sans font-medium">{issue}</span>
                        </div>
                      ))}
                      {validationIssues.length === 0 && (
                        <div className="p-12 text-center bg-emerald-500/10 rounded-xl border border-dashed border-emerald-500/20">
                          <p className="text-xs text-emerald-400 font-semibold">No logical discrepancies detected.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
