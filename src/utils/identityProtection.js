/*
 * Who may see a participant's identity, and how identifying details are removed when they may not.
 *
 * The selection committee always reviews without names. Country admins also see participants
 * without names, contacts or identity documents until the committee has selected them; from then
 * on (participant registration, verification, enrolment) they see the full profile. Super admins
 * always see everything.
 */

// Statuses reached only after the committee has selected someone.
const IDENTITY_REVEALED_STATUSES = [
  "APPROVED_FOR_ENROLLMENT",
  "PARTICIPANT_REGISTRATION_PENDING",
  "PARTICIPANT_REGISTRATION_COMPLETED_PENDING_VERIFICATION",
  "ENROLLED_IN_DHIS2_PROGRAM",
];

// Names, contacts, identity numbers, exact location and signatures.
const IDENTIFYING_QUESTION_CODES = new Set([
  "FIRST_NAME", "MIDDLE_NAME", "LAST_NAME", "OTHER_NAMES",
  "DATE_OF_BIRTH", "YEAR_OF_BIRTH",
  "EMAIL", "CONTACT_NUMBER", "ALTERNATIVE_CONTACT_NUMBER",
  "PHONE_NUMBER", "MOBILE_NUMBER", "WHATSAPP_NUMBER",
  "NATIONAL_ID_NUMBER", "NATIONAL_ID_CARD_NUMBER",
  "NATIONAL_ID_TYPE", "PASSPORT_NUMBER",
  "NEXT_OF_KIN_NAME", "NEXT_OF_KIN_PHONE", "NEXT_OF_KIN_RELATIONSHIP",
  "ADDRESS", "STREET_ADDRESS", "TOWN", "WARD", "SUB_COUNTY",
  "COUNTY", "STATE", "REGION", "DISTRICT",
  "REGISTRATION_CONSENT", "CONSENT_SIGNATURE", "CONSENT_SIGNATURE_DATA",
  "ASSISTANT_NAME", "ASSISTANT_SIGNATURE", "ASSISTANT_SIGNATURE_DATA",
  "APPLICATION_FORM_VERSION",
]);

function isIdentifyingQuestionCode(questionCode) {
  const code = String(questionCode || "").toUpperCase();
  if (IDENTIFYING_QUESTION_CODES.has(code)) return true;
  if (code.startsWith("PR_") || code.startsWith("CONSENT_")) return true;
  return /NAME|SIGNATURE|PASSPORT|NATIONAL_ID|PHONE|EMAIL|CONTACT_NUMBER|ADDRESS|IP_ADDRESS|DOCUMENT_NUMBER/.test(code);
}

// Removes the person's own name and contacts, and any email, link or phone number, from free text.
function redactNarrative(value, applicant = {}) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  const identifiers = [
    applicant.firstName,
    applicant.lastName,
    applicant.email,
    applicant.contactNumber,
    applicant.alternativeContactNumber,
  ].filter((item) => String(item || "").trim().length >= 3);

  for (const identifier of identifiers) {
    const escaped = String(identifier).replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "gi"), "[redacted]");
  }

  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, "[link redacted]")
    .replace(/(?:\+?\d[\d\s()/-]{7,}\d)/g, "[number redacted]");
}

function isIdentityRevealedStatus(status) {
  return IDENTITY_REVEALED_STATUSES.includes(status);
}

// Super admins always; country admins once the committee has selected the person.
function canSeeIdentity(user, applicant) {
  if (user?.role === "ADMIN") return true;
  return isIdentityRevealedStatus(applicant?.status);
}

module.exports = {
  IDENTITY_REVEALED_STATUSES,
  IDENTIFYING_QUESTION_CODES,
  isIdentifyingQuestionCode,
  redactNarrative,
  isIdentityRevealedStatus,
  canSeeIdentity,
};
