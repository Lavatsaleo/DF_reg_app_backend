const { findActiveApiKey } = require("../services/apiAccessKey.service");

// Data API requests carry a read-only key: "Authorization: Bearer dfk_...".
async function requireApiKey(req, res, next) {
  try {
    const header = String(req.headers.authorization || "");
    const rawKey = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

    if (!rawKey) {
      return res.status(401).json({
        success: false,
        message: "Send your API key in the Authorization header: Bearer dfk_...",
      });
    }

    const key = await findActiveApiKey(rawKey, req.ip);
    if (!key) {
      return res.status(401).json({
        success: false,
        message: "This API key is not valid. It may have expired or been revoked. Ask a super admin for a new key.",
      });
    }

    req.apiKey = key;
    return next();
  } catch (error) {
    console.error("API key check failed:", error);
    return res.status(500).json({ success: false, message: "We could not check the API key. Please try again." });
  }
}

module.exports = { requireApiKey };
