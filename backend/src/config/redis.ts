/**
 * Redis Configuration and Client
 */

import { createClient, RedisClientType } from "redis";
import { logger } from "../utils/logger";

let redisClient: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType> {
  try {
    if (!redisClient) {
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
  } catch (error) {
    logger.error("Failed to connect to Redis:", error);
    throw error;
  }
}

export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.destroy();
    redisClient = null;
    logger.info("Redis disconnected");
  }
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient || !redisClient.isOpen) {
    await connectRedis();
  }
  return redisClient as RedisClientType;
}

export default { connectRedis, disconnectRedis, getRedisClient };
