import { LitigationCase } from "../types";

/**
 * Utility to format monetary values as PKR with proper separators.
 */
const formatPKRValue = (amount: number): string => {
  return `PKR ${amount.toLocaleString()}`;
};

/**
 * Intelligent helper to split blocks of text into logical sentences or bullet points.
 */
const extractBullets = (text: string, defaultText: string[]): string[] => {
  if (!text || text.trim().length === 0) {
    return defaultText;
  }
  const items = text
    .split(/[.;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (items.length < 3) {
    return [...items, ...defaultText.slice(0, 3 - items.length)];
  }
  return items.slice(0, 3); // Capped at exactly 3 to keep executive briefings extremely concise
};

/**
 * Ensured period helper
 */
const ensurePeriod = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
};

/**
 * Generates an high-contrast, compact HTML wrapper strictly configured for Microsoft Word.
 */
export const generateManagementSummaryHtml = (c: LitigationCase): string => {
  const isClosed = c.outcomeInfo.currentStatus.toLowerCase() === "closed" || 
                   c.outcomeInfo.currentStatus.toLowerCase().includes("concluded");

  const taxpayerNameClean = c.caseInfo.taxpayerName || "Niagara Mills (PVT) Ltd";
  const taxTypeLabel = c.caseInfo.taxType || "Tax";
  const forumLabel = c.caseInfo.authorityForum || "Assessing Forum";
  const actSections = c.caseInfo.relevantLegalSections || "relevant provisions of the tax laws";
  const docTypeName = c.caseInfo.documentType || "Notice";
  const taxPeriod = c.caseInfo.taxPeriod || "specified period";

  // Dense, well-formed 2-4 sentences for Issue in Dispute
  const disputeSentences = [
    `This litigation matter was initiated by ${forumLabel} against ${taxpayerNameClean} via a ${docTypeName} for the tax period ${taxPeriod}.`,
    `The dispute centers on tax compliance, assessment discrepancies, and the application of ${actSections}.`,
    c.outcomeInfo.departmentPosition && c.outcomeInfo.departmentPosition.length > 20
      ? `The department's assessment objects to our declarations, creating a financial exposure of ${formatPKRValue(c.financialInfo.totalExposure)}.`
      : `The primary issue pertains to disputed adjustments, disallowed credits, or procedural contentions raised by the auditing officer.`
  ].map(ensurePeriod).join(" ");

  // Department position points
  const defaultDeptBullets = [
    "Asserted compliance omissions or lack of supportive primary documentation.",
    "Proposed recovery of principal tax demand along with penalties and surcharges.",
    "Rejected oral and written submissions presented during procedural hearings."
  ];
  const deptBullets = extractBullets(c.outcomeInfo.departmentPosition, defaultDeptBullets);

  // Taxpayer defense points
  const defaultTaxpayerBullets = [
    "Contends that all transactions fully comply with standard statutory frameworks.",
    "Maintains that audit selections and assessments were framed on arbitrary premises.",
    "Urges that penalties cannot be applied as there is entirely no evidence of willful omission."
  ];
  const taxpayerBullets = extractBullets(c.outcomeInfo.taxpayerPosition, defaultTaxpayerBullets);

  // Chronology (Oldest to newest)
  const chronologySorted = c.chronology && c.chronology.length > 0
    ? [...c.chronology].sort((a, b) => a.date.localeCompare(b.date))
    : [
        {
          date: c.proceedingsInfo.dateOfNotice || c.caseInfo.documentDate || "2024-01-01",
          event: "Notice Issued",
          authority: forumLabel,
          referenceNo: c.caseInfo.referenceNumber || "N-1",
          summary: "Initial assessment notice served."
        }
      ];

  // Outcome
  const deletedVal = c.outcomeInfo.amountDeleted || 0;
  const confirmedVal = c.outcomeInfo.amountConfirmed || 0;
  const remandedVal = c.outcomeInfo.amountRemanded || 0;

  let overallSuccessStmt = "";
  if (isClosed) {
    if (deletedVal >= c.financialInfo.totalExposure * 0.85) {
      overallSuccessStmt = "Taxpayer obtained complete relief. The disputed demand was deleted/annulled.";
    } else if (deletedVal > 0 && confirmedVal > 0) {
      overallSuccessStmt = "Partial relief granted. Substantial liabilities were deleted, and minimal demand confirmed.";
    } else if (confirmedVal >= c.financialInfo.totalExposure * 0.85) {
      overallSuccessStmt = "Assessment confirmed against the taxpayer. The defense arguments were set aside.";
    } else if (remandedVal > 0) {
      overallSuccessStmt = "Matter remanded to the assessing authority for fresh adjudication.";
    } else {
      overallSuccessStmt = "Dossier closed and finalized at this forum.";
    }
  } else {
    overallSuccessStmt = "Matter is currently active and pending adjudication before the forum.";
  }

  const decisionSummaryText = c.outcomeInfo.decisionSummary || "Adjudication details yet to be finalized.";

  // Management Notes
  const chancesStr = isClosed
    ? (deletedVal > confirmedVal ? "High (Relief Realized)" : "Low (Liability Upheld)")
    : "Medium";

  const nextAction = isClosed
    ? "Incorporate final ledger adjustments into FBR e-portal and update general accounts."
    : "Track next hearing docket dates, file written rejoinders, and prepare oral arguments.";

  const mgtNotes = [
    `• <b>Key Risks:</b> Compliance audit trailing and verification of statutory exemptions.`,
    `• <b>Exposure:</b> Out of ${formatPKRValue(c.financialInfo.totalExposure)} challenged, ${formatPKRValue(confirmedVal)} is confirmed, other is resolved.`,
    `• <b>Chances of Success:</b> Rated as <b>${chancesStr}</b>.`,
    `• <b>Recommended Next Action:</b> ${nextAction}`
  ];

  // One line conclusion
  const statusUpper = c.outcomeInfo.currentStatus?.toUpperCase() || "PENDING";
  const oneLineConclusion = `${forumLabel} initiated demand of ${formatPKRValue(c.financialInfo.totalExposure)} for ${taxTypeLabel}; status is currently ${statusUpper} with confirmed liability of ${formatPKRValue(confirmedVal)}.`;

  return `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>Niagara Mills - Case Briefing</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #333333;
      margin: 1.0in 1.0in 1.0in 1.0in;
    }
    h1 {
      font-size: 15pt;
      color: #0369a1;
      border-bottom: 2px solid #0369a1;
      padding-bottom: 4px;
      margin-top: 0px;
      margin-bottom: 12px;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
    }
    h2 {
      font-size: 11pt;
      color: #0c4a6e;
      background-color: #f0f9ff;
      padding: 6px 10px;
      margin-top: 18px;
      margin-bottom: 8px;
      font-weight: bold;
      border-left: 4px solid #0284c7;
    }
    p {
      margin-top: 0px;
      margin-bottom: 8px;
      text-align: justify;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
      margin-bottom: 12px;
    }
    th {
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      font-size: 9pt;
      font-weight: bold;
      color: #0f172a;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-size: 9pt;
      color: #334155;
      vertical-align: top;
    }
    .meta-table td {
      padding: 5px 8px;
    }
    .meta-label {
      font-weight: bold;
      background-color: #f8fafc;
      width: 32%;
      color: #475569;
    }
    .meta-val {
      width: 68%;
      color: #1e293b;
    }
    ul {
      margin-top: 0px;
      margin-bottom: 8px;
      padding-left: 20px;
    }
    li {
      margin-bottom: 4px;
      font-size: 9pt;
      text-align: justify;
      color: #334155;
    }
    .text-right {
      text-align: right;
    }
    .font-mono {
      font-family: "Courier New", Courier, monospace;
      font-weight: bold;
    }
    .font-bold {
      font-weight: bold;
    }
    .footer {
      font-size: 8pt;
      color: #64748b;
      margin-top: 25px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>

  <h1>CASE LITIGATION SUMMARY — EXECUTIVE REPORT</h1>
  <p style="font-size: 9pt; color: #475569; text-align: center; margin-top: -8px; margin-bottom: 14px; font-weight: bold;">
    CONFIDENTIAL MANAGEMENT ADVISORY BRIEFING • LEGAL AFFAIRS
  </p>

  <h2>Case Overview & Demographics</h2>
  <table class="meta-table" border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1;">
    <tr>
      <td class="meta-label">Case ID:</td>
      <td class="meta-val font-bold font-mono">${c.id}</td>
    </tr>
    <tr>
      <td class="meta-label">Enterprise Taxpayer:</td>
      <td class="meta-val font-bold">${taxpayerNameClean}</td>
    </tr>
    <tr>
      <td class="meta-label">NTN / STRN:</td>
      <td class="meta-val font-mono">${c.caseInfo.ntn || "N/A"} / ${c.caseInfo.strn || "N/A"}</td>
    </tr>
    <tr>
      <td class="meta-label">Tax Category:</td>
      <td class="meta-val">${c.caseInfo.taxType}</td>
    </tr>
    <tr>
      <td class="meta-label">Covered Tax Period:</td>
      <td class="meta-val">${c.caseInfo.taxPeriod}</td>
    </tr>
    <tr>
      <td class="meta-label">Authority & Forum:</td>
      <td class="meta-val font-bold">${c.caseInfo.authorityForum}</td>
    </tr>
    <tr>
      <td class="meta-label">Originating Document:</td>
      <td class="meta-val">${c.caseInfo.documentType}</td>
    </tr>
    <tr>
      <td class="meta-label">Official Reference / Diary No:</td>
      <td class="meta-val font-mono">${c.caseInfo.referenceNumber}</td>
    </tr>
    <tr>
      <td class="meta-label">Notice Issuance Date:</td>
      <td class="meta-val">${c.caseInfo.documentDate || "N/A"}</td>
    </tr>
  </table>

  <h2>Core Legal Dispute & Matter Background</h2>
  <p>${disputeSentences}</p>

  <h2>Tax Department Basis & Allegations</h2>
  <ul>
    ${deptBullets.map((bullet) => `<li>${bullet}</li>`).join("\n")}
  </ul>

  <h2>Enterprise Legal Defense & Position</h2>
  <ul>
    ${taxpayerBullets.map((bullet) => `<li>${bullet}</li>`).join("\n")}
  </ul>

  <h2>Trial Timeline & Proceedings History</h2>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1;">
    <thead>
      <tr>
        <th style="width: 15%;">Date</th>
        <th style="width: 25%;">Activity Event</th>
        <th style="width: 25%;">Officer/Forum</th>
        <th style="width: 35%;">Action Summary & reference</th>
      </tr>
    </thead>
    <tbody>
      ${chronologySorted
        .map(
          (ev) => `
      <tr>
        <td class="font-mono">${ev.date}</td>
        <td class="font-bold">${ev.event}</td>
        <td>${ev.authority}</td>
        <td>${ev.summary} ${ev.referenceNo && ev.referenceNo !== "N/A" ? "(Ref: " + ev.referenceNo + ")" : ""}</td>
      </tr>`
        )
        .join("\n")}
    </tbody>
  </table>

  <h2>Ordered Relief & Outcome Summary</h2>
  <p class="font-bold" style="color: #0369a1;">${overallSuccessStmt}</p>
  <p style="margin-top: 4px;">
    <b>Amount Annulled/Deleted:</b> ${formatPKRValue(deletedVal)} <br/>
    <b>Amount Remanded back:</b> ${formatPKRValue(remandedVal)} <br/>
    <b>Amount Upheld/Confirmed:</b> ${formatPKRValue(confirmedVal)}
  </p>
  <p style="font-size: 9pt; color: #475569; margin-top: 4px; margin-bottom: 0px; font-style: italic;">
    <b>Official Remarks:</b> ${decisionSummaryText}
  </p>

  <h2>Absolute Financial Impact</h2>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1;">
    <thead>
      <tr>
        <th>Expense Head Particular</th>
        <th class="text-right">Amount (PKR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Principal Tax Levy Demand</td>
        <td class="text-right font-mono">${formatPKRValue(c.financialInfo.taxDemand)}</td>
      </tr>
      <tr>
        <td>Statutory Penalty Applied</td>
        <td class="text-right font-mono">${formatPKRValue(c.financialInfo.penalty)}</td>
      </tr>
      <tr>
        <td>Cumulative Default Surcharge</td>
        <td class="text-right font-mono">${formatPKRValue(c.financialInfo.defaultSurcharge)}</td>
      </tr>
      <tr>
        <td>Deductible Refund Claims involved</td>
        <td class="text-right font-mono">(${formatPKRValue(c.financialInfo.refundAmount)})</td>
      </tr>
      <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #0369a1;">
        <td style="color: #0369a1;">Net Disputed Financial Exposure</td>
        <td class="text-right font-mono" style="color: #0369a1;">${formatPKRValue(c.financialInfo.totalExposure)}</td>
      </tr>
    </tbody>
  </table>

  <h2>Current Litigation Status</h2>
  <p>
    <b>Status:</b> ${c.outcomeInfo.currentStatus?.toUpperCase() || "ACTIVE"} <br/>
    <b>Active Forum:</b> ${c.caseInfo.authorityForum} <br/>
    <b>Appeals Process:</b> ${isClosed ? "No (Final Decree Concluded)" : "Yes (Active Defense Actions Ongoing)"} <br/>
    <b>Action Required:</b> ${nextAction}
  </p>

  <h2>Management Advisors Notes</h2>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1; background-color: #fafafa;">
    <tr>
      <td>
        ${mgtNotes.map((note) => `<p style="margin-bottom: 4px; font-size: 9pt; line-height: 1.4;">${note}</p>`).join("\n")}
      </td>
    </tr>
  </table>

  <h2>Executive Advisory Review Brief</h2>
  <p style="font-weight: bold; font-style: italic; border-left: 3px solid #0369a1; padding-left: 8px; font-size: 9.5pt; color: #0f172a; margin-top: 8px;">
    "${oneLineConclusion}"
  </p>

  <div class="footer">
    Private & Confidential • Niagara Mills Corporate Legal Affairs Division
  </div>

</body>
</html>
  `;
};

/**
 * Initiates the client-side download of the formatted Word dossier.
 */
export const downloadManagementCaseSummary = (c: LitigationCase): void => {
  const htmlContent = generateManagementSummaryHtml(c);
  const blob = new Blob([htmlContent], { type: "application/msword;charset=utf-8" });
  
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${c.id}_Case_Summary.doc`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
