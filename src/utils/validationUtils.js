function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

const MIN_ELIGIBLE_AGE = 18;
const MAX_ELIGIBLE_AGE = 33;

function normalizeQuestionText(question) {
  return question.questionText || question.label || question.questionCode || "This question";
}

function isLikelyEmailQuestion(question) {
  const text = `${question.questionCode || ""} ${question.questionText || ""}`.toLowerCase();
  return question.responseType === "EMAIL" || text.includes("email");
}

function isLikelyPhoneQuestion(question) {
  const text = `${question.questionCode || ""} ${question.questionText || ""}`.toLowerCase();
  return question.responseType === "PHONE" || text.includes("phone") || text.includes("mobile") || text.includes("telephone");
}

function isLikelyAgeQuestion(question) {
  const text = `${question.questionCode || ""} ${question.questionText || ""}`.toLowerCase();
  return question.responseType === "NUMBER" && text.includes("age");
}

function isPersonNameQuestion(question) {
  return question.validationType === "PERSON_NAME" ||
    ["FIRST_NAME", "LAST_NAME", "NEXT_OF_KIN_NAME"].includes(question.questionCode);
}

function isValidPersonName(value) {
  return /^(?=.*\p{L})[\p{L}\p{M}\s'.-]+$/u.test(String(value || "").trim());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function isValidPhone(value) {
  return /^\d{7,15}$/.test(String(value || "").trim());
}

function isAffirmative(value) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["yes", "true", "1", "y"].includes(normalized) || normalized.startsWith("yes -");
}

function isWholeNumber(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function isValidYear(value) {
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1900 && year <= currentYear;
}

function isValidYearOrNotSure(value) {
  if (String(value || "").trim() === "Not sure") return true;
  return isValidYear(value);
}

function getEstimatedAgeFromYear(value) {
  const year = Number(value);

  if (!Number.isInteger(year)) return null;

  return new Date().getFullYear() - year;
}

function isEligibleAgeValue(value) {
  const age = Number(value);
  return Number.isInteger(age) && age >= MIN_ELIGIBLE_AGE && age <= MAX_ELIGIBLE_AGE;
}

function isEligibleYearOfBirth(value) {
  const estimatedAge = getEstimatedAgeFromYear(value);
  return estimatedAge !== null && estimatedAge >= MIN_ELIGIBLE_AGE && estimatedAge <= MAX_ELIGIBLE_AGE;
}

function isValidAge(value) {
  const age = Number(value);
  return Number.isInteger(age) && age >= 0 && age <= 120;
}

function isNonNegativeNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0;
}

function getAgeFromDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDifference = today.getMonth() - date.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return age;
}

export function validateAnswers({ questions, answers, isQuestionVisible }) {
  const errors = {};

  for (const question of questions) {
    if (!isQuestionVisible(question, answers)) continue;

    const value = answers[question.questionCode];
    const label = normalizeQuestionText(question);

    if (question.required && isEmpty(value)) {
      errors[question.questionCode] = `${label} is required.`;
      continue;
    }

    if (isEmpty(value)) continue;

    if (question.questionCode === "REGISTRATION_CONSENT" && !isAffirmative(value)) {
      errors[question.questionCode] = "You must provide consent before submitting the application.";
      continue;
    }

    if (isPersonNameQuestion(question) && !isValidPersonName(value)) {
      errors[question.questionCode] = "Use letters only. Numbers are not allowed in a name.";
      continue;
    }

    if (isLikelyEmailQuestion(question) && !isValidEmail(value)) {
      errors[question.questionCode] = "Enter a valid email address.";
      continue;
    }

    if (isLikelyPhoneQuestion(question) && !isValidPhone(value)) {
      errors[question.questionCode] = "Enter a valid phone number using numbers only, for example 712345678. The country code is added from the country selected above.";
      continue;
    }

    if (question.validationType === "YEAR_OR_NOT_SURE" && !isValidYearOrNotSure(value)) {
      errors[question.questionCode] = "Select a valid year or choose Not sure.";
      continue;
    }

    if (question.validationType === "ELIGIBLE_YEAR_OF_BIRTH" && !isEligibleYearOfBirth(value)) {
      errors[question.questionCode] = `Select a year of birth for applicants aged ${MIN_ELIGIBLE_AGE} to ${MAX_ELIGIBLE_AGE}.`;
      continue;
    }

    if (question.questionCode === "YEAR_OF_BIRTH" && String(value).trim() !== "Not sure") {
      const estimatedAge = getEstimatedAgeFromYear(value);

      if (estimatedAge !== null && (estimatedAge < MIN_ELIGIBLE_AGE || estimatedAge > MAX_ELIGIBLE_AGE)) {
        errors[question.questionCode] = `Applicants must be ${MIN_ELIGIBLE_AGE} to ${MAX_ELIGIBLE_AGE} years old for this pathway.`;
        continue;
      }
    }

    if (question.responseType === "DATE") {
      const dateValue = new Date(value);

      if (Number.isNaN(dateValue.getTime())) {
        errors[question.questionCode] = "Enter a valid date.";
        continue;
      }

      if (question.questionCode === "DATE_OF_BIRTH") {
        const age = getAgeFromDate(value);

        if (age === null || age < 0) {
          errors[question.questionCode] = "Date of birth cannot be in the future.";
          continue;
        }

        if (age > 120) {
          errors[question.questionCode] = "Enter a realistic date of birth.";
          continue;
        }
      }
    }

    if (question.responseType === "NUMBER") {
      const numberValue = Number(value);

      if (Number.isNaN(numberValue)) {
        errors[question.questionCode] = "Enter a valid number.";
        continue;
      }

      if (question.validationType === "WHOLE_NUMBER" && !isWholeNumber(value)) {
        errors[question.questionCode] = "Enter a whole number.";
        continue;
      }

      if (question.validationType === "YEAR" && !isValidYear(value)) {
        errors[question.questionCode] = "Enter a valid year in YYYY format.";
        continue;
      }

      if ((question.validationType === "AGE" || isLikelyAgeQuestion(question)) && !isValidAge(value)) {
        errors[question.questionCode] = "Enter a realistic age.";
        continue;
      }

      if (question.validationType === "ELIGIBLE_AGE" && !isEligibleAgeValue(value)) {
        errors[question.questionCode] = `Applicants must be ${MIN_ELIGIBLE_AGE} to ${MAX_ELIGIBLE_AGE} years old for this pathway.`;
        continue;
      }

      if (question.validationType === "NON_NEGATIVE_NUMBER" && !isNonNegativeNumber(value)) {
        errors[question.questionCode] = "Enter zero or a positive number.";
        continue;
      }
    }
  }

  return errors;
}

export function calculateFormProgress({ groupedQuestions, answers }) {
  const visibleQuestions = Object.values(groupedQuestions).flat();
  const requiredQuestions = visibleQuestions.filter((question) => question.required);

  const completedRequired = requiredQuestions.filter((question) => {
    const value = answers[question.questionCode];
    return !isEmpty(value);
  }).length;

  const totalRequired = requiredQuestions.length;
  const percentage = totalRequired === 0 ? 100 : Math.round((completedRequired / totalRequired) * 100);

  return {
    visibleQuestions: visibleQuestions.length,
    totalRequired,
    completedRequired,
    percentage,
  };
}
