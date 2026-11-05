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

// Super admins may narrow any list to one country; everyone else stays locked to their own.
function getRequestedCountry(user, requestedCountry) {
  if (!isSuperAdmin(user)) return getUserCountry(user);
  const country = normalizeCountry(requestedCountry);
  return COUNTRIES.includes(country) ? country : null;
}

function getRequestedApplicantCountryFilter(user, requestedCountry) {
  const country = isSuperAdmin(user) ? getRequestedCountry(user, requestedCountry) : null;
  return country ? { country } : getApplicantCountryFilter(user);
}

function getRequestedCommitteeMemberCountryFilter(user, requestedCountry) {
  const country = isSuperAdmin(user) ? getRequestedCountry(user, requestedCountry) : null;
  return country ? { country } : getCommitteeMemberCountryFilter(user);
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
  getRequestedCountry,
  getRequestedApplicantCountryFilter,
  getRequestedCommitteeMemberCountryFilter,
  canAccessCountry,
  resolveCountryForManagedRecord,
};
