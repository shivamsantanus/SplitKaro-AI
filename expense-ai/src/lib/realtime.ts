import prisma from "@/lib/prisma";

type RealtimeEvent = {
  type: string;
  groupId?: string;
  userId?: string;
  timestamp: string;
};

type Subscriber = {
  id: string;
  userId: string;
  send: (event: RealtimeEvent) => void;
  close: () => void;
};

const subscribers = new Map<string, Subscriber>();

function formatSseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createRealtimeStream(userId: string, signal?: AbortSignal) {
  const encoder = new TextEncoder();
  let subscriberId = "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };

      const closeConnection = () => {
        try {
          controller.close();
        } catch {
          // Stream may already be closed when abort fires.
        }
      };

      subscriberId = crypto.randomUUID();

      const heartbeat = setInterval(() => {
        safeEnqueue(formatSseMessage("ping", { timestamp: new Date().toISOString() }));
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        subscribers.delete(subscriberId);
        closeConnection();
        signal?.removeEventListener("abort", cleanup);
      };

      subscribers.set(subscriberId, {
        id: subscriberId,
        userId,
        send: (event) => {
          safeEnqueue(formatSseMessage("update", event));
        },
        close: cleanup,
      });

      safeEnqueue(formatSseMessage("connected", { ok: true }));
      signal?.addEventListener("abort", cleanup);
    },
    cancel() {
      if (!subscriberId) {
        return;
      }

      const subscriber = subscribers.get(subscriberId);
      subscriber?.close();
    },
  });

  return stream;
}

export async function publishUserEvent(userId: string, type: string) {
  if (subscribers.size === 0) return;

  const event: RealtimeEvent = {
    type,
    userId,
    timestamp: new Date().toISOString(),
  };

  for (const subscriber of subscribers.values()) {
    if (subscriber.userId === userId) {
      subscriber.send(event);
    }
  }
}

export async function publishGroupEvent(groupId: string, type: string) {
  if (subscribers.size === 0) {
    return;
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  if (members.length === 0) {
    return;
  }

  const memberIds = new Set(members.map((member) => member.userId));
  const event: RealtimeEvent = {
    type,
    groupId,
    timestamp: new Date().toISOString(),
  };

  for (const subscriber of subscribers.values()) {
    if (memberIds.has(subscriber.userId)) {
      subscriber.send(event);
    }
  }
}
