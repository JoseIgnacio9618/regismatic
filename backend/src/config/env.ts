import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("12h"),
  CORS_ORIGIN: z.string().default("*"),
  TRUST_PROXY: z.union([z.literal("true"), z.literal("false")]).default("false"),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  BILLING_TRIAL_DAYS: z.coerce.number().default(7),
  BILLING_TRIAL_SEAT_LIMIT: z.coerce.number().default(3),
  BILLING_TRIAL_IP_ENFORCEMENT: z.union([z.literal("true"), z.literal("false")]).default("true"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PACK_10_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PACK_10_YEARLY: z.string().optional(),
  STRIPE_PRICE_PACK_20_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PACK_20_YEARLY: z.string().optional(),
  STRIPE_PRICE_PACK_50_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PACK_50_YEARLY: z.string().optional(),
  STRIPE_PRICE_PACK_100_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PACK_100_YEARLY: z.string().optional(),
  STRIPE_CHECKOUT_SUCCESS_URL: z.string().optional(),
  STRIPE_CHECKOUT_CANCEL_URL: z.string().optional(),
  STRIPE_BILLING_PORTAL_RETURN_URL: z.string().optional(),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FCM_SERVICE_ACCOUNT_PATH: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
