import {
  QueryBuilder,
  MutationBuilder,
  ActionBuilder,
} from "convex/server";
import { DataModel } from "./dataModel";

export declare const query: QueryBuilder<DataModel, "public">;
export declare const mutation: MutationBuilder<DataModel, "public">;
export declare const action: ActionBuilder<DataModel, "public">;
