import AccessibleDateOfBirthPicker from "./AccessibleDateOfBirthPicker";
import VoiceInputButton from "./VoiceInputButton";

const COUNTRY_DIAL_CODES = {
  Kenya: "+254",
  Nigeria: "+234",
  Ghana: "+233",
  Zambia: "+260",
};

const MIN_ELIGIBLE_AGE = 18;
const MAX_ELIGIBLE_AGE = 33;

function getInputMode(question) {
  if (question.responseType === "NUMBER") return "numeric";
  if (question.responseType === "PHONE") return "numeric";
  if (question.responseType === "EMAIL") return "email";
  return undefined;
}

function getAutocomplete(question) {
  const text = `${question.questionCode || ""} ${question.questionText || ""}`.toLowerCase();

  if (question.responseType === "EMAIL" || text.includes("email")) return "email";
  if (question.responseType === "PHONE" || text.includes("phone") || text.includes("mobile")) return "tel";
  if (text.includes("first name") || text.includes("given name")) return "given-name";
  if (text.includes("last name") || text.includes("surname") || text.includes("family name")) return "family-name";
  if (text.includes("name")) return "name";
  if (text.includes("county") || text.includes("location") || text.includes("address")) return "address-level2";

  return undefined;
}

function supportsVoiceInput(question) {
  return ["TEXT", "LONG_TEXT", "PHONE", "EMAIL", "NUMBER"].includes(question.responseType) || !question.responseType;
}

function isPersonNameQuestion(question) {
  return question.validationType === "PERSON_NAME" ||
    ["FIRST_NAME", "LAST_NAME", "NEXT_OF_KIN_NAME"].includes(question.questionCode);
}

function sanitizePhoneValue(value) {
  return String(value || "").replace(/\D/g, "");
}

