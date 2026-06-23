export function normalizeBoolean(value) {
  if (value === true || value === false) return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["yes", "true", "1", "y"].includes(normalized)) return true;
    if (["no", "false", "0", "n"].includes(normalized)) return false;
  }

  return value;
}

export function isQuestionVisible(question, answers) {
  if (!question.showIf) return true;

  const controllingAnswer = answers[question.showIf.questionCode];
  const expectedValue = question.showIf.value;
  const operator = question.showIf.operator;

  const normalizedAnswer = normalizeBoolean(controllingAnswer);
  const normalizedExpected = normalizeBoolean(expectedValue);

  if (operator === "equals") {
    return normalizedAnswer === normalizedExpected;
  }

  if (operator === "in") {
    const expectedValues = Array.isArray(expectedValue) ? expectedValue : [expectedValue];

    if (Array.isArray(normalizedAnswer)) {
      return normalizedAnswer.some((item) => expectedValues.includes(normalizeBoolean(item)));
    }

    return expectedValues.map(normalizeBoolean).includes(normalizedAnswer);
  }

  if (operator === "notEquals") {
    return normalizedAnswer !== normalizedExpected;
  }

  if (operator === "contains") {
    if (Array.isArray(controllingAnswer)) {
      return controllingAnswer.includes(expectedValue);
    }

    if (typeof controllingAnswer === "string") {
      return controllingAnswer.includes(expectedValue);
    }

    return false;
  }

  if (operator === "notContains") {
    if (Array.isArray(controllingAnswer)) {
      return !controllingAnswer.includes(expectedValue);
    }

    if (typeof controllingAnswer === "string") {
      return !controllingAnswer.includes(expectedValue);
    }

    return true;
  }

  return true;
}

export function groupQuestionsBySection(questions) {
  return questions.reduce((groups, question) => {
    const section = question.section || "Other";

    if (!groups[section]) {
      groups[section] = [];
    }

    groups[section].push(question);

    return groups;
  }, {});
}
