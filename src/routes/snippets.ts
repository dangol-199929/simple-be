import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { createSnippetSchema, updateSnippetSchema } from "../schemas/snippets";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const snippets = await prisma.snippet.findMany({
    orderBy: { updatedAt: "desc" },
  });
  res.json(snippets);
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createSnippetSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const snippet = await prisma.snippet.create({ data: parsed.data });
  res.status(201).json(snippet);
});

router.put("/:id", async (req: Request, res: Response) => {
  const id =
    typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: "Invalid snippet id" });
    return;
  }
  const parsed = updateSnippetSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  try {
    const snippet = await prisma.snippet.update({
      where: { id },
      data: parsed.data,
    });
    res.json(snippet);
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2025"
    ) {
      res.status(404).json({ error: "Snippet not found" });
      return;
    }
    throw e;
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id =
    typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: "Invalid snippet id" });
    return;
  }
  try {
    await prisma.snippet.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2025"
    ) {
      res.status(404).json({ error: "Snippet not found" });
      return;
    }
    throw e;
  }
});

export default router;
