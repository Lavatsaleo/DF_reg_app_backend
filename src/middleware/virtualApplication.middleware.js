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

function hasDiplomaOrHigher(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return [
    "diploma",
    "bachelor’s degree",
    "bachelor's degree",
    "bachelors degree",
    "bachelor degree",
    "postgraduate",
    "post graduate",
  ].includes(normalized) || normalized.includes("bachelor") || normalized.includes("postgraduate") || normalized.includes("post graduate");
}

function validateVirtualApplication(req, res, next) {
  const pathway = String(req.body.pathway || "").trim().toUpperCase();
  if (pathway !== "VIRTUAL_ACADEMY") return next();

  const responses = parseResponses(req);
  const trainingAvailability = toBoolean(getAnswer(responses, "TRAINING_AVAILABILITY"));
  const educationLevel = getAnswer(responses, "EDUCATION_LEVEL");
  const deviceAccess = getAnswer(responses, "DEVICE_ACCESS");

  if (trainingAvailability !== true) {
    return res.status(400).json({
      success: false,
      reasonCode: "VIRTUAL_ACADEMY_TRAINING_AVAILABILITY_REQUIRED",
      message: "The Virtual Academy requires applicants to be available for the full 4-month training period.",
    });
  }

  if (!hasDiplomaOrHigher(educationLevel)) {
    return res.status(400).json({
      success: false,
      reasonCode: "VIRTUAL_ACADEMY_DIPLOMA_REQUIRED",
      message: "The Virtual Academy requires a completed Diploma, Bachelor’s degree or Postgraduate qualification.",
    });
  }

  if (Array.isArray(deviceAccess) && deviceAccess.includes("None") && deviceAccess.length > 1) {
    return res.status(400).json({
      success: false,
      reasonCode: "DEVICE_ACCESS_CONFLICT",
      invalidQuestions: [{
        questionCode: "DEVICE_ACCESS",
        message: "Select None only when you do not have access to any of the listed devices.",
      }],
      message: "Please correct the device access response.",
    });
  }

  return next();
}

module.exports = { validateVirtualApplication };
