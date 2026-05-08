import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Bootstrap admin seed.
 *
 * Why this script doesn't import from `@/lib/db` or `@/lib/auth`:
 * - `@/lib/db` starts with `import "server-only"`, which throws when
 *   loaded outside the Next.js server runtime (i.e. under `tsx` from a
 *   CLI). That guard is correct in the runtime — it stops the Prisma
 *   client from leaking into client bundles. We just don't want to
 *   inherit it here.
 * - `@/lib/auth` imports `@/lib/db` transitively, so the same guard
 *   would fire even if we kept the auth import.
 *
 * Solution: instantiate a local Prisma client + a local Better Auth
 * instance, both scoped to this script. Mirrors the runtime config
 * (Neon adapter, emailAndPassword, role additionalField with
 * input: false) but is independent of the runtime singletons.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET is required to run the seed");
}

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: authSecret,
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
});

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required to run the seed",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({
        where: { email },
        data: { role: "ADMIN" },
      });
      console.log(`Promoted ${email} to ADMIN`);
    } else {
      console.log(`Admin already exists: ${email}`);
    }
    return;
  }

  console.log(`Creating bootstrap admin: ${email}`);

  const result = await auth.api.signUpEmail({
    body: { email, password, name: "Admin" },
  });

  await prisma.user.update({
    where: { id: result.user.id },
    data: { role: "ADMIN" },
  });

  console.log(`✓ Admin user created with role ADMIN`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
