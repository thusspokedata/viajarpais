import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
].filter((value): value is string => Boolean(value));

if (process.env.NODE_ENV === "production" && trustedOrigins.length === 0) {
  throw new Error(
    "trustedOrigins is empty in production: set BETTER_AUTH_URL and/or NEXT_PUBLIC_SITE_URL",
  );
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  user: {
    additionalFields: {
      role: {
        type: ["ADMIN", "EDITOR", "MERCHANT"] as const,
        required: false,
        defaultValue: "MERCHANT",
        input: false,
      },
    },
  },
  trustedOrigins,
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
});

export type Session = typeof auth.$Infer.Session;
