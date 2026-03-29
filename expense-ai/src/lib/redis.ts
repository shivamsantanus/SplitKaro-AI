import { createClient } from "redis";

type AppRedisClient = ReturnType<typeof createClient>;

declare global {
  var __expenseAiRedisClient__: AppRedisClient | undefined;
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured");
  }

  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      keepAlive: true,
    },
  });

  client.on("error", (error) => {
    console.error("Redis client error:", error);
  });

  return client;
}

function getRedisClient() {
  if (!global.__expenseAiRedisClient__) {
    global.__expenseAiRedisClient__ = createRedisClient();
  }

  return global.__expenseAiRedisClient__ as AppRedisClient;
}

export async function ensureRedis() {
  const redis = getRedisClient();

  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis;
}

export async function createRedisSubscriber() {
  const client = await ensureRedis();
  const subscriber = client.duplicate();

  subscriber.on("error", (error) => {
    console.error("Redis subscriber error:", error);
  });

  if (!subscriber.isOpen) {
    await subscriber.connect();
  }

  return subscriber;
}
