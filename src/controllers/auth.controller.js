const prisma = require("../config/prisma");
const { createAuthToken, verifyAuthToken } = require("../utils/authToken");
const { generateSecureToken, hashToken } = require("../utils/tokenUtils");
const { hashPassword, verifyPassword } = require("../utils/passwordUtils");
const { normalizeEmail } = require("../utils/normalizers");
const { sendEmail } = require("../services/email.service");

const ALLOWED_ROLES = ["ADMIN", "COMMITTEE_CHAIRPERSON", "COMMITTEE_MEMBER", "VIEWER"];

function toSafeString(value) {
  return String(value || "").trim();
}

function normalizeStaffRole(value) {
  const role = toSafeString(value).toUpperCase().replace(/[\s-]+/g, "_");
  return ALLOWED_ROLES.includes(role) ? role : "COMMITTEE_MEMBER";
}

function normalizeSsoRole(value) {
  const role = normalizeStaffRole(value);
  return ALLOWED_ROLES.includes(role) ? role : "VIEWER";
}

function getFrontendBaseUrl() {
  return (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
}

function getBackendBaseUrl() {
  return (process.env.BACKEND_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
}

function getPasswordResetExpiryDate() {
  const minutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 60);
  return new Date(Date.now() + Math.max(15, minutes) * 60 * 1000);
}

function getStaffIdleTimeoutMinutes() {
  const minutes = Number(process.env.STAFF_IDLE_TIMEOUT_MINUTES || 20);
  return Math.max(5, minutes);
}

function getStaffIdleWarningSeconds() {
  const seconds = Number(process.env.STAFF_IDLE_WARNING_SECONDS || 60);
  return Math.max(15, seconds);
}

function getStaffTokenExpirySeconds() {
  const hours = Number(process.env.STAFF_TOKEN_EXPIRY_HOURS || 8);
  return Math.max(1, hours) * 60 * 60;
}

function getRequestIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

function summarizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    authProvider: user.authProvider || "LOCAL",
    committeeMemberId: user.committeeMemberId,
    committeeMember: user.committeeMember
      ? {
          id: user.committeeMember.id,
          fullName: user.committeeMember.fullName,
          email: user.committeeMember.email,
          role: user.committeeMember.role,
          isActive: user.committeeMember.isActive,
        }
      : null,
    lastLoginAt: user.lastLoginAt,
    lastPasswordResetAt: user.lastPasswordResetAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createStaffSession(user) {
  return createAuthToken({
    sub: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  }, getStaffTokenExpirySeconds());
}

function isSsoConfigured() {
  return (
    String(process.env.SSO_ENABLED || "false").toLowerCase() === "true" &&
    Boolean(process.env.SSO_CLIENT_ID) &&
    Boolean(process.env.SSO_AUTHORIZATION_URL) &&
    Boolean(process.env.SSO_TOKEN_URL)
  );
}

function getSsoRedirectUri() {
  return process.env.SSO_REDIRECT_URI || `${getBackendBaseUrl()}/api/auth/sso/callback`;
}

function buildFrontendRedirect(path, params = {}) {
  const url = new URL(path, getFrontendBaseUrl());
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function redirectSsoError(res, message) {
  return res.redirect(buildFrontendRedirect("/staff-sso", { error: message }));
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function isEmailDomainAllowed(email) {
  const allowed = String(process.env.SSO_ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return true;

  const domain = String(email || "").split("@").pop()?.toLowerCase();
  return Boolean(domain && allowed.includes(domain));
}

async function fetchJson(url, options = {}) {
  if (typeof fetch !== "function") {
    throw new Error("This Node.js runtime does not provide fetch. Use Node.js 18 or newer for SSO callback support.");
  }

  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(body.error_description || body.error || `HTTP ${response.status}`);
  }

  return body;
}

async function bootstrapAdmin(req, res) {
  try {
    const existingUsers = await prisma.staffUser.count();
    if (existingUsers > 0) {
      return res.status(409).json({
        success: false,
        message: "Initial admin has already been created. Please sign in with an existing admin account.",
      });
    }

    const fullName = toSafeString(req.body.fullName) || "System Administrator";
    const email = normalizeEmail(req.body.email || process.env.BOOTSTRAP_ADMIN_EMAIL);
    const password = toSafeString(req.body.password || process.env.BOOTSTRAP_ADMIN_PASSWORD);

    if (!email || !password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Provide an admin email and a password with at least 8 characters.",
      });
    }

    const user = await prisma.staffUser.create({
      data: {
        fullName,
        email,
        passwordHash: hashPassword(password),
        role: "ADMIN",
        authProvider: "LOCAL",
        isActive: true,
      },
    });

    const token = createStaffSession(user);

    return res.status(201).json({
      success: true,
      message: "Initial admin account created successfully.",
      token,
      user: summarizeUser(user),
    });
  } catch (error) {
    console.error("Bootstrap admin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create initial admin account.",
      error: error.message,
    });
  }
}

