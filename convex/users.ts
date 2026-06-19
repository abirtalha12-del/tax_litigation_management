import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getProfile = query({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("uid"), args.uid))
      .first();
  },
});

export const createProfile = mutation({
  args: {
    uid: v.string(),
    email: v.string(),
    fullName: v.string(),
    role: v.string(),
    createdAt: v.string(),
    rights: v.optional(
      v.object({
        canCreateDossier: v.boolean(),
        canEditDossier: v.boolean(),
        canDeleteDossier: v.boolean(),
        canExportReports: v.boolean(),
        canWipeDatabase: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("uid"), args.uid))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("users", args);
    }
  },
});

export const updateUserRights = mutation({
  args: {
    uid: v.string(),
    rights: v.object({
      canCreateDossier: v.boolean(),
      canEditDossier: v.boolean(),
      canDeleteDossier: v.boolean(),
      canExportReports: v.boolean(),
      canWipeDatabase: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("uid"), args.uid))
      .first();
    if (!existing) {
      throw new Error("User profile not found");
    }
    await ctx.db.patch(existing._id, { rights: args.rights });
    return existing._id;
  },
});

export const getAllUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

