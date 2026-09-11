import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkAuthMiddleware } from "@workspace/auth";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./lib/error-handler";

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

// Reads the Clerk session token (if any) off the request and attaches it —
// sign-up/sign-in themselves happen client-side against Clerk's own API,
// not through this server.
app.use(clerkAuthMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
