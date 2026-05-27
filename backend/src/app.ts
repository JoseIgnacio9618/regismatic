import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { env } from "./config/env";
import { AppError, errorMiddleware } from "./middlewares/error.middleware";
import { requestSanitizationMiddleware } from "./middlewares/request-sanitization.middleware";
import { billingWebhookRouter } from "./routes/billing.routes";
import { healthRouter } from "./routes/health.routes";
import { registerRoutes } from "./routes/register-routes";

export const app = express();
app.disable("x-powered-by");

if (env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

const apiLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Try again later." }
});

const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/api/billing", billingWebhookRouter);
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: env.JSON_BODY_LIMIT }));
app.use(requestSanitizationMiddleware);
app.use("/api", apiLimiter);
app.use(healthRouter);

registerRoutes(app);

app.use((_req, _res, next) => {
  next(new AppError("Route not found.", 404));
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation error.",
      details: err.issues
    });
  }

  return errorMiddleware(err, req, res, next);
});
