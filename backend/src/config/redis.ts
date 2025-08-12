/**
 * Redis Configuration and Client
 */

import { createClient, RedisClientType } from "redis";

import { logger } from "../utils/logger";

let redisClient: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType> {
  try {
    if (redisClient === null) {
      redisClient = createClient({
        socket: {
          host: process.env.REDIS_HOST ?? "redis",
          port: parseInt(process.env.REDIS_PORT ?? "6379"),
        },
      });

      redisClient.on("error", (err) => {
        logger.error("Redis Client Error:", err);
      });

      redisClient.on("connect", () => {
        logger.info("✅ Redis Client Connected");
      });

      await redisClient.connect();
    }
    return redisClient;
  } catch (error: unknown) {
    logger.error("Failed to connect to Redis:", error);
    throw error;
  }
}

export function disconnectRedis(): void {
  if (redisClient !== null) {
    redisClient.destroy();
    redisClient = null;
    logger.info("Redis disconnected");
  }
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient?.isOpen !== true) {
    await connectRedis();
  }
  if (redisClient === null) {
    throw new Error("Redis client is not initialized");
  }
  return redisClient;
}

export default { connectRedis, disconnectRedis, getRedisClient };
