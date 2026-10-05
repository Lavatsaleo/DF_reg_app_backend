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

const app = express();

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
}));
app.use(morgan("dev"));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api/health", healthRoutes);
app.use("/api/dashboard", require("./routes/applicationDashboard.routes"));
app.use("/api/registrations", registrationRoutes);
app.use("/api/basic-skills-test", basicSkillsTestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/committee", committeeRoutes);
app.use("/api/consents", consentRoutes);
app.use("/api/participant-registration", participantRegistrationRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

module.exports = app;