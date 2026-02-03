import { z } from "zod";

export const createSnippetSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  code: z.string(),
  language: z.string().min(1, "Language is required").max(50),
});

export const updateSnippetSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  code: z.string().optional(),
  language: z.string().min(1).max(50).optional(),
});

export type CreateSnippetInput = z.infer<typeof createSnippetSchema>;
export type UpdateSnippetInput = z.infer<typeof updateSnippetSchema>;
