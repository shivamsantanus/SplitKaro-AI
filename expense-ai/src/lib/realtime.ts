import prisma from "@/lib/prisma";
import { createRedisSubscriber, ensureRedis } from "@/lib/redis";

type RealtimeEvent = {
  type: string;
  groupId?: string;
  userId?: string;
  timestamp: string;
};

function formatSseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getUserChannel(userId: string) {
  return `user:${userId}`;
}

function getGroupChannel(groupId: string) {
  return `group:${groupId}`;
}

export async function createRealtimeStream(userId: string, signal?: AbortSignal) {
  const encoder = new TextEncoder();
  const [subscriber, memberships] = await Promise.all([
    createRedisSubscriber(),
    prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    }),
  ]);

  const channels = [
    getUserChannel(userId),
    ...memberships.map((membership) => getGroupChannel(membership.groupId)),
  ];
  const uniqueChannels = [...new Set(channels)];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const safeEnqueue = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          void cleanup();
        }
      };

      const closeConnection = () => {
        if (closed) {
          return;
        }

        closed = true;

        try {
          controller.close();
        } catch {
          // Stream may already be closed when abort fires.
        }
      };

      const heartbeat = setInterval(() => {
        safeEnqueue(formatSseMessage("ping", { timestamp: new Date().toISOString() }));
      }, 15000);

      const cleanup = async () => {
        clearInterval(heartbeat);
        signal?.removeEventListener("abort", abortHandler);

        if (subscriber.isOpen) {
          await subscriber.unsubscribe(uniqueChannels);
          await subscriber.quit();
        }

        closeConnection();
      };

      const abortHandler = () => {
        void cleanup();
      };

      await subscriber.subscribe(uniqueChannels, (message) => {
        safeEnqueue(formatSseMessage("update", JSON.parse(message) as RealtimeEvent));
      });

      safeEnqueue(formatSseMessage("connected", { ok: true }));
      signal?.addEventListener("abort", abortHandler);
    },
    async cancel() {
      if (subscriber.isOpen) {
        await subscriber.unsubscribe(uniqueChannels);
        await subscriber.quit();
      }
    },
  });

  return stream;
}

export async function publishUserEvent(userId: string, type: string) {
  const event: RealtimeEvent = {
    type,
    userId,
    timestamp: new Date().toISOString(),
  };
  const redis = await ensureRedis();
  await redis.publish(getUserChannel(userId), JSON.stringify(event));
}

export async function publishGroupEvent(groupId: string, type: string) {
  const event: RealtimeEvent = {
    type,
    groupId,
    timestamp: new Date().toISOString(),
  };
  const redis = await ensureRedis();
  await redis.publish(getGroupChannel(groupId), JSON.stringify(event));
}
