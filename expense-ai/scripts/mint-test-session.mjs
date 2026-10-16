import "dotenv/config";
import { encode } from "next-auth/jwt";
import pkg from "../src/generated/prisma/index.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const MAX_AGE = 30 * 24 * 60 * 60;

const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function databaseHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/mint-test-session.mjs <email-or-local-part>");
    process.exitCode = 1;
    return;
  }

  // The cookie is signed with the real NEXTAUTH_SECRET, so against a remote
  // database this would forge a working session for any live user.
  const host = databaseHost();
  if (!LOCAL_DB_HOSTS.has(host)) {
    console.error(`Refusing to mint: DATABASE_URL host "${host || "unset"}" is not a local database.`);
    process.exitCode = 1;
    return;
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("NEXTAUTH_SECRET is not set — cannot sign a session.");
    process.exitCode = 1;
    return;
  }

  const email = input.includes("@") ? input.trim().toLowerCase() : `${input}@splitkaro.test`;

  // isPlaceholder guard mirrors findUserByEmail: guests have no real session.
  const user = await prisma.user.findFirst({
    where: { isPlaceholder: false, email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    console.error(`No user with email ${email}. Run: npm run seed:test`);
    process.exitCode = 1;
    return;
  }

  const token = await encode({
    secret,
    maxAge: MAX_AGE,
    token: { sub: user.id, id: user.id, email: user.email, name: user.name },
  });

  // Must match the cookie name in src/lib/auth.ts, which keys off the
  // NEXTAUTH_URL scheme rather than NODE_ENV.
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const cookieName = baseUrl.startsWith("https://")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  console.log(`user:    ${user.name} <${user.email}>  id=${user.id}`);
  console.log(`cookie:  ${cookieName}=${token}`);
  console.log("");
  console.log("curl example:");
  console.log(
    `  curl -k -H "Cookie: ${cookieName}=${token}" ${baseUrl}/api/me`
  );
}

main()
  .catch((error) => {
    console.error("Failed to mint session:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
