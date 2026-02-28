import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

type TokenPayload = {
  sub: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

export const signToken = (payload: TokenPayload): string => {
  const signOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    ...signOptions
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};
