require("dotenv").config();

const app = require("./app");
const { getSecret } = require("./utils/authToken");

// Fail at startup rather than on the first staff login.
getSecret();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Sightsavers Digital Futures Registration Backend running on port ${PORT}`
  );
});