async function login(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = toSafeString(req.body.password);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await prisma.staffUser.findUnique({
      where: { email },
      include: { committeeMember: true },
    });

    if (!user || !user.isActive || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const updatedUser = await prisma.staffUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { committeeMember: true },
    });

    const token = createStaffSession(updatedUser);

    return res.json({
      success: true,
      message: "Signed in successfully.",
      token,
      user: summarizeUser(updatedUser),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sign in.",
      error: error.message,
    });
  }
}

async function me(req, res) {
  return res.json({
    success: true,
    user: summarizeUser(req.user),
  });
}

async function getSessionConfig(req, res) {
  return res.json({
    success: true,
    idleTimeoutMinutes: getStaffIdleTimeoutMinutes(),
    idleWarningSeconds: getStaffIdleWarningSeconds(),
    tokenExpiryHours: Number(process.env.STAFF_TOKEN_EXPIRY_HOURS || 8),
  });
}

async function requestPasswordReset(req, res) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Enter the staff email address.",
      });
    }

    const user = await prisma.staffUser.findUnique({ where: { email } });
    let resetUrl = null;
    let emailSent = false;

    if (user && user.isActive && (user.authProvider || "LOCAL") !== "SSO") {
      const token = generateSecureToken();
      const tokenHash = hashToken(token);
      resetUrl = `${getFrontendBaseUrl()}/reset-password/${encodeURIComponent(token)}`;

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: {
            staffUserId: user.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        }),
        prisma.passwordResetToken.create({
          data: {
            staffUserId: user.id,
            tokenHash,
            expiresAt: getPasswordResetExpiryDate(),
            requestedIp: getRequestIp(req),
          },
        }),
      ]);

      const result = await sendEmail({
        to: user.email,
        subject: "Reset your Digital Futures staff password",
        text: `Hello ${user.fullName},\n\nUse this link to reset your Digital Futures staff password:\n${resetUrl}\n\nThis link expires soon. If you did not request this, you can ignore this message.`,
        html: `<p>Hello ${user.fullName},</p><p>Use the link below to reset your Digital Futures staff password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires soon. If you did not request this, you can ignore this message.</p>`,
      });

      emailSent = result.sent === true;
    }

    const response = {
      success: true,
      message: "If this email is linked to an active staff account, password reset instructions will be sent.",
      emailSent,
    };

    if (resetUrl && !emailSent) {
      response.localResetUrl = resetUrl;
      response.message = "SMTP is not configured yet. Use the temporary reset link shown below for local testing.";
    }

    return res.json(response);
  } catch (error) {
    console.error("Request password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start password reset.",
      error: error.message,
    });
  }
}

