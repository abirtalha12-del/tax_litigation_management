import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON/urlencoded body parsers with elevated payload limit for PDFs/images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API endpoint: Analyze Litigation Document
  app.post("/api/analyze-document", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
        return res.status(400).json({
          error: "GEMINI_API_KEY is not configured. Please add your key in the Secrets panel in AI Studio UI to enable document analysis."
        });
      }

      const { fileName, fileType, base64Data, textContent } = req.body;

      if (!base64Data && !textContent) {
        return res.status(400).json({ error: "No document content or file provided." });
      }

      // Initialize GoogleGenAI client lazily to avoid startup crashes if key is initially absent
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // Prepare content parts
      const parts: any[] = [];

      if (base64Data) {
        // Strip out the data url scheme prefix if exists (e.g. "data:application/pdf;base64,")
        const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, "");
        parts.push({
          inlineData: {
            data: base64Clean,
            mimeType: fileType || "application/pdf"
          }
        });
      } else if (textContent) {
        parts.push({
          text: `Document plain text content:\n\n${textContent}`
        });
      }

      // Prompt asking for complete tax litigation information extraction
      const promptText = `
You are a highly skilled Tax Litigation Specialist, Advocate High Court, and Senior Advisor specializing in Pakistani Tax Authorities:
* FBR (Federal Board of Revenue) - Income Tax, Sales Tax, FED, Customs
* PRA (Punjab Revenue Authority) - Sales Tax on Services
* Other Provincial Revenue Authorities (e.g., SRB, Sindh Revenue Board)
* Judicial Forums (Commissioner Appeals, Appellate Tribunal Inland Revenue, High Courts, Supreme Court)

Analyze the provided tax litigation document (which can be a Show Cause Notice, Audit Observation, Order in Original, Order in Appeal, Tribunal Order, Recovery Notice, Reply, Hearing Notice, High Court/Supreme Court Judgment, or other related document) and extract all factual details carefully.

Rules:
1. Identify and extract Case Information (Taxpayer Name, NTN, STRN, Tax Period, Tax Type, Relevant Legal sections, Authority Forum, Document Type, Reference number, Document Date).
2. For taxpayer name, textile companies in Pakistan often have names like "Style Textile", "Interloop", "Chenab", "Nishat Mills", "Standard Textile", or specific company names mentioned in the document.
3. NTN (National Tax Number) is usually a 7 or 8-digit number (e.g. 1234567-8 or 1234567). STRN (Sales Tax Registration Number) is usually a 13-digit number (e.g. 12-34-5678-910-11 or similar).
4. Financial information MUST be extracted. Demands, penalties, surcharges can be in PKR (Pakistani Rupees). Look for terms like "Rupees", "Rs.", "PKR", "Million", "Billion". Normalize these into actual numeric integers/floats (e.g., Rs. 5.5 Million = 5500000). Total Exposure = Tax Demand + Penalty + Default Surcharge. Ensure logical math.
5. In proceedings information, record dates like Notice Date, Reply Date, Hearing Dates, Order Date, Appeal Date, Decision Date. Keep them in YYYY-MM-DD or standard Pakistani text date formats.
6. Chronology: Extract every chronological event, date, or milestone mentioned anywhere in the text or headers. This should include past notices, replies, previous orders, appeals, etc.
7. Validation: Check for inconsistencies. If some fields are unclear, write them in 'validationIssues'. Check for missing dates, missing NTN, inconsistent amounts (e.g., demand does not match summary figures), or contradictory status updates.
8. NEVER guess or hallucinate if information is missing or unreadable; instead, flag the unreadable or missing fields/uncertainties in the 'validationIssues'.

Return the response strictly adhering to the JSON schema.
`;

      parts.push({ text: promptText });

      // Specify response schema to enforce strong constraints
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: parts },
        config: {
          systemInstruction: "You are an expert Senior Tax Litigation Assistant specializing in FBR, PRA, Customs, and Income Tax litigation for Pakistan textile enterprises. Your target is absolute precision, professional tax terminology, and Excel-ready numeric formatting.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              caseInfo: {
                type: Type.OBJECT,
                properties: {
                  taxpayerName: { type: Type.STRING, description: "Normalized legal name of the taxpayer" },
                  ntn: { type: Type.STRING, description: "Pakistani National Tax Number (7 digits or 7-8 format)" },
                  strn: { type: Type.STRING, description: "Sales Tax Registration Number (13 digits or standard format)" },
                  taxPeriod: { type: Type.STRING, description: "Tax Year or Tax Period, e.g. Tax Year 2022, July 2023, etc." },
                  taxType: { type: Type.STRING, description: "Must be one of: Sales Tax, Income Tax, FED, Customs, PRA Sales Tax, SRB Sales Tax, KPKRA Sales Tax, Other" },
                  relevantLegalSections: { type: Type.STRING, description: "E.g., Section 11, Section 122(5A), Section 122(9), Section 161, Section 22" },
                  authorityForum: { type: Type.STRING, description: "Forum/Authority, e.g., FBR, Punjab Revenue Authority, Customs, Commissioner Appeals, Appellate Tribunal, High Court of Lahore, Supreme Court of Pakistan" },
                  documentType: { type: Type.STRING, description: "Document type, e.g., Show Cause Notice (SCN), Audit Observation, Notice, Reply, Hearing Notice, Order in Original (ONO), Order in Appeal (OIA), Tribunal Order, High Court Judgment, Supreme Court Judgment, Recovery Notice, Refund Audit Order, Other" },
                  referenceNumber: { type: Type.STRING, description: "Official reference or letter/notice number" },
                  documentDate: { type: Type.STRING, description: "Official date on the document (YYYY-MM-DD format if possible or raw string)" },
                },
                required: ["taxpayerName", "ntn", "strn", "taxPeriod", "taxType", "relevantLegalSections", "authorityForum", "documentType", "referenceNumber", "documentDate"]
              },
              financialInfo: {
                type: Type.OBJECT,
                properties: {
                  taxDemand: { type: Type.NUMBER, description: "Extracted tax demand amount in PKR. Put 0 if none." },
                  penalty: { type: Type.NUMBER, description: "Extracted penalty amount in PKR. Put 0 if none." },
                  defaultSurcharge: { type: Type.NUMBER, description: "Extracted default surcharge/interest in PKR. Put 0 if none." },
                  refundAmount: { type: Type.NUMBER, description: "Refund claim amount in PKR if document is about refunds. Put 0 if none." },
                  totalExposure: { type: Type.NUMBER, description: "Total exposure (Tax Demand + Penalty + Default Surcharge) or relevant quantum in dispute" },
                },
                required: ["taxDemand", "penalty", "defaultSurcharge", "refundAmount", "totalExposure"]
              },
              proceedingsInfo: {
                type: Type.OBJECT,
                properties: {
                  dateOfNotice: { type: Type.STRING, description: "Date show cause or primary notice was issued (YYYY-MM-DD or raw string)" },
                  dateOfReply: { type: Type.STRING, description: "Date of taxpayer reply (YYYY-MM-DD or raw string) or empty if not yet filed" },
                  hearingDates: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "List of all hearing dates specified"
                  },
                  orderDate: { type: Type.STRING, description: "Date of order (YYYY-MM-DD or raw string) or empty if not passed" },
                  appealDate: { type: Type.STRING, description: "Date appeal was filed (YYYY-MM-DD or raw string) or empty if not filed" },
                  decisionDate: { type: Type.STRING, description: "Date of decision in appeal / tribunal (YYYY-MM-DD or raw string) or empty" },
                  currentStage: { type: Type.STRING, description: "Current stage, e.g., Show Cause Notice, Replied, Hearings Ongoing, Order Passed, Appeal Pending, Concluded, Recovery Stage" },
                },
                required: ["dateOfNotice", "dateOfReply", "hearingDates", "orderDate", "appealDate", "decisionDate", "currentStage"]
              },
              outcomeInfo: {
                type: Type.OBJECT,
                properties: {
                  departmentPosition: { type: Type.STRING, description: "High-level stance/allegation of the tax department" },
                  taxpayerPosition: { type: Type.STRING, description: "High-level legal defense of the taxpayers" },
                  decisionSummary: { type: Type.STRING, description: "Summary of the decision if an order was passed" },
                  reliefGranted: { type: Type.STRING, description: "Details of relief or quantum deleted/remanded" },
                  amountConfirmed: { type: Type.NUMBER, description: "Demand confirmed/upheld is PKR" },
                  amountDeleted: { type: Type.NUMBER, description: "Demand deleted/vacated in PKR" },
                  amountRemanded: { type: Type.NUMBER, description: "Demand sent back/remanded to lower authority in PKR" },
                  currentStatus: { type: Type.STRING, description: "E.g., Open, Closed, Active Appeal, Stay Granted, Under Review, Recovered" },
                },
                required: ["departmentPosition", "taxpayerPosition", "decisionSummary", "reliefGranted", "amountConfirmed", "amountDeleted", "amountRemanded", "currentStatus"]
              },
              chronology: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: "Event date (YYYY-MM-DD or raw format)" },
                    event: { type: Type.STRING, description: "E.g., Issue of SCN, Filing of Reply, First Hearing, Adjournment Request, Passing of ONO, Appeal Filing" },
                    authority: { type: Type.STRING, description: "Responsible authority or officer, e.g., DCIR Lahore, PRA Officer, Commissioner Inland Revenue (Appeals)" },
                    referenceNo: { type: Type.STRING, description: "Specific letter number, notice number, case number, or diary number" },
                    summary: { type: Type.STRING, description: "Brief 1-2 sentence description of the event details" },
                  },
                  required: ["date", "event", "authority", "referenceNo", "summary"]
                }
              },
              validationIssues: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of logical inconsistencies, duplicate references, missing NTN/STRN, conflicting statuses, math errors, or unreadable blocks"
              }
            },
            required: ["caseInfo", "financialInfo", "proceedingsInfo", "outcomeInfo", "chronology", "validationIssues"]
          }
        }
      });

      const resultText = response.text || "{}";
      const parsedResult = JSON.parse(resultText);

      return res.json(parsedResult);
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      return res.status(500).json({
        error: "Failed to analyze document via Gemini AI. Ensure the file is a readable PDF, text, or image, and verify your API Key constraints.",
        details: error.message
      });
    }
  });

  // Vite integration in Express
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static assets.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
