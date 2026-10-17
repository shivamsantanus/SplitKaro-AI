import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Prisma compiles an insensitive `equals` to ILIKE without escaping, so `_` and `%` in
// an address matched other users (a_rav@x.com found aarav@x.com). The escaped pattern
// keeps case-insensitive matching for legacy mixed-case rows; the exact branch still
// matches the normal lowercase rows if a future Prisma escapes wildcards itself.
export function emailMatches(email: string): Prisma.UserWhereInput {
  const normalizedEmail = normalizeEmail(email);

  return {
    OR: [
      { email: normalizedEmail },
      { email: { equals: normalizedEmail.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } },
    ],
  };
}

export async function findUserByEmail(email: string) {
  // Excludes placeholders so an OAuth sign-in can never attach to a guest row.
  return prisma.user.findFirst({
    where: {
      isPlaceholder: false,
      ...emailMatches(email),
    },
  });
}

export async function findUserByEmailWithSelect<T extends Prisma.UserSelect>(email: string, select: T) {
  return prisma.user.findFirst({
    where: emailMatches(email),
    select,
  });
}
