export interface CaseChronologyEvent {
  date: string;
  event: string;
  authority: string;
  referenceNo: string;
  summary: string;
}

export interface CaseInformation {
  caseId: string;
  taxpayerName: string;
  ntn: string;
  strn: string;
  taxPeriod: string;
  taxType: string; // e.g., "Sales Tax", "Income Tax", "FED", "Customs", "PRA", "Other"
  relevantLegalSections: string;
  authorityForum: string; // e.g., "FBR", "PRA", "Customs", "Commissioner Appeals", "Tribunal", "High Court", "Supreme Court"
  documentType: string; // e.g., "Show Cause Notice (SCN)", "Audit Observation", "Order in Original (ONO)", "Order in Appeal (OIA)", "Tribunal Order", etc.
  referenceNumber: string;
  documentDate: string;
}

export interface FinancialInformation {
  taxDemand: number;
  penalty: number;
  defaultSurcharge: number;
  refundAmount: number;
  totalExposure: number;
}

export interface ProceedingsInformation {
  dateOfNotice: string;
  dateOfReply: string;
  hearingDates: string[];
  orderDate: string;
  appealDate: string;
  decisionDate: string;
  currentStage: string;
}

export interface OutcomeInformation {
  departmentPosition: string;
  taxpayerPosition: string;
  decisionSummary: string;
  reliefGranted: string;
  amountConfirmed: number;
  amountDeleted: number;
  amountRemanded: number;
  currentStatus: string; // "Open", "Closed", "Pending Appeal", "Decided", "Recovered" etc.
}

export interface LitigationCase {
  id: string; // generated case id
  caseInfo: CaseInformation;
  financialInfo: FinancialInformation;
  proceedingsInfo: ProceedingsInformation;
  outcomeInfo: OutcomeInformation;
  chronology: CaseChronologyEvent[];
  updatedAt: string;
  sourceFiles: string[]; // list of names of files uploaded for this case
  createdBy?: string; // UID of user who created this folder
  createdByEmail?: string; // Email of user who created this folder
}

export interface AnalysisResponse {
  caseInfo: Omit<CaseInformation, "caseId">;
  financialInfo: FinancialInformation;
  proceedingsInfo: ProceedingsInformation;
  outcomeInfo: OutcomeInformation;
  chronology: CaseChronologyEvent[];
  validationIssues: string[];
}

export interface UserRights {
  canCreateDossier: boolean;
  canEditDossier: boolean;
  canDeleteDossier: boolean;
  canExportReports: boolean;
  canWipeDatabase: boolean;
}

export function getDefaultRights(role: "owner" | "admin" | "user"): UserRights {
  if (role === "owner") {
    return {
      canCreateDossier: true,
      canEditDossier: true,
      canDeleteDossier: true,
      canExportReports: true,
      canWipeDatabase: true,
    };
  }
  if (role === "admin") {
    return {
      canCreateDossier: true,
      canEditDossier: true,
      canDeleteDossier: true,
      canExportReports: true,
      canWipeDatabase: false,
    };
  }
  return {
    canCreateDossier: true,
    canEditDossier: true,
    canDeleteDossier: false,
    canExportReports: true,
    canWipeDatabase: false,
  };
}


