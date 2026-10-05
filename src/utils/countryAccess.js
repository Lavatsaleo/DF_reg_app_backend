const { COUNTRIES } = require("../data/administrativeLocations");

const COUNTRY_ADMIN_ROLE = "COUNTRY_ADMIN";
const SUPER_ADMIN_ROLE = "ADMIN";
const NO_COUNTRY_SCOPE = { id: "__NO_COUNTRY_SCOPE__" };

function toSafeString(value) {
  return String(value || "").trim();
}

function normalizeCountry(value) {
  const clean = toSafeString(value);
  if (!clean) return null;

  const canonical = COUNTRIES.find(
    (country) => country.toLowerCase() === clean.toLowerCase()
  );

  return canonical || clean;
}

function isSuperAdmin(user) {
  // Existing ADMIN accounts remain the super admin accounts so the current admin login is not broken.
  return user?.role === SUPER_ADMIN_ROLE;
}

function getUserCountry(user) {
  return normalizeCountry(user?.country || user?.committeeMember?.country);
}

function isCountryScopedRole(user) {
  return [
    COUNTRY_ADMIN_ROLE,
    "COMMITTEE_CHAIRPERSON",
    "COMMITTEE_MEMBER",
    "VIEWER",
  ].includes(user?.role);
}

function getApplicantCountryFilter(user) {
  if (isSuperAdmin(user)) return {};

  const country = getUserCountry(user);
  if (country) return { country };

  // Only super admins see every country; any other account without a country sees nothing.
  return NO_COUNTRY_SCOPE;
}

function getCommitteeMemberCountryFilter(user) {
  if (isSuperAdmin(user)) return {};

  const country = getUserCountry(user);
  if (country) return { country };

  // Only super admins see every country; any other account without a country sees nothing.
  return NO_COUNTRY_SCOPE;
}

function canAccessCountry(user, country) {
  if (isSuperAdmin(user)) return true;

  const userCountry = getUserCountry(user);
  const targetCountry = normalizeCountry(country);

  if (!userCountry) return false;

  return targetCountry === userCountry;
}

function resolveCountryForManagedRecord(user, requestedCountry) {
  if (isSuperAdmin(user)) {
    return normalizeCountry(requestedCountry);
  }

  return getUserCountry(user);
}

module.exports = {
  COUNTRY_ADMIN_ROLE,
  COUNTRIES,
  normalizeCountry,
  isSuperAdmin,
  isCountryScopedRole,
  getUserCountry,
  getApplicantCountryFilter,
  getCommitteeMemberCountryFilter,
  canAccessCountry,
  resolveCountryForManagedRecord,
};
