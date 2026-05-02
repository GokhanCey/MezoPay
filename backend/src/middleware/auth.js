const db = require("../db");

/**
 * API Key authentication middleware.
 * Extracts API key from X-API-Key header and attaches merchant to req.
 */
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "Missing API key. Set X-API-Key header." });
  }

  const merchant = db.prepare("SELECT * FROM merchants WHERE api_key = ?").get(apiKey);

  if (!merchant) {
    return res.status(403).json({ error: "Invalid API key." });
  }

  req.merchant = merchant;
  next();
}

module.exports = { authenticateApiKey };
