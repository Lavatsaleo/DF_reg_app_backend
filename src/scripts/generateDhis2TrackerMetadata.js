/*
  Builds the DHIS2 tracker program for Digital Futures from the portal's own question definitions,
  so the DHIS2 form always matches what applicants are asked.

  Outputs (backend/dhis2/):
    digital-futures-tracker-metadata.json  Import with Import/Export app > Metadata import (or POST /api/metadata).
    digital-futures-data-dictionary.csv     One row per field, for programme review.
    digital-futures-dhis2-mapping.json      Portal question code -> DHIS2 UID/option code, for the sync service.

  UIDs are derived from codes, so re-running the script gives the same UIDs and re-imports update in place.
  Run: npm run dhis2:metadata
*/
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const applicationForms = require("../data/applicationFormQuestions");
const participantForm = require("../data/participantRegistrationForm");
const { APPLICATION_CONSENTS, getApplicationConsent } = require("../data/physicalAcademyConsent");
const { COUNTRIES, LOCATION_HIERARCHY } = require("../data/administrativeLocations");

const OUT_DIR = path.join(__dirname, "../../dhis2");
const PATHWAYS = ["PHYSICAL_ACADEMY", "VIRTUAL_ACADEMY", "DIGITAL_ENTREPRENEURSHIP"];
const PREFIX = "DF";

// ---------------------------------------------------------------- helpers

const UID_LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const UID_CHARS = `${UID_LETTERS}0123456789`;
const usedUids = new Map();

// DHIS2 UID: 11 characters, starting with a letter. Deterministic per (kind, key).
function uid(kind, key) {
  const hash = crypto.createHash("sha256").update(`digital-futures:${kind}:${key}`).digest();
  let value = UID_LETTERS[hash[0] % UID_LETTERS.length];
  for (let i = 1; i < 11; i += 1) value += UID_CHARS[hash[i] % UID_CHARS.length];
  const owner = `${kind}:${key}`;
  if (usedUids.has(value) && usedUids.get(value) !== owner) throw new Error(`UID collision for ${owner}`);
  usedUids.set(value, owner);
  return value;
}

function shortHash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 6).toUpperCase();
}

