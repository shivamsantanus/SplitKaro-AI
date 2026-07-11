import prisma from "./prisma";
import { deleteCache, deleteCachePattern } from "./cache";

async function deleteUserCacheKeys(userId: string): Promise<void> {
  await Promise.all([
    deleteCache(`groups:${userId}:active`),
    deleteCache(`groups:${userId}:archived`),
    deleteCache(`group:solo-transactions:${userId}`),
    deleteCache(`analytics:overview:${userId}`),
    deleteCache(`analytics:groups:${userId}`),
    deleteCache(`activities:${userId}`),
    deleteCache(`friends:${userId}`),
    // Personal summaries fold in each member's group-expense share, so a group
    // mutation can change them for every member.
    deleteCachePattern(`personal:summary:${userId}:*`),
  ]);
}

export async function invalidateGroupCaches(groupId: string): Promise<void> {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    await Promise.all([
      // Delete per-user group-detail cache keys directly (avoids KEYS command)
      ...members.map((m) => deleteCache(`group:${groupId}:${m.userId}`)),
      ...members.map((m) => deleteUserCacheKeys(m.userId)),
    ]);
  } catch {
    // fail-open — cache invalidation failures don't break mutations
  }
}

export async function invalidateUserCaches(userId: string): Promise<void> {
  try {
    await deleteUserCacheKeys(userId);
  } catch {
    // fail-open
  }
}

export async function invalidatePersonalCaches(
  userId: string,
  year: number,
  month: number
): Promise<void> {
  try {
    await Promise.all([
      // Clear the specific month key plus the unfiltered ":all:all" summary,
      // which the totals now depend on — a single-key delete left it stale.
      deleteCache(`personal:summary:${userId}:${year}:${month}`),
      deleteCachePattern(`personal:summary:${userId}:*`),
      deleteCache(`analytics:overview:${userId}`),
    ]);
  } catch {
    // fail-open
  }
}