async function completePasswordReset(req, res) {
  try {
    const token = toSafeString(req.body.token);
    const password = toSafeString(req.body.password);

    if (!token || !password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid reset link and a new password with at least 8 characters.",
      });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { staffUser: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date() || !resetToken.staffUser?.isActive) {
      return res.status(400).json({
        success: false,
        message: "This password reset link is invalid or has expired.",
      });
    }

    if ((resetToken.staffUser.authProvider || "LOCAL") === "SSO") {
      return res.status(400).json({
        success: false,
        message: "This account uses organisation single sign-on. Please reset your password through the organisation account system.",
      });
    }

    await prisma.$transaction([
      prisma.staffUser.update({
        where: { id: resetToken.staffUserId },
        data: {
          passwordHash: hashPassword(password),
          lastPasswordResetAt: new Date(),
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.json({
      success: true,
      message: "Password reset successfully. You can now sign in with the new password.",
    });
  } catch (error) {
    console.error("Complete password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password.",
      error: error.message,
    });
  }
}

async function getSsoConfig(req, res) {
  return res.json({
    success: true,
    enabled: isSsoConfigured(),
    providerName: process.env.SSO_PROVIDER_NAME || "Organisation SSO",
    loginUrl: `${getBackendBaseUrl()}/api/auth/sso/start`,
  });
}

async function startSso(req, res) {
  try {
    if (!isSsoConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Single sign-on is not configured yet.",
      });
    }

    const state = createAuthToken({
      type: "SSO_STATE",
      nonce: generateSecureToken(),
    }, 10 * 60);

    const authorizationUrl = new URL(process.env.SSO_AUTHORIZATION_URL);
    authorizationUrl.searchParams.set("client_id", process.env.SSO_CLIENT_ID);
    authorizationUrl.searchParams.set("redirect_uri", getSsoRedirectUri());
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", process.env.SSO_SCOPE || "openid profile email");
    authorizationUrl.searchParams.set("state", state);

    return res.redirect(authorizationUrl.toString());
  } catch (error) {
    console.error("Start SSO error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start single sign-on.",
      error: error.message,
    });
  }
}

async function ssoCallback(req, res) {
  try {
    if (!isSsoConfigured()) {
      return redirectSsoError(res, "Single sign-on is not configured yet.");
    }

    if (req.query.error) {
      return redirectSsoError(res, req.query.error_description || req.query.error);
    }

    const state = verifyAuthToken(req.query.state);
    if (!state || state.type !== "SSO_STATE") {
      return redirectSsoError(res, "The single sign-on session expired. Please try again.");
    }

    const code = toSafeString(req.query.code);
    if (!code) {
      return redirectSsoError(res, "No single sign-on code was returned.");
    }

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getSsoRedirectUri(),
      client_id: process.env.SSO_CLIENT_ID,
    });

    if (process.env.SSO_CLIENT_SECRET) {
      tokenBody.set("client_secret", process.env.SSO_CLIENT_SECRET);
    }

    const tokenResponse = await fetchJson(process.env.SSO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });

    let profile = null;

    if (process.env.SSO_USERINFO_URL && tokenResponse.access_token) {
      profile = await fetchJson(process.env.SSO_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });
    }

    if (!profile && tokenResponse.id_token) {
      profile = decodeJwtPayload(tokenResponse.id_token);
    }

    const email = normalizeEmail(profile?.email || profile?.preferred_username || profile?.upn);
    const subject = toSafeString(profile?.sub || profile?.oid || profile?.id);
    const fullName = toSafeString(profile?.name || [profile?.given_name, profile?.family_name].filter(Boolean).join(" ")) || email;

    if (!email || !subject) {
      return redirectSsoError(res, "The organisation account did not return the required email and subject details.");
    }

    if (!isEmailDomainAllowed(email)) {
      return redirectSsoError(res, "This email domain is not allowed for staff single sign-on.");
    }

    let user = await prisma.staffUser.findFirst({
      where: {
        OR: [
          { externalSubject: subject },
          { email },
        ],
      },
      include: { committeeMember: true },
    });

    if (!user) {
      const canAutoCreate = String(process.env.SSO_AUTO_CREATE_USERS || "false").toLowerCase() === "true";
      if (!canAutoCreate) {
        return redirectSsoError(res, "Your staff account has not been set up in the portal yet. Ask an admin to create your account first.");
      }

      user = await prisma.staffUser.create({
        data: {
          fullName,
          email,
          passwordHash: hashPassword(generateSecureToken()),
          role: normalizeSsoRole(process.env.SSO_DEFAULT_ROLE || "VIEWER"),
          authProvider: "SSO",
          externalSubject: subject,
          isActive: true,
        },
        include: { committeeMember: true },
      });
    } else if (!user.isActive) {
      return redirectSsoError(res, "Your staff account is inactive. Contact an administrator.");
    } else if (!user.externalSubject || user.authProvider !== "SSO") {
      user = await prisma.staffUser.update({
        where: { id: user.id },
        data: {
          externalSubject: user.externalSubject || subject,
          authProvider: user.authProvider === "LOCAL" ? "HYBRID" : (user.authProvider || "HYBRID"),
          lastLoginAt: new Date(),
        },
        include: { committeeMember: true },
      });
    } else {
      user = await prisma.staffUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: { committeeMember: true },
      });
    }

    const sessionToken = createStaffSession(user);
    return res.redirect(buildFrontendRedirect("/staff-sso", { token: sessionToken }));
  } catch (error) {
    console.error("SSO callback error:", error);
    return redirectSsoError(res, "Single sign-on failed. Please try again or use staff email sign in.");
  }
}