// Fits text into a DHIS2 length limit, keeping it unique with a short hash when it has to be cut.
function fit(text, max) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 8).trim()}… ${shortHash(clean)}`.slice(0, max);
}

function slug(text) {
  return String(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "OPTION";
}

function codeFor(text, max = 50) {
  const value = slug(text);
  return value.length <= max ? value : `${value.slice(0, max - 7)}_${shortHash(value)}`;
}

function unique(list) {
  return [...new Set(list.filter((item) => item !== undefined && item !== null && item !== ""))];
}

function humanize(code) {
  return code.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------- field model

/*
  A field is one portal question. kind: "attribute" (registration form) or "dataElement" (a stage).
  type: TEXT | LONG_TEXT | NUMBER | INTEGER | PERCENTAGE | DATE | BOOLEAN | TRUE_ONLY | PHONE | EMAIL | FILE | IMAGE
        | SELECT (single choice with options) | MULTI (several choices: one TRUE_ONLY data element per option)
*/
const fields = new Map();

function addField(field) {
  const showIfs = [].concat(field.showIf || []);
  const existing = fields.get(field.code);
  if (!existing) {
    fields.set(field.code, { ...field, options: unique(field.options || []), pathways: unique(field.pathways || []), showIfs });
    return;
  }
  existing.options = unique([...existing.options, ...(field.options || [])]);
  existing.pathways = unique([...existing.pathways, ...(field.pathways || [])]);
  // Pathway forms can word the trigger differently (e.g. "Other" vs "Other (…)"); any of them shows the field.
  for (const condition of showIfs) {
    if (!existing.showIfs.some((known) => JSON.stringify(known) === JSON.stringify(condition))) existing.showIfs.push(condition);
  }
}

// "Section 6: Motivation & training readiness." -> "Motivation & training readiness"; one section per name.
const sectionNames = new Map();
function sectionName(raw) {
  const clean = String(raw || "").replace(/^section\s*\d+\s*:\s*/i, "").replace(/\.\s*$/, "").trim();
  const key = clean.toLowerCase();
  if (!sectionNames.has(key)) sectionNames.set(key, clean.charAt(0).toUpperCase() + clean.slice(1));
  return sectionNames.get(key);
}

function questionType(question) {
  const options = question.options || [];
  switch (question.responseType) {
    case "LONG_TEXT": return "LONG_TEXT";
    case "NUMBER": return "NUMBER";
    case "DATE": return "DATE";
    case "PHONE": return "PHONE";
    case "EMAIL": return "EMAIL";
    case "FILE": return "FILE";
    case "MULTI_SELECT": return "MULTI";
    case "BOOLEAN": return "BOOLEAN";
    case "SINGLE_SELECT": return options.length ? "SELECT" : "TEXT";
    default: return "TEXT";
  }
}

// Identity, contact and location: tracked entity attributes on the registration form.
const ATTRIBUTE_CODES = [
  "FIRST_NAME", "MIDDLE_NAME", "LAST_NAME", "SEX", "DATE_OF_BIRTH",
  "NATIONAL_ID_TYPE", "NATIONAL_ID_NUMBER", "NATIONAL_ID_CARD_NUMBER",
  "CONTACT_NUMBER", "ALTERNATIVE_CONTACT_NUMBER", "EMAIL", "PREFERRED_CONTACT_METHOD", "PREFERRED_CONTACT_METHOD_OTHER",
  "COUNTRY", "COUNTY", "SUB_COUNTY", "REGION", "STATE", "DISTRICT", "TOWN",
];

const ATTRIBUTE_SECTIONS = {
  "Programme identifiers": ["APPLICATION_REFERENCE", "PARTICIPANT_CODE", "APPLICATION_STATUS"],
  "Personal details": ["FIRST_NAME", "MIDDLE_NAME", "LAST_NAME", "SEX", "DATE_OF_BIRTH", "NATIONAL_ID_TYPE", "NATIONAL_ID_NUMBER", "NATIONAL_ID_CARD_NUMBER"],
  "Contact details": ["CONTACT_NUMBER", "ALTERNATIVE_CONTACT_NUMBER", "EMAIL", "PREFERRED_CONTACT_METHOD", "PREFERRED_CONTACT_METHOD_OTHER"],
  Location: ["COUNTRY", "COUNTY", "SUB_COUNTY", "REGION", "STATE", "DISTRICT", "TOWN"],
};

// First-level areas that have no options in the question definitions come from the location data.
function level1Options(countries) {
  return countries.flatMap((country) => Object.keys(LOCATION_HIERARCHY[country]?.children || {}));
}

// ----- system attributes
const APPLICANT_STATUSES = fs.readFileSync(path.join(__dirname, "../../prisma/schema.prisma"), "utf8")
  .match(/enum ApplicantStatus \{([^}]*)\}/)[1]
  .split(/\s+/)
  .filter(Boolean);

addField({ code: "APPLICATION_REFERENCE", label: "Application reference", text: "Application reference", type: "TEXT", kind: "attribute", unique: true, mandatory: true, searchable: true, displayInList: true });
addField({ code: "PARTICIPANT_CODE", label: "Participant code", text: "Participant code", type: "TEXT", kind: "attribute", unique: true, searchable: true, displayInList: true });
addField({
  code: "APPLICATION_STATUS",
  label: "Application status",
  text: "Current application status (kept up to date by the registration portal)",
  type: "SELECT",
  kind: "attribute",
  options: APPLICANT_STATUSES.map(humanize),
  optionCodes: APPLICANT_STATUSES,
  displayInList: true,
});

// ----- application questions (all three pathway forms, merged by question code)
const stageOf = {};
const sectionOf = {};
for (const pathway of PATHWAYS) {
  for (const question of applicationForms.QUESTION_SETS[pathway]) {
    const code = question.questionCode;
    const isAttribute = ATTRIBUTE_CODES.includes(code);
    let options = question.options || [];
    let type = questionType(question);
    if (!options.length && ["COUNTY", "REGION", "STATE"].includes(code)) {
      const countries = question.showIf?.operator === "in" ? question.showIf.value : [question.showIf?.value].filter(Boolean);
      options = level1Options(countries.length ? countries : COUNTRIES);
      type = "SELECT";
    }
    addField({
      code,
      label: question.questionText.length <= 60 ? question.questionText : humanize(code),
      text: question.questionText,
      type,
      kind: isAttribute ? "attribute" : "dataElement",
      options,
      showIf: question.showIf,
      pathways: [pathway],
      mandatory: Boolean(question.required) && !question.showIf,
    });
    if (!isAttribute) {
      stageOf[code] = "APPLICATION";
      sectionOf[code] = sectionOf[code] || sectionName(question.section || "Application");
    }
  }
}

// ----- application consent (recorded by the portal outside the question lists)
const consentVariants = Object.keys(APPLICATION_CONSENTS).map((pathway) => getApplicationConsent(pathway));
const consentOption = (key) => unique(consentVariants.flatMap((variant) => variant[key] || []));
const SIGNATURE_METHODS = ["Drawn", "Typed"];
const APPLICATION_CONSENT_FIELDS = [
  { code: "CONSENT_VERSION", text: "Consent form version", type: "TEXT" },
  { code: "CONSENT_NAME_ID_CODE", text: "Name given at consent", type: "TEXT" },
  { code: "CONSENT_SIGNED_DATE", text: "Consent date", type: "DATE" },
  { code: "CONSENT_SIGNATURE_METHOD", text: "Applicant signature method", type: "SELECT", options: SIGNATURE_METHODS },
  { code: "CONSENT_SIGNATURE_DATA", text: "Applicant electronic signature", type: "IMAGE" },
  { code: "CONSENT_COMPLETED_SELF", text: "Did you complete this consent section yourself?", type: "SELECT", options: consentOption("assistanceOptions") },
  { code: "CONSENT_ASSISTANT_NAME", text: "Full name of person providing assistance", type: "TEXT" },
  { code: "CONSENT_ASSISTANT_RELATIONSHIP", text: "Relationship to the applicant", type: "SELECT", options: consentOption("relationshipOptions") },
  { code: "CONSENT_ASSISTANT_RELATIONSHIP_OTHER", text: "Other relationship", type: "TEXT" },
  { code: "CONSENT_ASSISTANCE_TYPES", text: "Type of assistance provided", type: "MULTI", options: consentOption("assistanceTypeOptions") },
  { code: "CONSENT_ASSISTANCE_TYPE_OTHER", text: "Other assistance provided", type: "TEXT" },
  { code: "CONSENT_ASSISTANCE_LANGUAGE", text: "Language or communication method used", type: "TEXT" },
  { code: "CONSENT_ASSISTANT_SIGNATURE_METHOD", text: "Assistant signature method", type: "SELECT", options: SIGNATURE_METHODS },
  { code: "CONSENT_ASSISTANT_SIGNATURE_DATA", text: "Assistant electronic signature", type: "IMAGE" },
  { code: "CONSENT_ASSISTANCE_DATE", text: "Assistance date", type: "DATE" },
];
const ASSISTED = consentOption("assistanceOptions")[1];
for (const field of APPLICATION_CONSENT_FIELDS) {
  const assistanceField = /ASSIST/.test(field.code);
  addField({
    ...field,
    label: field.text,
    kind: "dataElement",
    pathways: PATHWAYS,
    showIf: assistanceField ? { questionCode: "CONSENT_COMPLETED_SELF", operator: "equals", value: ASSISTED } : undefined,
  });
  stageOf[field.code] = "APPLICATION";
  sectionOf[field.code] = "Consent";
}
// The consent question itself sits with the other consent fields.
sectionOf.REGISTRATION_CONSENT = "Consent";

// ----- eligibility outcome, calculated by the portal
const ELIGIBILITY_FIELDS = [
  { code: "ELIGIBILITY_SCREENING_STATUS", text: "Initial eligibility screening result", type: "SELECT", options: ["Eligible", "Not eligible", "Pending review"], optionCodes: ["ELIGIBLE", "NOT_ELIGIBLE", "PENDING_REVIEW"] },
  { code: "ELIGIBILITY_REASON", text: "Eligibility screening explanation", type: "LONG_TEXT" },
  { code: "AGE_AT_APPLICATION", text: "Age at application (years)", type: "INTEGER" },
];
for (const field of ELIGIBILITY_FIELDS) {
  addField({ ...field, label: field.text, kind: "dataElement", pathways: PATHWAYS });
  stageOf[field.code] = "APPLICATION";
  sectionOf[field.code] = "Eligibility screening (calculated by the portal)";
}

// ----- basic IT skills test
const SKILLS_FIELDS = [
  { code: "SKILLS_TEST_SCORE", text: "Skills test score (points)", type: "NUMBER", mandatory: true },
  { code: "SKILLS_TEST_MAX_SCORE", text: "Skills test maximum score", type: "NUMBER" },
  { code: "SKILLS_TEST_PERCENTAGE", text: "Skills test result (%)", type: "PERCENTAGE", mandatory: true },
  { code: "SKILLS_TEST_PASSED", text: "Passed the skills test", type: "BOOLEAN" },
  { code: "SKILLS_TEST_PASS_MARK", text: "Pass mark used (%)", type: "PERCENTAGE" },
  { code: "SKILLS_TEST_DURATION_SECONDS", text: "Time taken (seconds)", type: "INTEGER" },
  { code: "SKILLS_TEST_VERSION", text: "Test version", type: "TEXT" },
];
for (const field of SKILLS_FIELDS) {
  addField({ ...field, label: field.text, kind: "dataElement", pathways: PATHWAYS });
  stageOf[field.code] = "SKILLS_TEST";
  sectionOf[field.code] = "Basic IT skills test result";
}

// ----- selection committee review (one event per reviewer decision)
const COMMITTEE_FIELDS = [
  { code: "COMMITTEE_DECISION", text: "Committee decision", type: "SELECT", options: ["Selected", "Not selected", "Waitlisted", "Pending additional verification"], optionCodes: ["SELECTED", "NOT_SELECTED", "WAITLISTED", "PENDING_VERIFICATION"], mandatory: true },
  { code: "COMMITTEE_COMMENTS", text: "Committee comments", type: "LONG_TEXT" },
];
for (const field of COMMITTEE_FIELDS) {
  addField({ ...field, label: field.text, kind: "dataElement", pathways: PATHWAYS });
  stageOf[field.code] = "COMMITTEE_REVIEW";
  sectionOf[field.code] = "Committee decision";
}

// ----- participant registration & baseline survey (selected participants)
const moduleTitle = Object.fromEntries((participantForm.MODULES || []).map((module) => [module.id ?? module.code ?? module.key, module.title]));
for (const question of participantForm.QUESTIONS) {
  const code = question.questionCode;
  addField({
    code,
    label: humanize(code),
    text: question.questionText,
    type: questionType(question),
    kind: "dataElement",
    options: question.options || [],
    showIf: question.showIf,
    pathways: participantForm.PARTICIPANT_REGISTRATION_PATHWAYS || PATHWAYS,
    mandatory: Boolean(question.required) && !question.showIf,
  });
  stageOf[code] = "PARTICIPANT_REGISTRATION";
  sectionOf[code] = sectionName(question.section || moduleTitle[question.module] || "Participant registration");
}
const prConsent = participantForm.CONSENT;
const PR_OPTIONS = {
  PR_CONSENT_DECISION: prConsent.consentOptions,
  PR_CONSENT_COMPLETED_SELF: prConsent.assistanceOptions,
  PR_CONSENT_ASSISTANT_RELATIONSHIP: prConsent.relationshipOptions,
  PR_CONSENT_ASSISTANCE_TYPES: prConsent.assistanceTypeOptions,
  PR_CONSENT_SIGNATURE_METHOD: SIGNATURE_METHODS,
  PR_CONSENT_ASSISTANT_SIGNATURE_METHOD: SIGNATURE_METHODS,
};
for (const [code, text, responseType] of participantForm.CONSENT_RESPONSE_DEFINITIONS) {
  let type = { DATE: "DATE", LONG_TEXT: "LONG_TEXT", MULTI_SELECT: "MULTI" }[responseType] || "TEXT";
  if (/SIGNATURE_DATA$/.test(code)) type = "IMAGE";
  if (PR_OPTIONS[code] && type === "TEXT") type = "SELECT";
  addField({
    code,
    label: text,
    text,
    type,
    kind: "dataElement",
    options: PR_OPTIONS[code] || [],
    pathways: participantForm.PARTICIPANT_REGISTRATION_PATHWAYS || PATHWAYS,
    showIf: /ASSIST/.test(code) ? { questionCode: "PR_CONSENT_COMPLETED_SELF", operator: "equals", value: prConsent.assistanceOptions[1] } : undefined,
  });
  stageOf[code] = "PARTICIPANT_REGISTRATION";
  sectionOf[code] = "Participant registration consent";
}

// ---------------------------------------------------------------- DHIS2 objects

const VALUE_TYPES = {
  TEXT: "TEXT", LONG_TEXT: "LONG_TEXT", NUMBER: "NUMBER", INTEGER: "INTEGER_ZERO_OR_POSITIVE", PERCENTAGE: "PERCENTAGE",
  DATE: "DATE", BOOLEAN: "BOOLEAN", TRUE_ONLY: "TRUE_ONLY", PHONE: "PHONE_NUMBER", EMAIL: "EMAIL",
  FILE: "FILE_RESOURCE", IMAGE: "IMAGE", SELECT: "TEXT",
};

const metadata = {
  optionSets: [], options: [], trackedEntityAttributes: [], trackedEntityTypes: [], dataElements: [],
  programs: [], programStages: [], programStageSections: [], programSections: [],
  programRuleVariables: [], programRules: [], programRuleActions: [],
};
const mapping = {
  generatedFrom: "Digital Futures registration portal question definitions",
  program: null, trackedEntityType: null, attributes: {}, stages: {}, optionCodes: {},
};
const dictionary = [];

// Option sets: one per select field, codes stable and readable.
const optionCodeByField = {};
function optionSetFor(field) {
  const setId = uid("optionSet", field.code);
  const codes = [];
  const options = field.options.map((text, index) => {
    let code = field.optionCodes?.[index] || codeFor(text);
    while (codes.includes(code)) code = codeFor(`${code}_${index}`);
    codes.push(code);
    return { id: uid("option", `${field.code}:${code}`), name: fit(text, 230), code, sortOrder: index + 1, optionSet: { id: setId } };
  });
  metadata.options.push(...options);
  metadata.optionSets.push({
    id: setId,
    name: fit(`${PREFIX} - ${field.label} (${field.code})`, 230),
    code: fit(`${PREFIX}_${field.code}`, 50),
    valueType: "TEXT",
    options: options.map((option) => ({ id: option.id })),
  });
  optionCodeByField[field.code] = Object.fromEntries(field.options.map((text, index) => [text, codes[index]]));
  mapping.optionCodes[field.code] = optionCodeByField[field.code];
  return setId;
}

// ----- attributes and tracked entity type
const attributeFields = [...fields.values()].filter((field) => field.kind === "attribute");
const attributeOrder = Object.values(ATTRIBUTE_SECTIONS).flat();
attributeFields.sort((a, b) => attributeOrder.indexOf(a.code) - attributeOrder.indexOf(b.code));
const attributeId = {};
for (const field of attributeFields) {
  const id = uid("trackedEntityAttribute", field.code);
  attributeId[field.code] = id;
  const attribute = {
    id,
    // Names carry the code: several questions share labels such as "If other, please specify".
    name: fit(`${PREFIX} ${field.code} - ${field.label}`, 230),
    shortName: fit(`${PREFIX} ${field.code}`, 50),
    code: fit(`${PREFIX}_${field.code}`, 50),
    formName: fit(field.text, 230),
    valueType: VALUE_TYPES[field.type] || "TEXT",
    aggregationType: "NONE",
    unique: Boolean(field.unique),
    orgunitScope: false,
    confidential: false,
    inherit: false,
  };
  if (field.type === "SELECT") attribute.optionSet = { id: optionSetFor(field) };
  metadata.trackedEntityAttributes.push(attribute);
  mapping.attributes[field.code] = id;
  dictionary.push({ stage: "Registration (attributes)", section: Object.keys(ATTRIBUTE_SECTIONS).find((name) => ATTRIBUTE_SECTIONS[name].includes(field.code)), field, uid: id, valueType: attribute.valueType });
}

const trackedEntityTypeId = uid("trackedEntityType", "DIGITAL_FUTURES_PARTICIPANT");
mapping.trackedEntityType = trackedEntityTypeId;
const SEARCH_CODES = ["APPLICATION_REFERENCE", "PARTICIPANT_CODE", "FIRST_NAME", "LAST_NAME", "CONTACT_NUMBER", "NATIONAL_ID_NUMBER"];
const LIST_CODES = ["APPLICATION_REFERENCE", "FIRST_NAME", "LAST_NAME", "SEX", "COUNTRY", "APPLICATION_STATUS"];
metadata.trackedEntityTypes.push({
  id: trackedEntityTypeId,
  name: "Digital Futures participant",
  // Required from DHIS2 2.42.
  shortName: "DF participant",
  description: "Applicant or participant in the Sightsavers Digital Futures programme.",
  allowAuditLog: true,
  minAttributesRequiredToSearch: 1,
  trackedEntityTypeAttributes: ["APPLICATION_REFERENCE", "PARTICIPANT_CODE", "FIRST_NAME", "LAST_NAME", "CONTACT_NUMBER"].map((code) => ({
    trackedEntityAttribute: { id: attributeId[code] },
    displayInList: LIST_CODES.includes(code),
    searchable: true,
    mandatory: false,
  })),
});

// ----- program
const programId = uid("program", "DIGITAL_FUTURES");
mapping.program = programId;
const STAGES = [
  { key: "APPLICATION", name: "Application", description: "Application form, consent and initial eligibility screening.", repeatable: false },
  { key: "SKILLS_TEST", name: "Basic IT skills test", description: "Result of the invitation-only basic IT skills test.", repeatable: false },
  { key: "COMMITTEE_REVIEW", name: "Selection committee review", description: "One event per committee member's decision.", repeatable: true },
  { key: "PARTICIPANT_REGISTRATION", name: "Participant registration & baseline survey", description: "Completed by selected participants.", repeatable: false },
];

// ----- data elements and stages
const dataElementIds = {}; // code -> uid, or code -> { optionText: uid } for multi-select
for (const [stageIndex, stage] of STAGES.entries()) {
  const stageId = uid("programStage", stage.key);
  mapping.stages[stage.key] = { id: stageId, name: stage.name, dataElements: {}, multiSelect: {} };
  const stageFields = [...fields.values()].filter((field) => field.kind === "dataElement" && stageOf[field.code] === stage.key);
  const sectionNames = unique(stageFields.map((field) => sectionOf[field.code]));
  const stageDataElements = [];
  const sections = [];

  for (const [sectionIndex, sectionName] of sectionNames.entries()) {
    const sectionElements = [];
    for (const field of stageFields.filter((item) => sectionOf[item.code] === sectionName)) {
      const variants = field.type === "MULTI"
        ? field.options.map((option) => ({ option, code: fit(`${field.code}__${codeFor(option, 40)}`, 46), valueType: "TRUE_ONLY", formName: `${field.text} — ${option}`, name: `${field.label}: ${option}` }))
        : [{ code: field.code, valueType: VALUE_TYPES[field.type] || "TEXT", formName: field.text, name: field.label }];
      for (const variant of variants) {
        const id = uid("dataElement", variant.code);
        const dataElement = {
          id,
          name: fit(`${PREFIX} ${variant.code} - ${variant.name}`, 230),
          shortName: fit(`${PREFIX} ${variant.code}`, 50),
          code: fit(`${PREFIX}_${variant.code}`, 50),
          formName: fit(variant.formName, 230),
          description: fit(field.text, 1000),
          domainType: "TRACKER",
          valueType: variant.valueType,
          aggregationType: "NONE",
          zeroIsSignificant: ["NUMBER", "INTEGER_ZERO_OR_POSITIVE", "PERCENTAGE"].includes(variant.valueType),
        };
        if (field.type === "SELECT") dataElement.optionSet = { id: optionSetFor(field) };
        metadata.dataElements.push(dataElement);
        stageDataElements.push({ dataElement: { id }, compulsory: Boolean(field.mandatory) && field.type !== "MULTI", sortOrder: stageDataElements.length + 1 });
        sectionElements.push({ id });
        if (field.type === "MULTI") {
          dataElementIds[field.code] = { ...(dataElementIds[field.code] || {}), [variant.option]: id };
          mapping.stages[stage.key].multiSelect[field.code] = dataElementIds[field.code];
        } else {
          dataElementIds[field.code] = id;
          mapping.stages[stage.key].dataElements[field.code] = id;
        }
        dictionary.push({ stage: stage.name, section: sectionName, field, uid: id, valueType: variant.valueType, option: variant.option });
      }
    }
    const sectionId = uid("programStageSection", `${stage.key}:${sectionName}`);
    sections.push({ id: sectionId });
    metadata.programStageSections.push({
      id: sectionId,
      name: fit(sectionName, 230),
      programStage: { id: stageId },
      sortOrder: sectionIndex + 1,
      dataElements: sectionElements,
    });
  }

  metadata.programStages.push({
    id: stageId,
    name: stage.name,
    description: stage.description,
    program: { id: programId },
    repeatable: stage.repeatable,
    sortOrder: stageIndex + 1,
    autoGenerateEvent: false,
    generatedByEnrollmentDate: false,
    displayGenerateEventBox: true,
    validationStrategy: "ON_COMPLETE",
    featureType: "NONE",
    programStageDataElements: stageDataElements,
    programStageSections: sections,
  });
}

// Registration form sections
for (const [index, [name, codes]] of Object.entries(ATTRIBUTE_SECTIONS).entries()) {
  metadata.programSections.push({
    id: uid("programSection", name),
    name,
    program: { id: programId },
    sortOrder: index + 1,
    trackedEntityAttributes: codes.filter((code) => attributeId[code]).map((code) => ({ id: attributeId[code] })),
  });
}

metadata.programs.push({
  id: programId,
  name: "Digital Futures participant tracker",
  shortName: "Digital Futures",
  code: "DF_DIGITAL_FUTURES",
  description: "Recruitment, selection and participant registration for Sightsavers Digital Futures (Ghana, Kenya, Nigeria, Zambia).",
  programType: "WITH_REGISTRATION",
  trackedEntityType: { id: trackedEntityTypeId },
  onlyEnrollOnce: true,
  displayFrontPageList: true,
  displayIncidentDate: false,
  selectEnrollmentDatesInFuture: false,
  enrollmentDateLabel: "Application submitted date",
  accessLevel: "PROTECTED",
  minAttributesRequiredToSearch: 1,
  programTrackedEntityAttributes: attributeFields.map((field, index) => ({
    id: uid("programTrackedEntityAttribute", field.code),
    trackedEntityAttribute: { id: attributeId[field.code] },
    mandatory: Boolean(field.mandatory),
    displayInList: LIST_CODES.includes(field.code),
    searchable: SEARCH_CODES.includes(field.code),
    allowFutureDate: false,
    sortOrder: index + 1,
  })),
  programStages: STAGES.map((stage) => ({ id: uid("programStage", stage.key) })),
  programSections: metadata.programSections.map((section) => ({ id: section.id })),
  organisationUnits: [],
});

// ---------------------------------------------------------------- program rules (show/hide logic)

const variables = new Map();
function variableFor(code, option) {
  const key = option === undefined ? code : `${code}::${option}`;
  if (variables.has(key)) return variables.get(key).name;
  const field = fields.get(code);
  const name = `df_${(option === undefined ? code : `${code}_${codeFor(option, 30)}`).toLowerCase()}`.slice(0, 60);
  const variable = {
    id: uid("programRuleVariable", key),
    name,
    program: { id: programId },
    useCodeForOptionSet: true,
  };
  if (field.kind === "attribute") {
    variable.programRuleVariableSourceType = "TEI_ATTRIBUTE";
    variable.trackedEntityAttribute = { id: attributeId[code] };
  } else {
    variable.programRuleVariableSourceType = "DATAELEMENT_CURRENT_EVENT";
    variable.dataElement = { id: option === undefined ? dataElementIds[code] : dataElementIds[code][option] };
  }
  variables.set(key, variable);
  return name;
}

// DHIS2 rule expression that is true when the portal would show the question.
function showExpression(showIf) {
  const trigger = fields.get(showIf.questionCode);
  if (!trigger) return null;
  const values = Array.isArray(showIf.value) ? showIf.value : [showIf.value];
  if (showIf.operator === "contains" && trigger.type === "MULTI") {
    const matches = trigger.options.filter((item) => values.includes(item));
    return matches.length ? matches.map((option) => `#{${variableFor(trigger.code, option)}} == true`).join(" || ") : null;
  }
  const name = variableFor(trigger.code);
  if (trigger.type === "BOOLEAN") {
    return values.map((value) => `#{${name}} == ${/^(yes|true)$/i.test(String(value))}`).join(" || ");
  }
  if (trigger.type === "SELECT") {
    const codes = values.map((value) => optionCodeByField[trigger.code]?.[value]).filter(Boolean);
    return codes.length ? codes.map((code) => `#{${name}} == '${code}'`).join(" || ") : null;
  }
  return values.map((value) => `#{${name}} == '${String(value).replace(/'/g, "\\'")}'`).join(" || ");
}

