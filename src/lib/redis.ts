import * as redis from "redis";

export let redisClient: redis.RedisClientType;

const getClient = () => {
    if (!redisClient) {
        try {
            redisClient = redis.createClient({
                url: process.env.REDIS_URL,
                socket: {
                    reconnectStrategy: (retries) => {
                        console.log(`Redis reconnecting... ${retries}`);

                        if (retries > 20) {
                            return new Error(`Redis reconnection failed after ${retries} retries`);
                        }

                        return Math.min(retries * 750, 5000);
                    }
                }
            });
        } catch (error: any) {
            console.log(`[Redis] Error while creating redis client: ${error.message}`);
        }
    }
    redisClient.on("connect", () => {
        console.log(`[Redis] Client connected`);
    })

    redisClient.on("error", (err) => {
        console.log(`[Redis] Client error: ${err}`);
    });
    return redisClient;
}

export const connect = async () => {
    const client = getClient();
    await client.connect()
}

export const close = async () => {
    if (redisClient) {
        await redisClient.quit();
        console.log(`[Redis] Client closed`);
    }
}

export const loader = async () => {
    await connect();
}