/*
 * One live application per person.
 *
 * A person is matched by email, mobile number or national ID. While an application is live its
 * "active" keys hold those values, and unique indexes on them make the database refuse a second
 * live application. When an application ends (not eligible, or not selected by the committee) the
 * keys are cleared, so the person may apply again, to the same or another pathway.
 */

// Statuses that end an application and free the person to apply again.
const APPLICATION_ENDED_STATUSES = ["INELIGIBLE", "REJECTED_BY_REVIEW_COMMITTEE"];

function isApplicationEnded(status) {
  return APPLICATION_ENDED_STATUSES.includes(status);
}

// "KENYA:12345678": the same number in two countries is two different documents.
function normalizeNationalId(country, idNumber) {
  const cleanCountry = String(country || "").trim().toUpperCase();
  const cleanId = String(idNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleanCountry || cleanId.length < 4) return null;
  return `${cleanCountry}:${cleanId}`;
}

// The keys to store on a new application: empty when it has already ended (e.g. not eligible).
function buildActiveIdentityKeys({ normalizedEmail, normalizedContactNumber, normalizedNationalId }, status) {
  if (isApplicationEnded(status)) {
    return { activeEmailKey: null, activePhoneKey: null, activeNationalIdKey: null };
  }
  return {
    activeEmailKey: normalizedEmail || null,
    activePhoneKey: normalizedContactNumber || null,
    activeNationalIdKey: normalizedNationalId || null,
  };
}

// Data that ends an application: clears the keys so the person can apply again.
const RELEASE_ACTIVE_IDENTITY = { activeEmailKey: null, activePhoneKey: null, activeNationalIdKey: null };

// The person's live application, if any, matched on any of the three identifiers.
async function findActiveApplication(db, { normalizedEmail, normalizedContactNumber, normalizedNationalId }, select) {
  const or = [];
  if (normalizedEmail) or.push({ activeEmailKey: normalizedEmail });
  if (normalizedContactNumber) or.push({ activePhoneKey: normalizedContactNumber });
  if (normalizedNationalId) or.push({ activeNationalIdKey: normalizedNationalId });
  if (!or.length) return null;
  return db.applicant.findFirst({ where: { OR: or }, orderBy: { createdAt: "desc" }, select });
}

// Which identifier matched, in words for the applicant ("mobile number", "email address" ...).
function describeMatch(existing, { normalizedEmail, normalizedContactNumber, normalizedNationalId }) {
  const matched = [];
  if (normalizedContactNumber && existing.activePhoneKey === normalizedContactNumber) matched.push("mobile number");
  if (normalizedEmail && existing.activeEmailKey === normalizedEmail) matched.push("email address");
  if (normalizedNationalId && existing.activeNationalIdKey === normalizedNationalId) matched.push("ID number");
  if (!matched.length) return "details";
  return matched.length === 1 ? matched[0] : `${matched.slice(0, -1).join(", ")} and ${matched[matched.length - 1]}`;
}

// A unique-index clash on an active key means a live application appeared at the same moment.
function isActiveIdentityConflict(error) {
  if (error?.code !== "P2002") return false;
  const target = [].concat(error.meta?.target || []).join(",");
  return !target || /active(Email|Phone|NationalId)Key/.test(target);
}

module.exports = {
  APPLICATION_ENDED_STATUSES,
  RELEASE_ACTIVE_IDENTITY,
  isApplicationEnded,
  normalizeNationalId,
  buildActiveIdentityKeys,
  findActiveApplication,
  describeMatch,
  isActiveIdentityConflict,
};
