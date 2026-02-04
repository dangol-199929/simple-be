import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import pino from "pino";
import snippetsRouter from "./routes/snippets";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "snippet-manager-api" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/snippets", snippetsRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error({ err, message, stack }, "Unhandled error");
    // Expose message in 500 response so we can see the real error (remove for prod hardening)
    res.status(500).json({
      error: "Internal server error",
      // message,
      // ...(process.env.EXPOSE_ERROR === "1" && { stack }),
    });
  },
);

export default app;