async function listStaffUsers(req, res) {
  try {
    const users = await prisma.staffUser.findMany({
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
      include: { committeeMember: true },
    });

    return res.json({
      success: true,
      users: users.map(summarizeUser),
    });
  } catch (error) {
    console.error("List staff users error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load staff users.",
      error: error.message,
    });
  }
}

async function createStaffUser(req, res) {
  try {
    const fullName = toSafeString(req.body.fullName);
    const email = normalizeEmail(req.body.email);
    const password = toSafeString(req.body.password);
    const role = normalizeStaffRole(req.body.role);
    const committeeMemberId = toSafeString(req.body.committeeMemberId) || null;

    if (!fullName || !email || !password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Full name, valid email and a password with at least 8 characters are required.",
      });
    }

    if (role === "COMMITTEE_MEMBER" && !committeeMemberId) {
      return res.status(400).json({
        success: false,
        message: "A committee member login must be linked to a committee member profile.",
      });
    }

    if (committeeMemberId) {
      const member = await prisma.committeeMember.findUnique({ where: { id: committeeMemberId } });
      if (!member) {
        return res.status(400).json({
          success: false,
          message: "Selected committee member profile was not found.",
        });
      }
    }

    const user = await prisma.staffUser.create({
      data: {
        fullName,
        email,
        passwordHash: hashPassword(password),
        role,
        authProvider: "LOCAL",
        committeeMemberId,
        isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
      },
      include: { committeeMember: true },
    });

    return res.status(201).json({
      success: true,
      message: "Staff user created successfully.",
      user: summarizeUser(user),
    });
  } catch (error) {
    console.error("Create staff user error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A staff user with this email address already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create staff user.",
      error: error.message,
    });
  }
}

async function updateStaffUser(req, res) {
  try {
    const userId = req.params.userId;
    const data = {};

    if (req.body.fullName !== undefined) data.fullName = toSafeString(req.body.fullName);
    if (req.body.email !== undefined) data.email = normalizeEmail(req.body.email);
    if (req.body.role !== undefined) data.role = normalizeStaffRole(req.body.role);
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    if (req.body.committeeMemberId !== undefined) data.committeeMemberId = toSafeString(req.body.committeeMemberId) || null;
    if (req.body.password) {
      const password = toSafeString(req.body.password);
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters.",
        });
      }
      data.passwordHash = hashPassword(password);
      data.authProvider = "LOCAL";
      data.lastPasswordResetAt = new Date();
      data.tokenVersion = { increment: 1 };
    }

    if (data.fullName === "" || data.email === "") {
      return res.status(400).json({
        success: false,
        message: "Full name and email cannot be blank.",
      });
    }

    const user = await prisma.staffUser.update({
      where: { id: userId },
      data,
      include: { committeeMember: true },
    });

    return res.json({
      success: true,
      message: "Staff user updated successfully.",
      user: summarizeUser(user),
    });
  } catch (error) {
    console.error("Update staff user error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Staff user not found.",
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Another staff user already uses this email address.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update staff user.",
      error: error.message,
    });
  }
}

module.exports = {
  bootstrapAdmin,
  login,
  me,
  getSessionConfig,
  requestPasswordReset,
  completePasswordReset,
  getSsoConfig,
  startSso,
  ssoCallback,
  listStaffUsers,
  createStaffUser,
  updateStaffUser,
};
