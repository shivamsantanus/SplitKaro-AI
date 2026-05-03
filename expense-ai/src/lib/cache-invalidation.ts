import prisma from "./prisma";
import { deleteCache, deleteCachePattern } from "./cache";

async function deleteUserCacheKeys(userId: string): Promise<void> {
  await Promise.all([
    deleteCache(`groups:${userId}:active`),
    deleteCache(`groups:${userId}:archived`),
    deleteCache(`analytics:overview:${userId}`),
    deleteCache(`analytics:groups:${userId}`),
    deleteCache(`activities:${userId}`),
    deleteCache(`friends:${userId}`),
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
