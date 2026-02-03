"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSnippetSchema = exports.createSnippetSchema = void 0;
const zod_1 = require("zod");
exports.createSnippetSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").max(255),
    code: zod_1.z.string(),
    language: zod_1.z.string().min(1, "Language is required").max(50),
});
exports.updateSnippetSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255).optional(),
    code: zod_1.z.string().optional(),
    language: zod_1.z.string().min(1).max(50).optional(),
});
