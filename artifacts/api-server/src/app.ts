import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { authHandler } from "@workspace/auth";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const webOrigins = (process.env["WEB_ORIGIN"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: webOrigins.length > 0 ? webOrigins : true,
    credentials: true,
  }),
);

// Mounted before express.json(): better-auth's handler reads and parses the
// raw request body itself, so a body-parser upstream would consume the
// stream first and break it.
app.all("/api/auth/*splat", authHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
