import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);

  return prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });
}

export async function findUserByEmailWithSelect<T extends Prisma.UserSelect>(email: string, select: T) {
  const normalizedEmail = normalizeEmail(email);

  return prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    select,
  });
}