function targetsFor(field) {
  if (field.kind === "attribute") return [{ trackedEntityAttribute: { id: attributeId[field.code] } }];
  if (field.type === "MULTI") return Object.values(dataElementIds[field.code]).map((id) => ({ dataElement: { id } }));
  return [{ dataElement: { id: dataElementIds[field.code] } }];
}

const ruleNames = new Set();
function addRule(name, condition, targets, extraActions = []) {
  let ruleName = fit(name, 230);
  while (ruleNames.has(ruleName)) ruleName = fit(`${name} ${ruleNames.size}`, 230);
  ruleNames.add(ruleName);
  const ruleId = uid("programRule", ruleName);
  const actions = [...targets.map((target) => ({ programRuleActionType: "HIDEFIELD", ...target })), ...extraActions].map((action, index) => ({
    id: uid("programRuleAction", `${ruleName}:${index}`),
    programRule: { id: ruleId },
    ...action,
  }));
  metadata.programRuleActions.push(...actions);
  metadata.programRules.push({ id: ruleId, name: ruleName, program: { id: programId }, condition, priority: 1, programRuleActions: actions.map((action) => ({ id: action.id })) });
}

const unsupportedConditions = [];
for (const field of fields.values()) {
  if (!field.showIfs.length) continue;
  const expressions = field.showIfs.map(showExpression);
  if (expressions.some((expression) => !expression)) {
    unsupportedConditions.push(field.code);
    continue;
  }
  const triggers = unique(field.showIfs.map((condition) => condition.questionCode)).join(" or ");
  addRule(`DF hide ${field.code} unless ${triggers} matches`, `!(${expressions.map((expression) => `(${expression})`).join(" || ")})`, targetsFor(field));
}

