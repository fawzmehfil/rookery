import { variantDefinitionSchema } from "./schema";
import type { ParseResult, VariantDefinition } from "./types";

export function parseVariantDefinition(input: unknown): ParseResult<VariantDefinition> {
  const result = variantDefinitionSchema.safeParse(input);

  if (result.success) {
    return { ok: true, value: result.data };
  }

  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.map((segment) => (typeof segment === "symbol" ? segment.toString() : segment)),
    })),
  };
}
