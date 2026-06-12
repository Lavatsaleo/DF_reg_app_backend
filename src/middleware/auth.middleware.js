const prisma = require("../config/prisma");
const { verifyAuthToken } = require("../utils/authToken");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    const payload = verifyAuthToken(token);

    if (!payload?.sub) {
      return res.status(401).json({
        success: false,
        message: "Please sign in to continue.",
      });
    }

    const user = await prisma.staffUser.findUnique({
      where: { id: payload.sub },
      include: { committeeMember: true },
    });

    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Your session is no longer active. Please sign in again.",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Please sign in to continue.",
    });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRoles,
};
