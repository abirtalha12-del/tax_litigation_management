import React, { useState, useRef } from "react";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { AnalysisResponse, CaseChronologyEvent, CaseInformation, FinancialInformation, LitigationCase, OutcomeInformation, ProceedingsInformation } from "../types";

interface UploaderProps {
  onCommitCase: (newCase: LitigationCase, updatedExisting: boolean) => void;
  existingCases: LitigationCase[];
}

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setShowPastedBox(false);
      setRawPastedText("");
      setAnalysisResult(null);
      setErrorMsg("");
      setCommittedMsg("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setShowPastedBox(false);
      setRawPastedText("");
      setAnalysisResult(null);
      setErrorMsg("");
      setCommittedMsg("");
    }
  };

  const triggerFileAnalysis = async () => {
    if (file) {
      await analyzeSelectedFile(file);
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

          {/* Paste manual content box */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800/80 p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Manual Text Entry</h3>
            <p className="text-[10px] text-slate-450 leading-normal">
              Directly input or paste raw notification text, tribunal order transcripts, or audit findings to analyze.
            </p>
            <button
              type="button"
              onClick={() => {
                setRawPastedText("");
                setShowPastedBox(true);
                setFile(null);
                setErrorMsg("");
                setAnalysisResult(null);
              }}
              className="w-full py-2 px-4 bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-900 hover:border-slate-700 hover:text-amber-400 text-xs font-bold font-mono tracking-wide text-amber-500 transition cursor-pointer"
            >
              Paste Custom Text
            </button>
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

          {file && !analysisResult && !analyzing && !committedMsg && !showPastedBox && (
            <div className="bg-[#0f172a] rounded-3xl p-8 border border-slate-800 shadow-xl space-y-6 flex flex-col justify-between min-h-[460px] animate-fade-in">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Staged Document</h4>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Ready for extraction analysis</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-xs text-rose-450 hover:text-rose-400 font-semibold underline cursor-pointer hover:no-underline"
                  >
                    Clear File
                  </button>
                </div>

                <div className="bg-[#020617]/55 border border-slate-850 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">File Name:</span>
                    <span className="text-slate-200 font-mono font-bold truncate max-w-[280px]" title={file.name}>{file.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Size:</span>
                    <span className="text-slate-200 font-mono">{(file.size / 1024 / 1024).toFixed(3)} MB</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-slate-200 uppercase font-mono">{file.type || "unknown / external"}</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Expected Extraction Scope</h5>
                  <ul className="text-xs text-slate-350 space-y-2 pl-1 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Legal Identity, NTN & STRN identification
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Financial Audit exposure matrix calculation (demands, penalties, surcharges)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Dynamic proceeding chronology & critical calendar dates
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Department vs taxpayer positions & current status
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-[#091024]/60 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest font-mono">Confirmation Required</span>
                  <p className="text-xs text-slate-350 mt-0.5">Initialize intelligent analysis scan via Gemini model layers.</p>
                </div>
                <button
                  type="button"
                  onClick={triggerFileAnalysis}
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-amber-500/10 shrink-0"
                >
                  <Sparkles size={14} />
                  Analyze Document
                </button>
              </div>
            </div>
          )}

          {!file && !analysisResult && !analyzing && !committedMsg && !showPastedBox && (
            <div className="bg-[#0f172a] p-12 rounded-3xl border border-slate-800/80 shadow-3xs text-center flex flex-col items-center justify-center min-h-[460px] space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-full text-slate-500 mb-2">
                <FileText size={48} />
              </div>
              <div className="max-w-sm space-y-2">
                <h3 className="font-bold text-white text-base">Awaiting Litigation Document</h3>
                <p className="text-xs text-slate-450 leading-relaxed font-medium">
                  Drag and drop a PDF/Image of the taxpayer notice or use the custom text options on the left to initiate immediate metrics aggregation.
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
