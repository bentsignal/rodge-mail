import { z } from "zod";

const providerResultSchema = z.enum(["connected", "error"]);

export const providerCompletionSearchSchema = z.discriminatedUnion("provider", [
  z.object({
    gmail: providerResultSchema,
    provider: z.literal("gmail"),
  }),
  z.object({
    microsoft: providerResultSchema,
    provider: z.literal("microsoft"),
  }),
]);

export type ProviderCompletionSearch = z.infer<
  typeof providerCompletionSearchSchema
>;

export function createProviderCompletionDeepLink(
  search: ProviderCompletionSearch,
) {
  const result = search.provider === "gmail" ? search.gmail : search.microsoft;
  const url = new URL("rodge-mail://provider-complete");
  url.searchParams.set("provider", search.provider);
  url.searchParams.set("result", result);
  return url.href;
}
