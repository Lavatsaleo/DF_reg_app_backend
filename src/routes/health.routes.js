const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "Sightsavers Digital Futures Registration Backend",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;