import { z } from "zod/v4";
import type { ProjectCatalog } from "../contracts.ts";

const shortText = z.string().trim().min(1).max(500);

export function discoveryResultSchema(catalog: ProjectCatalog, final: boolean) {
  const ids = catalog.resources.map(({ id }) => id);
  const resourceId = ids.length > 0
    ? z.enum(ids as [string, ...string[]])
    : z.string().max(0);
  const question = z.object({
    id: z.string().trim().min(1).max(80),
    question: z.string().trim().min(1).max(160),
    reason: z.string().trim().min(1).max(240),
    recommendation: z.string().trim().min(1).max(80),
    options: z.array(z.object({
      id: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(100),
      result: z.string().trim().min(1).max(240),
    }).strict()).min(2).max(3),
  }).strict();

  return z.object({
    domain: shortText,
    purpose: shortText,
    primaryUser: shortText,
    job: shortText,
    relationships: z.array(z.object({
      description: shortText,
      resourceIds: z.array(resourceId).max(6),
    }).strict()).max(8),
    application: z.object({
      name: z.string().trim().min(1).max(80),
      promise: z.string().trim().min(1).max(180),
      concept: shortText,
      initialJourney: z.array(shortText).min(1).max(6),
      likelyActions: z.array(z.object({
        label: z.string().trim().min(1).max(80),
        intent: shortText,
        resourceIds: z.array(resourceId).max(6),
      }).strict()).min(1).max(8),
    }).strict(),
    assumptions: z.array(shortText).max(8),
    limitations: z.array(shortText).max(8),
    intentConfidence: z.number().min(0).max(1),
    questions: z.array(question).max(3),
  }).strict().superRefine((result, context) => {
    if (result.intentConfidence >= 0.65 && result.assumptions.length > 0) {
      context.addIssue({
        code: "custom",
        message: "High-confidence discovery cannot depend on assumptions.",
        path: ["assumptions"],
      });
    }
    if (!final && result.intentConfidence < 0.65 && result.questions.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Low-confidence discovery must ask at least one question.",
        path: ["questions"],
      });
    }
    if ((final || result.intentConfidence >= 0.65) && result.questions.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Questions are only allowed before the final result when confidence is low.",
        path: ["questions"],
      });
    }
    if (final && result.intentConfidence < 0.65 && result.assumptions.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A low-confidence final result must record an assumption.",
        path: ["assumptions"],
      });
    }
    for (const [index, questionEntry] of result.questions.entries()) {
      if (!questionEntry.options.some(({ id }) => id === questionEntry.recommendation)) {
        context.addIssue({
          code: "custom",
          message: "The recommendation must match one supplied option.",
          path: ["questions", index, "recommendation"],
        });
      }
    }
  });
}

export function codexOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  const unsupported = new Set([
    "$schema",
    "format",
    "maxItems",
    "maxLength",
    "maximum",
    "minItems",
    "minLength",
    "minimum",
    "pattern",
  ]);
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !unsupported.has(key))
      .map(([key, entry]) => [key === "oneOf" ? "anyOf" : key, normalize(entry)]));
  };
  return normalize(json) as Record<string, unknown>;
}
