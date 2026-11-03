/*
 * Eligibility rules per pathway and country, taken from the country page content supplied by the
 * programme managers (November 2026). A country without its own entry uses the pathway default.
 *
 * Age: the minimum is checked at application. The maximum is checked at application, or on
 * maxAgeAt (the expected end of training) where a country page says "at the time of completion".
 * Education: the completed levels that meet the requirement; null means no education requirement.
 * Location: Kenya Digital Entrepreneurship is for applicants in Nairobi and its environs; other
 * counties are flagged for programme review rather than rejected.
 */

const SENIOR_SECONDARY = "Senior Secondary";
const CERTIFICATE = "Certificate / Vocational / TVET";
const DIPLOMA = "Diploma /Ordinary National Diploma (OND)";
const HND = "Highter National Diploma (HND)";
const BACHELOR = "Bachelor's degree";
const POSTGRADUATE = "Postgraduate";

const BACHELOR_OR_HIGHER = [BACHELOR, POSTGRADUATE];
const HND_OR_HIGHER = [HND, ...BACHELOR_OR_HIGHER];
const DIPLOMA_OR_HIGHER = [DIPLOMA, ...HND_OR_HIGHER];
const SENIOR_SECONDARY_OR_HIGHER = [SENIOR_SECONDARY, CERTIFICATE, ...DIPLOMA_OR_HIGHER];

const PATHWAY_ELIGIBILITY = {
  PHYSICAL_ACADEMY: {
    default: { minAge: 18, maxAge: 33, education: BACHELOR_OR_HIGHER },
    Ghana: { minAge: 18, maxAge: 35, maxAgeAt: "2027-09-30", education: BACHELOR_OR_HIGHER },
    Kenya: { minAge: 18, maxAge: 35, education: BACHELOR_OR_HIGHER },
    Nigeria: { minAge: 18, maxAge: 33, education: HND_OR_HIGHER },
  },
  VIRTUAL_ACADEMY: {
    default: { minAge: 18, maxAge: 33, education: DIPLOMA_OR_HIGHER },
    // Ghana runs two cohorts; age is checked at the end of the first (April 2027).
    Ghana: { minAge: 18, maxAge: 35, maxAgeAt: "2027-04-30", education: DIPLOMA_OR_HIGHER },
    Kenya: { minAge: 18, maxAge: 35, education: DIPLOMA_OR_HIGHER },
    Nigeria: { minAge: 18, maxAge: 33, education: DIPLOMA_OR_HIGHER },
  },
  DIGITAL_ENTREPRENEURSHIP: {
    default: { minAge: 18, maxAge: 45, education: null },
    Ghana: { minAge: 18, maxAge: 45, maxAgeAt: "2027-06-30", education: SENIOR_SECONDARY_OR_HIGHER },
    Kenya: {
      minAge: 18,
      maxAge: 45,
      education: null,
      locationQuestionCode: "COUNTY",
      locations: ["Nairobi", "Kiambu", "Kajiado", "Machakos"],
      locationLabel: "Nairobi and its environs",
    },
    Nigeria: { minAge: 18, maxAge: 45, education: SENIOR_SECONDARY_OR_HIGHER },
  },
};

function getEligibilityRules(pathway, country) {
  const byCountry = PATHWAY_ELIGIBILITY[pathway];
  if (!byCountry) return null;
  return byCountry[country] || byCountry.default;
}

module.exports = { PATHWAY_ELIGIBILITY, getEligibilityRules };
