import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as cases from "../cases";
import type * as users from "../users";

declare const fullApi: ApiFromModules<{
  cases: typeof cases;
  users: typeof users;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
