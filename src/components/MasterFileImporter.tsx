import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, AlertTriangle, CheckCircle, HelpCircle, FileText, Check, Database, RefreshCw, Layers } from "lucide-react";
import { LitigationCase, CaseChronologyEvent } from "../types";

interface MasterFileImporterProps {
  onImportCases: (imported: LitigationCase[], isMerge: boolean) => void;
  existingCount: number;
}

export default function MasterFileImporter({ onImportCases, existingCount }: MasterFileImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isExcel, setIsExcel] = useState(false);
  const [isJson, setIsJson] = useState(false);
  const [isMerge, setIsMerge] = useState(true); // true = merge, false = replace
  const [parsing, setParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [parsedCases, setParsedCases] = useState<LitigationCase[]>([]);
  const [eventCount, setEventCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg("");
    setSuccessMsg("");
    setParsedCases([]);
    setEventCount(0);

    const name = selectedFile.name.toLowerCase();
    if (name.endsWith(".json")) {
      setIsJson(true);
      setIsExcel(false);
      parseJsonFile(selectedFile);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      setIsExcel(true);
      setIsJson(false);
      parseExcelFile(selectedFile);
    } else {
      setErrorMsg("Unsupported file format. Please upload a structured Excel Workbook (.xlsx, .xls) or a backup JSON file.");
      setFile(null);
    }
  };

  const parseJsonFile = (jsonFile: File) => {
    setParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          // Basic validation for structure
          const valid = data.every(item => item && typeof item === "object" && item.id && item.caseInfo && item.financialInfo);
          if (valid) {
            setParsedCases(data);
            const totalChronologies = data.reduce((sum, c) => sum + (c.chronology?.length || 0), 0);
            setEventCount(totalChronologies);
          } else {
            setErrorMsg("The JSON master file structural validation failed. Please ensure it is a valid backup of litigation dossiers.");
          }
        } else {
          setErrorMsg("JSON master file must contain an array of litigation case dossiers.");
        }
      } catch (err: any) {
        setErrorMsg(`Failed to parse JSON file: ${err.message}`);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsText(jsonFile);
  };

  const parseExcelFile = (excelFile: File) => {
    setParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Let's list all worksheets
        const sheetNames = workbook.SheetNames;
        
        // 1. Parse Case Register (prefer sheet named "Case Register" or use the first worksheet)
        const caseRegisterSheetName = sheetNames.find(n => n.toLowerCase().trim() === "case register") || sheetNames[0];
        const caseRegisterSheet = workbook.Sheets[caseRegisterSheetName];
        const rawCaseRows = XLSX.utils.sheet_to_json<any>(caseRegisterSheet);

        // 2. Parse Proceedings Log Sheet if exists to reconstruct chronology
        const proceedingsSheetName = sheetNames.find(n => n.toLowerCase().trim() === "proceedings log");
        const proceedingsMap: { [caseId: string]: CaseChronologyEvent[] } = {};
        let parsedEventsTotal = 0;

        if (proceedingsSheetName) {
          const proceedingsSheet = workbook.Sheets[proceedingsSheetName];
          const rawProceedingRows = XLSX.utils.sheet_to_json<any>(proceedingsSheet);
          rawProceedingRows.forEach((row: any) => {
            const rowCaseId = row["Case ID"] || row["caseId"] || row["CaseID"];
            if (rowCaseId) {
              if (!proceedingsMap[rowCaseId]) {
                proceedingsMap[rowCaseId] = [];
              }
              proceedingsMap[rowCaseId].push({
                date: row["Proceeding Date"] || row["date"] || new Date().toISOString().split('T')[0],
                event: row["Event/Action Type"] || row["eventType"] || row["event"] || "Log Entry",
                authority: row["Handling Authority"] || row["authority"] || "N/A",
                referenceNo: row["Official Reference No."] || row["referenceNo"] || "N/A",
                summary: row["Event Summary"] || row["summary"] || ""
              });
              parsedEventsTotal++;
            }
          });
        }

        // Map sheets back into Standard LitigationCase structure
        const compiledCases: LitigationCase[] = rawCaseRows.map((row: any, index: number) => {
          // Normalize column values
          const rawId = row["Case ID"] || row["id"] || row["CaseID"] || `CASE-IMPORT-${index + 1}`;
          const taxpayer = row["Taxpayer Name"] || row["taxpayerName"] || row["Taxpayer"] || "Unidentified Taxpayer";
          const ntn = row["NTN"] || row["ntn"] || "N/A";
          const strn = row["STRN"] || row["strn"] || "";
          const taxType = row["Tax Type"] || row["taxType"] || "Income Tax";
          const taxPeriod = row["Tax Period"] || row["taxPeriod"] || "Tax Year 2024";
          const docType = row["Document/Case Type"] || row["documentType"] || row["Case Type"] || "Show Cause Notice (SCN)";
          const forum = row["Authority Forum"] || row["authorityForum"] || row["Forum"] || "FBR";
          const status = row["Dossier Status"] || row["currentStatus"] || row["Status"] || "Open";
          
          const demand = parseFloat(row["Tax Demand Principal (PKR)"] || row["taxDemand"] || row["Demand"] || 0) || 0;
          const penalty = parseFloat(row["Penalties (PKR)"] || row["penalty"] || 0) || 0;
          const surcharge = parseFloat(row["Surcharge (PKR)"] || row["defaultSurcharge"] || 0) || 0;
          const refund = parseFloat(row["Refund Claims"] || row["refundAmount"] || 0) || 0;
          const totalExposure = parseFloat(row["Total Financial Exposure (PKR)"] || row["totalExposure"] || 0) || (demand + penalty + surcharge);
          
          const stage = row["Current Stage"] || row["currentStage"] || "Show Cause Notice";
          const remarks = row["Remarks"] || row["decisionSummary"] || row["remarks"] || "";

          // Get chronology from proceedingsMap or make a default log entry
          let chronology = proceedingsMap[rawId] || [];
          if (chronology.length === 0) {
            chronology = [
              {
                date: new Date().toISOString().split('T')[0],
                event: "Register Imported",
                authority: forum,
                referenceNo: "Import-Ref",
                summary: `Dossier initialised via master file loading. ${remarks}`
              }
            ];
          }

          return {
            id: rawId,
            caseInfo: {
              caseId: rawId,
              taxpayerName: taxpayer,
              ntn: ntn,
              strn: strn,
              taxPeriod: taxPeriod,
              taxType: taxType,
              relevantLegalSections: row["Legal Sections"] || row["relevantLegalSections"] || "N/A",
              authorityForum: forum,
              documentType: docType,
              referenceNumber: row["Official Reference No."] || row["Reference Number"] || row["referenceNumber"] || "N/A",
              documentDate: row["Notice Official Date"] || row["documentDate"] || new Date().toISOString().split('T')[0]
            },
            financialInfo: {
              taxDemand: demand,
              penalty: penalty,
              defaultSurcharge: surcharge,
              refundAmount: refund,
              totalExposure: totalExposure
            },
            proceedingsInfo: {
              dateOfNotice: new Date().toISOString().split('T')[0],
              dateOfReply: "",
              hearingDates: [],
              orderDate: "",
              appealDate: "",
              decisionDate: "",
              currentStage: stage
            },
            outcomeInfo: {
              departmentPosition: row["Department Position"] || "",
              taxpayerPosition: row["Taxpayer Position"] || "",
              decisionSummary: remarks,
              reliefGranted: row["Granted Relief Details"] || "",
              amountConfirmed: parseFloat(row["Amount Confirmed"] || 0) || 0,
              amountDeleted: parseFloat(row["Amount Deleted"] || 0) || 0,
              amountRemanded: parseFloat(row["Amount Remanded"] || 0) || 0,
              currentStatus: status
            },
            chronology: chronology.sort((a, b) => b.date.localeCompare(a.date)),
            sourceFiles: ["Excel Master File Import"],
            updatedAt: new Date().toISOString()
          };
        });

        if (compiledCases.length > 0) {
          setParsedCases(compiledCases);
          setEventCount(parsedEventsTotal || (compiledCases.length));
        } else {
          setErrorMsg("Could not find any readable litigation spreadsheet rows in sheet 'Case Register'. Check your headers.");
        }
      } catch (err: any) {
        setErrorMsg(`Spreadsheet processing failure: ${err.message}`);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsArrayBuffer(excelFile);
  };

  const handleApplyImport = () => {
    if (parsedCases.length === 0) return;
    onImportCases(parsedCases, isMerge);
    setSuccessMsg(`Successfully processed and loaded ${parsedCases.length} litigation folders into the database!`);
    setParsedCases([]);
    setFile(null);
  };

  return (
    <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3 border-b border-sidebar-border border-slate-800 pb-3">
        <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500 border border-amber-500/20">
          <Database size={18} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Import Master Database File</h2>
          <p className="text-[11px] text-slate-400">
            Wipe or merge bulk cases instantly using an Excel (.xlsx, .xls) workbook or JSON backup.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-emerald-400 text-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle size={16} />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-rose-400 text-xs flex items-center gap-2.5 animate-fade-in">
          <AlertTriangle size={16} />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Drag & drop master trigger */}
      {!file && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition duration-200 flex flex-col items-center justify-center gap-2 text-slate-450 hover:bg-[#020617]/20 ${
            dragActive ? "border-amber-500 bg-amber-500/5" : "border-slate-805 hover:border-slate-700"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.json"
            onChange={handleFileChange}
          />
          <Upload className={`w-8 h-8 text-slate-500 ${dragActive && "text-amber-500 animate-bounce"}`} />
          <div>
            <span className="text-xs font-bold text-slate-300 block">Drag & drop your master database file here</span>
            <span className="text-[10px] text-slate-500">Supports Excel workbook exports or JSON backups</span>
          </div>
          <button
            type="button"
            className="mt-1 bg-slate-900 hover:bg-slate-855 border border-slate-800 text-slate-300 px-3 py-1 rounded text-[10px] font-bold"
          >
            Browse Files
          </button>
        </div>
      )}

      {/* Parsing state */}
      {parsing && (
        <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-amber-500" />
          <span>Ingesting and parsing litigation master index...</span>
        </div>
      )}

      {/* Preview / Configuration and Apply */}
      {parsedCases.length > 0 && !parsing && (
        <div className="bg-[#020617]/50 rounded-xl border border-slate-850 p-4 space-y-4 animate-fade-in text-xs">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <span className="font-bold text-slate-300 flex items-center gap-1.5Header">
              <FileText size={14} className="text-amber-500" />
              File Meta Preview
            </span>
            <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
              {file?.name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
              <span className="text-slate-500 block">Litigation Dossiers</span>
              <span className="text-sm font-bold text-white">{parsedCases.length} folders</span>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
              <span className="text-slate-500 block">Events chronologies</span>
              <span className="text-sm font-bold text-white">{eventCount} records</span>
            </div>
          </div>

          {/* Conflict strategy controls */}
          <div className="space-y-2 pt-1 border-t border-slate-850/60">
            <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">Import Integration Strategy</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsMerge(true)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                  isMerge
                    ? "bg-amber-500/10 border-amber-500/50 text-white"
                    : "bg-[#090d16] border-slate-800 text-slate-400 hover:bg-slate-900/40"
                }`}
              >
                <Layers className={`shrink-0 mt-0.5 ${isMerge ? "text-amber-400" : "text-slate-500"}`} size={14} />
                <div>
                  <span className="font-bold text-[11px] block">Merge into Existing Database</span>
                  <span className="text-[9px] text-slate-450 block leading-tight mt-0.5">
                    Aligns matching NTN/References and incorporates events chronology. Perfect for active portfolios.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsMerge(false)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                  !isMerge
                    ? "bg-rose-500/10 border-rose-500/50 text-white"
                    : "bg-[#090d16] border-slate-800 text-slate-400 hover:bg-slate-900/40"
                }`}
              >
                <RefreshCw className={`shrink-0 mt-0.5 ${!isMerge ? "text-rose-400" : "text-slate-500"}`} size={14} />
                <div>
                  <span className="font-bold text-[11px] block">Wipe & Overwrite Completely</span>
                  <span className="text-[9px] text-slate-455 block leading-tight mt-0.5">
                    Deletes current {existingCount} database records and replaces them. Ideal for reloading templates.
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              onClick={() => {
                setFile(null);
                setParsedCases([]);
              }}
              className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 p-2 rounded-xl text-[11px] font-bold text-slate-350 transition"
            >
              Cancel Import
            </button>
            <button
              onClick={handleApplyImport}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 p-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              Commit Import List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
