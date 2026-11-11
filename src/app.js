const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const healthRoutes = require("./routes/health.routes");
const registrationRoutes = require("./routes/registration.routes");
const basicSkillsTestRoutes = require("./routes/basicSkillsTest.routes");
const committeeRoutes = require("./routes/committee.routes");
const authRoutes = require("./routes/auth.routes");
const consentRoutes = require("./routes/consent.routes");
const participantRegistrationRoutes = require("./routes/participantRegistration.routes");
const {
  securityHeaders,
  rateLimits,
  redactUrl,
  notFound,
  errorHandler,
} = require("./middleware/security.middleware");

const app = express();

app.disable("x-powered-by");
/*
 * Client addresses (used for rate limits) come from X-Forwarded-For only when the request
 * arrived through a proxy on a private network. Set TRUST_PROXY to the number of proxy hops
 * (e.g. 1) if the reverse proxy sits on a public address.
 */
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : "loopback, linklocal, uniquelocal");

function getAllowedOrigins() {
  return [process.env.FRONTEND_BASE_URL, ...(process.env.CORS_ALLOWED_ORIGINS || "").split(",")]
    .map((origin) => String(origin || "").trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// The production frontend is served from the same origin; only listed origins get cross-origin access.
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || getAllowedOrigins().includes(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600,
}));
app.use(securityHeaders);

morgan.token("safe-url", (req) => redactUrl(req.originalUrl));
app.use(morgan(":method :safe-url :status :res[content-length] - :response-time ms"));

// Large files go through multipart uploads; JSON bodies only carry answers and signatures.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use("/api", rateLimits.api);
app.use("/api/health", healthRoutes);
app.use("/api/dashboard", require("./routes/applicationDashboard.routes"));
app.use("/api/registrations", registrationRoutes);
app.use("/api/basic-skills-test", basicSkillsTestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/committee", committeeRoutes);
app.use("/api/consents", consentRoutes);
app.use("/api/participant-registration", participantRegistrationRoutes);
// Read-only data API for R / RStudio (API keys) and the admin screens that manage those keys.
app.use("/api/data", require("./routes/dataApi.routes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
