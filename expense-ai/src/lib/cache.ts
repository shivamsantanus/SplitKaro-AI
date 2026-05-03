import { ensureRedis } from "./redis";

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await ensureRedis();
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const redis = await ensureRedis();
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // fail-open — cache write failures don't break the request
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const redis = await ensureRedis();
    await redis.del(key);
  } catch {
    // ignore
  }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const redis = await ensureRedis();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch {
    // ignore
  }
}
