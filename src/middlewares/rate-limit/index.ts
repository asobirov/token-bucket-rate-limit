import { redisClient } from "../../lib/redis";
import { Cache } from "./cache";

type ReateLimitOptions = {
    identifier: string
    refillRate: number;
    interval: number;
    maxTokens: number;
}

const script = `
        local key         = KEYS[1]           -- identifier including prefixes
        local maxTokens   = tonumber(ARGV[1]) -- maximum number of tokens
        local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
        local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
        local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
        local remaining   = 0
        
        local bucket = redis.call("HMGET", key, "updatedAt", "tokens")
        
        if bucket[1] == false then
          -- The bucket does not exist yet, so we create it and add a ttl.
          remaining = maxTokens - 1
          
          redis.call("HMSET", key, "updatedAt", now, "tokens", remaining)
          redis.call("PEXPIRE", key, interval)
  
          return {remaining, now + interval}
        end

        -- The bucket does exist
  
        local updatedAt = tonumber(bucket[1])
        local tokens = tonumber(bucket[2])
  
        if now >= updatedAt + interval then
          remaining = math.min(maxTokens, tokens + refillRate) - 1
          
          redis.call("HMSET", key, "updatedAt", now, "tokens", remaining)
          return {remaining, now + interval}
        end
  
        if tokens > 0 then
          remaining = tokens - 1
          redis.call("HMSET", key, "updatedAt", now, "tokens", remaining)
        end
  
        return {remaining, updatedAt + interval}
       `;

export const rateLimit = async ({
    identifier,
    refillRate,
    interval,
    maxTokens,
}: ReateLimitOptions) => {
    if (refillRate <= 0 || interval <= 0 || maxTokens <= 0) {
        throw new Error('Invalid rate limit options');
    }

    const cache = new Cache(new Map());

    const { blocked, reset: resetB } = cache.isBlocked(identifier);

    if (blocked) {
        return {
            success: false,
            limit: maxTokens,
            remaining: 0,
            reset: resetB
        }
    }

    const now = Date.now();
    const key = [identifier, Math.floor(now / interval)].join(':');

    const [remaining, reset] = await redisClient.eval(script, {
        keys: [key],
        arguments: [maxTokens.toString(), interval.toString(), refillRate.toString(), now.toString()]
    }) as [number, number];

    const success = remaining > 0;

    if (!success) {
        cache.blockUntil(identifier, reset);
    }

    return {
        success,
        limit: maxTokens,
        remaining,
        reset,
    };
}