// Pathway-specific application questions are hidden for other pathways.
const coursePathwayCodes = optionCodeByField.COURSE_APPLIED_FOR;
const pathwayOptionCode = {
  PHYSICAL_ACADEMY: coursePathwayCodes["Physical Academy"],
  VIRTUAL_ACADEMY: coursePathwayCodes["Virtual Academy"],
  DIGITAL_ENTREPRENEURSHIP: coursePathwayCodes["Digital Entrepreneurship"],
};
const byPathwaySet = new Map();
for (const field of fields.values()) {
  if (field.kind !== "dataElement" || stageOf[field.code] !== "APPLICATION") continue;
  if (!field.pathways.length || field.pathways.length === PATHWAYS.length) continue;
  const key = PATHWAYS.filter((pathway) => field.pathways.includes(pathway)).join("+");
  byPathwaySet.set(key, [...(byPathwaySet.get(key) || []), field]);
}
const courseVariable = variableFor("COURSE_APPLIED_FOR");
for (const [key, pathwayFields] of byPathwaySet) {
  const pathways = key.split("+");
  const condition = `!(${pathways.map((pathway) => `#{${courseVariable}} == '${pathwayOptionCode[pathway]}'`).join(" || ")})`;
  // Whole sections that only these pathways use are hidden too, so other pathways see no empty headers.
  const sectionActions = metadata.programStageSections
    .filter((section) => section.programStage.id === uid("programStage", "APPLICATION"))
    .filter((section) => section.dataElements.length && section.dataElements.every((element) =>
      pathwayFields.some((field) => targetsFor(field).some((target) => target.dataElement?.id === element.id))))
    .map((section) => ({ programRuleActionType: "HIDESECTION", programStageSection: { id: section.id } }));
  addRule(`DF hide questions not used by ${pathways.map(humanize).join(" or ")}`, condition, pathwayFields.flatMap(targetsFor), sectionActions);
}

