import Redis from "ioredis";
import { config } from "../config";

let redis: Redis | null = null;

if (config.redis.enabled) {
  redis = new Redis(config.redis.url, {
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redis.on("connect", () => console.log("⚡ Redis connected"));
  redis.on("error", (err) => console.warn("Redis error:", err.message));
}

export { redis };

export async function connectRedis() {
  if (redis) {
    try {
      await redis.connect();
    } catch (err) {
      console.warn("Redis not available, continuing without cache");
      redis = null;
    }
  }
}

export async function disconnectRedis() {
  if (redis) {
    await redis.quit();
  }
}
