const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const healthRoutes = require("./routes/health.routes");
const registrationRoutes = require("./routes/registration.routes");
const basicSkillsTestRoutes = require("./routes/basicSkillsTest.routes");
const committeeRoutes = require("./routes/committee.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();

app.use(cors());
app.use(morgan("dev"));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api/health", healthRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/basic-skills-test", basicSkillsTestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/committee", committeeRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

module.exports = app;