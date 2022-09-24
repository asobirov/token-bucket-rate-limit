import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "./middlewares/rate-limit";
import { connect as connectRedis } from "./lib/redis";

const app = express();

(async () => {

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(helmet());
    app.use(cors());

    // Connect to redis

    await connectRedis();

    app.use(async (req, res, next) => {
        const remoteAddress = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress);

        if (!remoteAddress) {
            return res.status(400).send('Bad request');
        }

        const { success, limit, remaining, reset } = await rateLimit({
            identifier: remoteAddress,
            maxTokens: 2000,
            refillRate: 400,
            interval: 10 * 60 * 1000,
        })

        console.log(remoteAddress, success, limit, remaining, new Date(reset).toLocaleTimeString());

        if (!success) {
            return res.status(429).send({
                message: 'Too many requests',
                reset: new Date(reset).toISOString(),
            });
        }

        return next();
    })

    app.get("/", (req, res) => {
        res.json({
            ok: true,
        })
    })

    app.listen(5009, () => console.log(`Server up and ready on port ${5009} in ${process.env.NODE_ENV} mode`));
})();
