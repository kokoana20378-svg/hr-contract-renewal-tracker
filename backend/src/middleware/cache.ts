import type { Request, Response, NextFunction } from "express";
import { redis } from "../redis";

export function cacheMiddleware(durationSeconds = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redis) {
      next();
      return;
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.json(JSON.parse(cached));
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = function (body: unknown) {
        redis?.setex(key, durationSeconds, JSON.stringify(body));
        return originalJson(body);
      };

      next();
    } catch {
      next();
    }
  };
}