function sanitizeAnswerValue(question, value) {
  if (question.responseType === "PHONE" || question.validationType === "PHONE_DIGITS") {
    return sanitizePhoneValue(value);
  }

  if (!isPersonNameQuestion(question)) return value;

  // Keep letters from all languages and normal name punctuation, but remove numbers.
  return String(value || "").replace(/[^\p{L}\p{M}\s'.-]/gu, "");
}

function getSafeValue(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return value ?? "";
}

function getCountryDialCode(answers) {
  return COUNTRY_DIAL_CODES[answers?.COUNTRY] || "";
}

function getQuestionOptions(question, answers) {
  const metadata = question.metadata || {};
  const country = answers?.COUNTRY;

  if (metadata.optionsByCountry && country) {
    const countryOptions = metadata.optionsByCountry[country];
    if (Array.isArray(countryOptions)) return countryOptions;
  }

  if (metadata.optionsByCountryAndParent && country) {
    const countryConfig = metadata.optionsByCountryAndParent[country];
    const parentQuestionCode = countryConfig?.parentQuestionCode;
    const parentAnswer = parentQuestionCode ? answers?.[parentQuestionCode] : null;
    const parentOptions = countryConfig?.optionsByParent?.[parentAnswer];

    if (Array.isArray(parentOptions)) return parentOptions;
    return [];
  }

  if (metadata.optionsByParent) {
    const parentQuestionCode = metadata.parentQuestionCode;
    const parentAnswer = parentQuestionCode ? answers?.[parentQuestionCode] : null;
    const parentOptions = metadata.optionsByParent[parentAnswer];

    if (Array.isArray(parentOptions)) return parentOptions;
    return [];
  }

  return Array.isArray(question.options) ? question.options : [];
}

function getSelectPlaceholder(question, options, answers) {
  if (options.length > 0) return "Select one option";

  const metadata = question.metadata || {};

  if (metadata.emptyOptionLabel) return metadata.emptyOptionLabel;
  if (metadata.optionsByCountry && !answers?.COUNTRY) return "Select country first";
  if (metadata.optionsByParent || metadata.optionsByCountryAndParent) return "Select the previous option first";

  return "Select one option";
}

function getEstimatedAgeFromYear(value) {
  const year = Number(value);

  if (!Number.isInteger(year)) return null;

  return new Date().getFullYear() - year;
}

function renderYearOfBirthNote(question, safeValue) {
  if (question.questionCode !== "YEAR_OF_BIRTH") return null;

  const age = getEstimatedAgeFromYear(safeValue);

  if (age === null) return null;

  const isOutsideEligibleRange = age < MIN_ELIGIBLE_AGE || age > MAX_ELIGIBLE_AGE;

  return (
    <p className={`ss-derived-age-note ${isOutsideEligibleRange ? "warning" : ""}`} aria-live="polite">
      Estimated age: <strong>{age}</strong> years. {isOutsideEligibleRange ? `Applicants must be ${MIN_ELIGIBLE_AGE} to ${MAX_ELIGIBLE_AGE} years old for this pathway.` : ""}
    </p>
  );
}

function QuestionField({
  question,
  value,
  answers,
  error,
  labelId,
  helpId,
  errorId,
  onAnswerChange,
  onMultiSelectChange,
}) {
  const safeValue = getSafeValue(value);
  const invalidClass = error ? "is-invalid" : "";
  const describedBy = [helpId, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const commonInputProps = {
    id: question.questionCode,
    "aria-labelledby": labelId,
    "aria-invalid": error ? "true" : "false",
    "aria-required": question.required ? "true" : "false",
    "aria-describedby": describedBy,
  };

  const voiceButton = supportsVoiceInput(question) ? (
    <VoiceInputButton
      question={question}
      onTranscript={(transcript) => onAnswerChange(question, sanitizeAnswerValue(question, transcript))}
    />
  ) : null;

  if (question.responseType === "LONG_TEXT") {
    return (
      <>
        <textarea
          {...commonInputProps}
          className={`form-control ${invalidClass}`}
          value={safeValue}
          onChange={(event) => onAnswerChange(question, event.target.value)}
          placeholder="Type your response here"
          rows={4}
          autoComplete={getAutocomplete(question)}
        />
        {voiceButton}
      </>
    );
  }

  if (question.responseType === "NUMBER") {
    return (
      <>
        <input
          {...commonInputProps}
          className={`form-control ${invalidClass}`}
          type="number"
          inputMode={getInputMode(question)}
          value={safeValue}
          onChange={(event) => onAnswerChange(question, event.target.value)}
          placeholder="Enter number"
          autoComplete={getAutocomplete(question)}
        />
        {voiceButton}
      </>
    );
  }

  if (question.responseType === "DATE") {
    const isDateOfBirth = question.questionCode === "DATE_OF_BIRTH";

    if (isDateOfBirth) {
      return (
        <AccessibleDateOfBirthPicker
          key={safeValue || "empty-date-of-birth"}
          id={question.questionCode}
          value={safeValue}
          error={error}
          labelId={labelId}
          helpId={helpId}
          errorId={errorId}
          required={question.required}
          onChange={(nextValue) => onAnswerChange(question, nextValue)}
        />
      );
    }

    return (
      <input
        {...commonInputProps}
        className={`form-control ${invalidClass}`}
        type="date"
        value={safeValue}
        onChange={(event) => onAnswerChange(question, event.target.value)}
      />
    );
  }

  if (question.responseType === "EMAIL") {
    return (
      <>
        <input
          {...commonInputProps}
          className={`form-control ${invalidClass}`}
          type="email"
          inputMode={getInputMode(question)}
          value={safeValue}
          onChange={(event) => onAnswerChange(question, event.target.value)}
          placeholder="name@example.com"
          autoComplete={getAutocomplete(question)}
        />
        {voiceButton}
      </>
    );
  }

  if (question.responseType === "PHONE") {
    const dialCode = getCountryDialCode(answers);

    return (
      <>
        <div className="input-group ss-phone-input-group">
          {dialCode && (
            <span className="input-group-text ss-phone-prefix" aria-label={`Country code ${dialCode}`}>
              {dialCode}
            </span>
          )}
          <input
            {...commonInputProps}
            className={`form-control ${invalidClass}`}
            type="tel"
            inputMode={getInputMode(question)}
            pattern="[0-9]*"
            value={safeValue}
            onChange={(event) => onAnswerChange(question, sanitizePhoneValue(event.target.value))}
            placeholder={dialCode ? "712345678" : "Enter numbers only"}
            autoComplete={getAutocomplete(question)}
          />
        </div>
        {voiceButton}
      </>
    );
  }

  if (question.responseType === "BOOLEAN") {
    return (
      <div
        className={`ss-option-grid ${error ? "has-error" : ""}`}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        aria-required={question.required ? "true" : "false"}
      >
        {(question.options || ["Yes", "No"]).map((option, index) => {
          const optionId = `${question.questionCode}-${index}`;

          return (
            <label
              key={option}
              htmlFor={optionId}
              className={`ss-option-pill ${safeValue === option ? "selected" : ""}`}
            >
              <input
                id={optionId}
                type="radio"
                name={question.questionCode}
                value={option}
                checked={safeValue === option}
                onChange={(event) => onAnswerChange(question, event.target.value)}
              />
              {option}
            </label>
          );
        })}
      </div>
    );
  }

  if (question.responseType === "SINGLE_SELECT") {
    const options = getQuestionOptions(question, answers);

    return (
      <>
        <select
          {...commonInputProps}
          className={`form-select ${invalidClass}`}
          value={safeValue}
          onChange={(event) => onAnswerChange(question, event.target.value)}
        >
          <option value="">{getSelectPlaceholder(question, options, answers)}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {renderYearOfBirthNote(question, safeValue)}
      </>
    );
  }

  if (question.responseType === "MULTI_SELECT") {
    const selectedValues = Array.isArray(value) ? value : [];

    return (
      <div
        className={`ss-checkbox-list ${error ? "has-error" : ""}`}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : "false"}
        aria-required={question.required ? "true" : "false"}
      >
        {(question.options || []).map((option, index) => {
          const optionId = `${question.questionCode}-${index}`;

          return (
            <label key={option} htmlFor={optionId} className="ss-checkbox-item">
              <input
                id={optionId}
                type="checkbox"
                checked={selectedValues.includes(option)}
                onChange={() => onMultiSelectChange(question, option)}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <input
        {...commonInputProps}
        className={`form-control ${invalidClass}`}
        type="text"
        inputMode={getInputMode(question)}
        value={safeValue}
        onChange={(event) =>
          onAnswerChange(question, sanitizeAnswerValue(question, event.target.value))
        }
        placeholder="Type your response here"
        autoComplete={getAutocomplete(question)}
        pattern={isPersonNameQuestion(question) ? "[A-Za-zÀ-ÖØ-öø-ÿĀ-ž' .-]+" : undefined}
        title={isPersonNameQuestion(question) ? "Use letters only. Numbers are not allowed." : undefined}
      />
      {voiceButton}
    </>
  );
}

export default QuestionField;
