import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import { authHandler } from "@workspace/auth";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./lib/error-handler";

const app: Express = express();

app.use(helmet());

// Trust exactly one reverse-proxy hop (Render's edge) so req.ip reflects the
// real client address from X-Forwarded-For instead of Render's own IP for
// every request — required for per-visitor rate limiting below to mean
// anything. "1", not "true": trusting an unbounded chain would let a client
// forge its own X-Forwarded-For and spoof past the limiter.
app.set("trust proxy", 1);

// Covers everything below except /api/auth/*, which better-auth already
// rate-limits itself (3 sign-in attempts/10s, 100 general requests/10s,
// enabled automatically once NODE_ENV=production). This is a general
// anti-abuse net for the rest of the API — generous enough not to bother
// normal usage, tight enough to blunt a scripted hammering of any route.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const webOrigins = (process.env["WEB_ORIGIN"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (webOrigins.length === 0) {
  logger.warn(
    "WEB_ORIGIN is not set — cross-origin requests will be rejected. Same-origin requests (including the proxied frontend) are unaffected.",
  );
}

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
    // Fails closed: an empty allowlist rejects every cross-origin request
    // rather than falling back to "allow any origin" — with credentials:
    // true, that fallback would let any site on the internet make
    // authenticated requests using a visitor's session cookie if WEB_ORIGIN
    // were ever left unset.
    origin: webOrigins.length > 0 ? webOrigins : false,
    credentials: true,
  }),
);

// Mounted before express.json(): better-auth's handler reads and parses the
// raw request body itself, so a body-parser upstream would consume the
// stream first and break it.
app.all("/api/auth/*splat", authHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiLimiter, router);
app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
