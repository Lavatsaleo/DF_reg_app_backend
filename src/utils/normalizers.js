function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function normalizeContactNumber(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  // Keep digits only so values like +254 700 000 000 and 254700000000 match.
  const digitsOnly = rawValue.replace(/\D/g, "");
  return digitsOnly || null;
}

module.exports = {
  normalizeEmail,
  normalizeContactNumber,
};
