require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Sightsavers Digital Futures Registration Backend running on port ${PORT}`
  );
});