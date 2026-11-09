require("dotenv").config();

const app = require("./app");
const { getSecret } = require("./utils/authToken");

// Fail at startup rather than on the first staff login.
const secret = getSecret();
if (process.env.NODE_ENV === "production" && secret.length < 32) {
  console.warn("[security] AUTH_TOKEN_SECRET is shorter than 32 characters. Use a long random value (e.g. 48+ characters).");
}
if (process.env.NODE_ENV === "production" && process.env.BOOTSTRAP_ADMIN_TOKEN) {
  console.warn("[security] BOOTSTRAP_ADMIN_TOKEN is set. Remove it once the first admin account exists.");
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Sightsavers Digital Futures Registration Backend running on port ${PORT}`
  );
});