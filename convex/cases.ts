import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("cases").collect();
  },
});

export const add = mutation({
  args: {
    id: v.string(),
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cases")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("cases", args);
    }
  },
});

export const deleteCase = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cases")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
