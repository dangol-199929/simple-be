"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const snippets_1 = require("../schemas/snippets");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    const snippets = await prisma_1.prisma.snippet.findMany({
        orderBy: { updatedAt: "desc" },
    });
    res.json(snippets);
});
router.post("/", async (req, res) => {
    const parsed = snippets_1.createSnippetSchema.safeParse(req.body);
    if (!parsed.success) {
        res
            .status(400)
            .json({ error: "Validation failed", details: parsed.error.flatten() });
        return;
    }
    const snippet = await prisma_1.prisma.snippet.create({ data: parsed.data });
    res.status(201).json(snippet);
});
router.put("/:id", async (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
    if (!id) {
        res.status(400).json({ error: "Invalid snippet id" });
        return;
    }
    const parsed = snippets_1.updateSnippetSchema.safeParse(req.body);
    if (!parsed.success) {
        res
            .status(400)
            .json({ error: "Validation failed", details: parsed.error.flatten() });
        return;
    }
    try {
        const snippet = await prisma_1.prisma.snippet.update({
            where: { id },
            data: parsed.data,
        });
        res.json(snippet);
    }
    catch (e) {
        if (e &&
            typeof e === "object" &&
            "code" in e &&
            e.code === "P2025") {
            res.status(404).json({ error: "Snippet not found" });
            return;
        }
        throw e;
    }
});
router.delete("/:id", async (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
    if (!id) {
        res.status(400).json({ error: "Invalid snippet id" });
        return;
    }
    try {
        await prisma_1.prisma.snippet.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e &&
            typeof e === "object" &&
            "code" in e &&
            e.code === "P2025") {
            res.status(404).json({ error: "Snippet not found" });
            return;
        }
        throw e;
    }
});
exports.default = router;
