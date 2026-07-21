import { z } from "zod";

const project = z.string({ error: "The project path is required." })
  .refine((value) => value.trim() !== "", "The project path is required.");
const port = z.coerce.number({ error: "The server port is not valid." })
  .int("The server port is not valid.")
  .min(0, "The server port is not valid.")
  .max(65_535, "The server port is not valid.");
const codexThreadId = z.string().trim().min(1).optional();
const projectContext = { project, codexThreadId };

export const projectRequestSchema = z.object({
  ...projectContext,
  port: port.default(0),
});

export const generationRequestSchema = z.object({
  ...projectContext,
  port: port.min(1, "The generation port is not valid."),
});

export const changeRequestSchema = z.object({
  ...projectContext,
  instruction: z.string({ error: "The application change is required." })
    .trim()
    .min(1, "The application change is required.")
    .max(4_000, "The application change is too long."),
});

export const activityRequestSchema = z.object({
  project,
  message: z.string({ error: "The activity message is not valid." })
    .refine((value) => value.trim() !== "", "The activity message is not valid.")
    .max(4_000, "The activity message is not valid."),
});

export const applicationParamsSchema = z.object({ id: z.string().min(1) });
export const activityQuerySchema = z.object({ projectId: z.string().optional() });
