import fs from "fs";
import admin from "firebase-admin";
import { env } from "../config/env";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type PushSendResult = {
  enabled: boolean;
  sentCount: number;
  failedCount: number;
  invalidTokens: string[];
};

let firebaseInitialized = false;
let firebaseDisabled = false;

const MAX_MULTICAST_TOKENS = 500;

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const normalizeDataPayload = (data?: Record<string, unknown>): Record<string, string> | undefined => {
  if (!data) {
    return undefined;
  }

  const entries = Object.entries(data).flatMap(([key, value]) => {
    if (value === undefined || value === null) {
      return [];
    }

    if (typeof value === "string") {
      return [[key, value] as const];
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return [[key, String(value)] as const];
    }

    return [[key, JSON.stringify(value)] as const];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const tryInitializeFirebase = (): boolean => {
  if (firebaseInitialized) {
    return true;
  }

  if (firebaseDisabled) {
    return false;
  }

  const rawServiceAccount = env.FCM_SERVICE_ACCOUNT_JSON?.trim();
  const serviceAccountPath = env.FCM_SERVICE_ACCOUNT_PATH?.trim();

  if (!rawServiceAccount && !serviceAccountPath) {
    firebaseDisabled = true;
    return false;
  }

  try {
    const serviceAccount = rawServiceAccount
      ? JSON.parse(rawServiceAccount)
      : JSON.parse(fs.readFileSync(serviceAccountPath as string, "utf8"));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    firebaseInitialized = true;
    return true;
  } catch (error) {
    firebaseDisabled = true;
    // eslint-disable-next-line no-console
    console.error("FCM initialization failed. Push notifications disabled.", error);
    return false;
  }
};

const isInvalidTokenErrorCode = (errorCode: string | undefined): boolean => {
  return errorCode === "messaging/invalid-registration-token" || errorCode === "messaging/registration-token-not-registered";
};

export const sendPushToTokens = async (tokens: string[], payload: PushPayload): Promise<PushSendResult> => {
  const uniqueTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter((token) => token.length > 0)));

  if (uniqueTokens.length === 0) {
    return {
      enabled: tryInitializeFirebase(),
      sentCount: 0,
      failedCount: 0,
      invalidTokens: []
    };
  }

  const enabled = tryInitializeFirebase();
  if (!enabled) {
    return {
      enabled: false,
      sentCount: 0,
      failedCount: 0,
      invalidTokens: []
    };
  }

  let sentCount = 0;
  let failedCount = 0;
  const invalidTokens: string[] = [];

  const tokenChunks = chunkArray(uniqueTokens, MAX_MULTICAST_TOKENS);

  for (const chunk of tokenChunks) {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: normalizeDataPayload(payload.data)
    });

    sentCount += response.successCount;
    failedCount += response.failureCount;

    response.responses.forEach((result, index) => {
      const token = chunk[index];
      if (!result.success && isInvalidTokenErrorCode(result.error?.code)) {
        invalidTokens.push(token);
      }
    });
  }

  return {
    enabled: true,
    sentCount,
    failedCount,
    invalidTokens
  };
};
