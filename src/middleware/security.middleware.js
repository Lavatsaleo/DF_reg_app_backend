/*
 * HTTP hardening shared by every route: security headers, request rate limits,
 * log redaction for private links, and error responses that never expose internals.
 */

const isProduction = () => process.env.NODE_ENV === "production";

// The API only returns JSON, so it never needs to run scripts, load resources or be framed.
function securityHeaders(req, res, next) {
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // Responses carry personal data and session details, so browsers and proxies must not keep them.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  if (isProduction()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

/*
 * Fixed-window rate limiter kept in memory. Enough for a single API instance; with several
 * instances behind a load balancer each keeps its own count, so limits become per instance.
 */
function createRateLimiter({ name, windowMs, max, key = () => "", message }) {
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [entryKey, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(entryKey);
    }
  }, Math.min(windowMs, 60 * 1000));
  sweep.unref?.();

  function limiter(req, res, next) {
    // Local load testing only; limits always apply in production.
    if (process.env.DISABLE_RATE_LIMITS === "true" && !isProduction()) return next();

    const now = Date.now();
    const entryKey = `${req.ip}|${key(req)}`;
    let entry = hits.get(entryKey);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(entryKey, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      console.warn(`[rate-limit] ${name} blocked`, { ip: req.ip });
      return res.status(429).json({
        success: false,
        message: message || "Too many requests. Please wait a few minutes and try again.",
      });
    }
    return next();
  }

  // Lets a handler clear the count, e.g. after a successful sign in.
  limiter.reset = (req) => hits.delete(`${req.ip}|${key(req)}`);
  return limiter;
}

const MINUTE = 60 * 1000;
const lowerCaseEmail = (req) => String(req.body?.email || "").trim().toLowerCase();

const rateLimits = {
  // Broad ceiling for any API call from one address.
  api: createRateLimiter({ name: "api", windowMs: 15 * MINUTE, max: 1500 }),
  // Per address and account, so one attacker can't guess passwords for a single staff member.
  login: createRateLimiter({
    name: "login",
    windowMs: 15 * MINUTE,
    max: 8,
    key: lowerCaseEmail,
    message: "Too many sign-in attempts. Please wait 15 minutes, or reset your password.",
  }),
  loginByAddress: createRateLimiter({ name: "login-ip", windowMs: 15 * MINUTE, max: 40 }),
  passwordReset: createRateLimiter({ name: "password-reset", windowMs: 60 * MINUTE, max: 6 }),
  // Admins sending set-password links to the people they manage.
  adminPasswordReset: createRateLimiter({ name: "admin-password-reset", windowMs: 60 * MINUTE, max: 40 }),
  bootstrap: createRateLimiter({ name: "bootstrap", windowMs: 60 * MINUTE, max: 5 }),
  // Public lookups by reference or phone number: limits guessing other people's details.
  publicLookup: createRateLimiter({
    name: "public-lookup",
    windowMs: 15 * MINUTE,
    max: 30,
    message: "Too many lookups. Please wait 15 minutes and try again.",
  }),
  // Each request emails a code, so keep this low; codes themselves lock after 5 wrong guesses.
  verificationCodeRequest: createRateLimiter({
    name: "verification-code-request",
    windowMs: 15 * MINUTE,
    max: 10,
    message: "Too many code requests. Please wait 15 minutes and try again.",
  }),
  verificationCodeVerify: createRateLimiter({
    name: "verification-code-verify",
    windowMs: 15 * MINUTE,
    max: 30,
    message: "Too many attempts. Please wait 15 minutes and try again.",
  }),
  draftSave: createRateLimiter({ name: "draft-save", windowMs: 15 * MINUTE, max: 300 }),
  applicationSubmit: createRateLimiter({ name: "application-submit", windowMs: 60 * MINUTE, max: 10 }),
  contactRequest: createRateLimiter({ name: "contact-request", windowMs: 60 * MINUTE, max: 10 }),
  // Private invitation links: generous enough for autosave, low enough to stop token guessing at scale.
  invitation: createRateLimiter({ name: "invitation", windowMs: 15 * MINUTE, max: 600 }),
  upload: createRateLimiter({ name: "upload", windowMs: 60 * MINUTE, max: 40 }),
};

// Invitation and reset links carry secrets in the path; never write them to the logs.
function redactUrl(url) {
  return String(url || "")
    .replace(/(\/invite\/)[^/?#]+/g, "$1[redacted]")
    .replace(/(\/reset-password\/)[^/?#]+/g, "$1[redacted]")
    .replace(/([?&](?:token|code|state)=)[^&#]+/g, "$1[redacted]");
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: "Route not found." });
}

// Last error handler: malformed JSON, oversized bodies and anything unexpected get a safe message.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "The request body is not valid JSON." });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "The request is too large." });
  }
  if (error?.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE"
        ? "A file is larger than 10 MB. Please upload a smaller file."
        : "The uploaded files could not be accepted.",
    });
  }
  if (error?.statusCode === 400 && error.expose) {
    return res.status(400).json({ success: false, message: error.message });
  }
  // Other client errors raised by Express itself (e.g. a malformed URL) stay 4xx, with a generic message.
  const clientStatus = Number(error?.status || error?.statusCode);
  if (clientStatus >= 400 && clientStatus < 500) {
    return res.status(clientStatus).json({ success: false, message: "The request could not be processed." });
  }

  console.error("Unhandled request error:", { method: req.method, url: redactUrl(req.originalUrl), error });
  return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
}

module.exports = {
  securityHeaders,
  createRateLimiter,
  rateLimits,
  redactUrl,
  notFound,
  errorHandler,
};
