import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cases: defineTable({
    id: v.string(), // Client generated unique ID
    caseInfo: v.object({
      caseId: v.string(),
      taxpayerName: v.string(),
      ntn: v.string(),
      strn: v.string(),
      taxPeriod: v.string(),
      taxType: v.string(),
      relevantLegalSections: v.string(),
      authorityForum: v.string(),
      documentType: v.string(),
      referenceNumber: v.string(),
      documentDate: v.string(),
    }),
    financialInfo: v.object({
      taxDemand: v.number(),
      penalty: v.number(),
      defaultSurcharge: v.number(),
      refundAmount: v.number(),
      totalExposure: v.number(),
    }),
    proceedingsInfo: v.object({
      dateOfNotice: v.string(),
      dateOfReply: v.string(),
      hearingDates: v.array(v.string()),
      orderDate: v.string(),
      appealDate: v.string(),
      decisionDate: v.string(),
      currentStage: v.string(),
    }),
    outcomeInfo: v.object({
      departmentPosition: v.string(),
      taxpayerPosition: v.string(),
      decisionSummary: v.string(),
      reliefGranted: v.string(),
      amountConfirmed: v.number(),
      amountDeleted: v.number(),
      amountRemanded: v.number(),
      currentStatus: v.string(),
    }),
    chronology: v.array(
      v.object({
        date: v.string(),
        event: v.string(),
        authority: v.string(),
        referenceNo: v.string(),
        summary: v.string(),
      })
    ),
    updatedAt: v.string(),
    sourceFiles: v.array(v.string()),
    createdBy: v.optional(v.string()),
    createdByEmail: v.optional(v.string()),
  }),
  users: defineTable({
    uid: v.string(),
    email: v.string(),
    fullName: v.string(),
    role: v.string(), // "admin" | "user"
    createdAt: v.string(),
  }).index("by_uid", ["uid"]),
});
