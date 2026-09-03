const { PHYSICAL_ACADEMY_CONSENT_VERSION } = require("../data/physicalAcademyConsent");

function toBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  const normalized = String(value || "").trim().toLowerCase();
  if (["yes", "true", "1", "y"].includes(normalized)) return true;
  if (["no", "false", "0", "n"].includes(normalized)) return false;
  return null;
}

function parseResponses(req) {
  try {
    const raw = typeof req.body.responses === "string" ? JSON.parse(req.body.responses) : req.body.responses;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function getAnswer(responses, questionCode) {
  return responses.find((item) => item.questionCode === questionCode)?.answer;
}

function hasValue(value) {
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

function requireApplicationConsent(req, res, next) {
  const responses = parseResponses(req);
  const consentVersion = getAnswer(responses, "CONSENT_VERSION");
  const informationRead = toBoolean(getAnswer(responses, "CONSENT_INFORMATION_READ"));
  const agreedToParticipate = toBoolean(getAnswer(responses, "REGISTRATION_CONSENT"));
  const signerNameOrId = getAnswer(responses, "CONSENT_NAME_ID_CODE");
  const signedDate = getAnswer(responses, "CONSENT_SIGNED_DATE");
  const signatureMethod = getAnswer(responses, "CONSENT_SIGNATURE_METHOD");
  const signatureData = getAnswer(responses, "CONSENT_SIGNATURE_DATA");
  const juratRequired = toBoolean(getAnswer(responses, "JURAT_REQUIRED"));

  if (consentVersion !== PHYSICAL_ACADEMY_CONSENT_VERSION) {
    return res.status(400).json({
      success: false,
      reasonCode: "CONSENT_VERSION_REQUIRED",
      message: "Please review and sign the current consent form before continuing.",
    });
  }

  if (informationRead !== true || agreedToParticipate !== true) {
    return res.status(400).json({
      success: false,
      reasonCode: "CONSENT_REQUIRED",
      message: "Consent is required before the Application can be submitted.",
    });
  }

  if (!hasValue(signerNameOrId) || !hasValue(signedDate) || !isSupportedSignature(signatureMethod, signatureData)) {
    return res.status(400).json({
      success: false,
      reasonCode: "SIGNED_CONSENT_REQUIRED",
      message: "Please complete the consent name, date and electronic signature before continuing.",
    });
  }

  if (juratRequired === null) {
    return res.status(400).json({
      success: false,
      reasonCode: "JURAT_RESPONSE_REQUIRED",
      message: "Please indicate whether the Application was translated or explained to you.",
    });
  }

  if (juratRequired === true) {
    const interpreterName = getAnswer(responses, "JURAT_INTERPRETER_NAME");
    const interpreterAddress = getAnswer(responses, "JURAT_INTERPRETER_ADDRESS");
    const language = getAnswer(responses, "JURAT_LANGUAGE");
    const interpreterSignatureMethod = getAnswer(responses, "JURAT_SIGNATURE_METHOD");
    const interpreterSignature = getAnswer(responses, "JURAT_INTERPRETER_SIGNATURE");
    const juratDate = getAnswer(responses, "JURAT_DATE");

    if (
      !hasValue(interpreterName) ||
      !hasValue(interpreterAddress) ||
      !hasValue(language) ||
      !hasValue(juratDate) ||
      !isSupportedSignature(interpreterSignatureMethod, interpreterSignature)
    ) {
      return res.status(400).json({
        success: false,
        reasonCode: "JURAT_REQUIRED",
        message: "Please complete the Jurat interpreter details, date and electronic signature before continuing.",
      });
    }
  }

  return next();
}

module.exports = { requireApplicationConsent };