metadata.programRuleVariables.push(...variables.values());

// ---------------------------------------------------------------- checks and output

function assertUnique(list, key, label) {
  const seen = new Map();
  for (const item of list) {
    const value = item[key];
    if (value === undefined) continue;
    if (seen.has(value)) throw new Error(`${label} ${key} not unique: "${value}"`);
    seen.set(value, true);
  }
}
for (const [type, list] of Object.entries(metadata)) assertUnique(list, "id", type);
for (const type of ["dataElements", "trackedEntityAttributes"]) {
  assertUnique(metadata[type], "name", type);
  assertUnique(metadata[type], "shortName", type);
  assertUnique(metadata[type], "code", type);
  for (const item of metadata[type]) {
    if (item.shortName.length > 50 || item.code.length > 50 || item.name.length > 230) throw new Error(`${type} length limit: ${item.code}`);
  }
}
assertUnique(metadata.optionSets, "name", "optionSets");
assertUnique(metadata.optionSets, "code", "optionSets");
assertUnique(metadata.programRuleVariables, "name", "programRuleVariables");
assertUnique(metadata.programRules, "name", "programRules");
for (const set of metadata.optionSets) {
  const options = metadata.options.filter((option) => option.optionSet.id === set.id);
  assertUnique(options, "code", `options in ${set.code}`);
  assertUnique(options, "name", `options in ${set.code}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "digital-futures-tracker-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, "digital-futures-dhis2-mapping.json"), `${JSON.stringify(mapping, null, 2)}\n`);

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csvRows = [["Stage", "Section", "Portal code", "DHIS2 UID", "Question / label", "DHIS2 value type", "Options", "Shown when", "Pathways", "Required"]];
for (const row of dictionary) {
  const { field } = row;
  csvRows.push([
    row.stage,
    row.section,
    row.option ? `${field.code} (${row.option})` : field.code,
    row.uid,
    row.option ? `${field.text} — ${row.option}` : field.text,
    row.valueType,
    field.type === "SELECT" ? field.options.join(" | ") : "",
    field.showIfs.map((condition) => `${condition.questionCode} ${condition.operator} ${[].concat(condition.value).join(" / ")}`).join("; or "),
    field.pathways.length === PATHWAYS.length || !field.pathways.length ? "All" : field.pathways.map(humanize).join(", "),
    field.mandatory ? "Yes" : "",
  ]);
}
fs.writeFileSync(path.join(OUT_DIR, "digital-futures-data-dictionary.csv"), `﻿${csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);

const count = (type) => metadata[type].length;
console.log(`Program "${metadata.programs[0].name}" (${programId})`);
console.log(`  ${count("trackedEntityAttributes")} attributes, ${count("programStages")} stages, ${count("programStageSections")} sections, ${count("dataElements")} data elements`);
console.log(`  ${count("optionSets")} option sets (${count("options")} options), ${count("programRules")} program rules, ${count("programRuleVariables")} rule variables`);
for (const stage of metadata.programStages) console.log(`  stage "${stage.name}": ${stage.programStageDataElements.length} data elements`);
if (unsupportedConditions.length) console.log(`  Conditions not converted to rules: ${unsupportedConditions.join(", ")}`);
console.log(`Written to ${OUT_DIR}`);
