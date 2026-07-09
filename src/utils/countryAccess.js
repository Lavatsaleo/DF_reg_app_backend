const { COUNTRIES } = require("../data/administrativeLocations");

const COUNTRY_ADMIN_ROLE = "COUNTRY_ADMIN";
const SUPER_ADMIN_ROLE = "ADMIN";

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

  // A country admin without a country should not accidentally see global data.
  if (user?.role === COUNTRY_ADMIN_ROLE) {
    return { id: "__NO_COUNTRY_SCOPE__" };
  }

  // Backward compatibility for existing chairperson/member/viewer accounts created before country scoping.
  return {};
}

function getCommitteeMemberCountryFilter(user) {
  if (isSuperAdmin(user)) return {};

  const country = getUserCountry(user);
  if (country) return { country };

  if (user?.role === COUNTRY_ADMIN_ROLE) {
    return { id: "__NO_COUNTRY_SCOPE__" };
  }

  return {};
}

function canAccessCountry(user, country) {
  if (isSuperAdmin(user)) return true;

  const userCountry = getUserCountry(user);
  const targetCountry = normalizeCountry(country);

  if (!userCountry) {
    // Preserve access for legacy non-country-scoped internal users, but never for a country admin.
    return user?.role !== COUNTRY_ADMIN_ROLE;
  }

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
