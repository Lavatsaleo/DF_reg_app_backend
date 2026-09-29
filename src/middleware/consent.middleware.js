const { getApplicationConsent } = require("../data/physicalAcademyConsent");

function normalizeAnswer(value) {
  return String(value || "").trim();
}

function parseResponses(req) {
  try {
    const raw = typeof req.body.responses === "string" ? JSON.parse(req.body.responses) : req.body.responses;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function getResponse(responses, questionCode) {
  return responses.find((item) => item.questionCode === questionCode);
}

function getAnswer(responses, questionCode) {
  return getResponse(responses, questionCode)?.answer;
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isSupportedSignature(method, data) {
  if (!["DRAWN", "TYPED"].includes(String(method || "").toUpperCase())) return false;
  if (!hasValue(data)) return false;

  const signature = String(data);
  if (signature.length > 60000) return false;

  if (String(method).toUpperCase() === "DRAWN") {
    return /^[ML0-9.,\s-]+$/.test(signature);
  }

  return signature.trim().length >= 2;
}

function optionEquals(value, expected) {
  return normalizeAnswer(value).toLowerCase() === normalizeAnswer(expected).toLowerCase();
}

function hasSelectedOther(value) {
  if (Array.isArray(value)) {
    return value.some((item) => String(item || "").toLowerCase().startsWith("other"));
  }
  return String(value || "").toLowerCase().startsWith("other");
}

function requireApplicationConsent(req, res, next) {
  const responses = parseResponses(req);
  const consent = getApplicationConsent(req.body.pathway);

  const consentVersion = getAnswer(responses, "CONSENT_VERSION");
  const consentDecision = getAnswer(responses, "REGISTRATION_CONSENT");
  const signerName = getAnswer(responses, "CONSENT_NAME_ID_CODE");
  const signedDate = getAnswer(responses, "CONSENT_SIGNED_DATE");
  const signatureMethod = getAnswer(responses, "CONSENT_SIGNATURE_METHOD");
  const signatureData = getAnswer(responses, "CONSENT_SIGNATURE_DATA");

  if (consentVersion !== consent.version) {
    return res.status(400).json({
      success: false,
      reasonCode: "CONSENT_VERSION_REQUIRED",
      message: "Please review and sign the current consent form before continuing.",
    });
  }

  if (!optionEquals(consentDecision, consent.consentGrantedOption)) {
    return res.status(400).json({
      success: false,
      reasonCode: "CONSENT_REQUIRED",
      message: "Consent is required before the application can be submitted.",
    });
  }

  if (!hasValue(signerName) || !hasValue(signedDate) || !isSupportedSignature(signatureMethod, signatureData)) {
    return res.status(400).json({
      success: false,
      reasonCode: "SIGNED_CONSENT_REQUIRED",
      message: "Please complete your name, date and electronic signature before continuing.",
    });
  }

  const completedSelf = getAnswer(responses, "CONSENT_COMPLETED_SELF");
  if (!hasValue(completedSelf)) {
    return res.status(400).json({
      success: false,
      reasonCode: "CONSENT_ASSISTANCE_RESPONSE_REQUIRED",
      message: "Please indicate whether you completed the consent section yourself.",
    });
  }

  const needsAssistanceRecord = optionEquals(completedSelf, consent.assistanceRequiredOption);

  if (needsAssistanceRecord) {
    const assistantName = getAnswer(responses, "CONSENT_ASSISTANT_NAME");
    const relationship = getAnswer(responses, "CONSENT_ASSISTANT_RELATIONSHIP");
    const relationshipOther = getAnswer(responses, "CONSENT_ASSISTANT_RELATIONSHIP_OTHER");
    const assistanceTypes = getAnswer(responses, "CONSENT_ASSISTANCE_TYPES");
    const assistanceTypeOther = getAnswer(responses, "CONSENT_ASSISTANCE_TYPE_OTHER");
    const language = getAnswer(responses, "CONSENT_ASSISTANCE_LANGUAGE");
    const assistantSignatureMethod = getAnswer(responses, "CONSENT_ASSISTANT_SIGNATURE_METHOD");
    const assistantSignatureData = getAnswer(responses, "CONSENT_ASSISTANT_SIGNATURE_DATA");
    const assistanceDate = getAnswer(responses, "CONSENT_ASSISTANCE_DATE");

    const assistanceIsComplete =
      hasValue(assistantName) &&
      hasValue(relationship) &&
      hasValue(assistanceTypes) &&
      hasValue(language) &&
      hasValue(assistanceDate) &&
      isSupportedSignature(assistantSignatureMethod, assistantSignatureData) &&
      (!hasSelectedOther(relationship) || hasValue(relationshipOther)) &&
      (!hasSelectedOther(assistanceTypes) || hasValue(assistanceTypeOther));

    if (!assistanceIsComplete) {
      return res.status(400).json({
        success: false,
        reasonCode: "CONSENT_ASSISTANCE_DETAILS_REQUIRED",
        message: "Please complete the details for the person who read, explained or interpreted the consent information.",
      });
    }
  }

  return next();
}

module.exports = { requireApplicationConsent };
