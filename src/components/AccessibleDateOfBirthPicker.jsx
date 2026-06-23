import { useEffect, useMemo, useRef, useState } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MIN_YEAR = 1900;

function parseIsoDate(value) {
  if (!value) return { day: "", month: "", year: "" };

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { day: "", month: "", year: "" };

  return {
    year: String(Number(match[1])),
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function toIsoDate(parts) {
  if (!parts.year || !parts.month || !parts.day) return "";

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return "";
  }

  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

function calculateAge(value) {
  if (!value) return null;

  const parts = parseIsoDate(value);
  if (!parts.year || !parts.month || !parts.day) return null;

  const today = new Date();
  let age = today.getFullYear() - Number(parts.year);
  const monthDifference = today.getMonth() + 1 - Number(parts.month);

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < Number(parts.day))) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function getDaysInMonth(year, month) {
  if (!month) return 31;
  const safeYear = year || 2000;
  return new Date(Number(safeYear), Number(month), 0).getDate();
}

function AccessibleDateOfBirthPicker({
  id,
  value,
  error,
  labelId,
  helpId,
  errorId,
  required,
  onChange,
}) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const defaultDecade = Math.floor((currentYear - 25) / 10) * 10;
  const [parts, setParts] = useState(() => parseIsoDate(value));
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [visibleDecade, setVisibleDecade] = useState(() => {
    const parsed = parseIsoDate(value);
    return parsed.year ? Math.floor(Number(parsed.year) / 10) * 10 : defaultDecade;
  });
  const yearPanelRef = useRef(null);

  const describedBy = [helpId, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  useEffect(() => {
    if (!isYearPickerOpen) return;

    window.requestAnimationFrame(() => {
      const selectedYearButton = yearPanelRef.current?.querySelector("[aria-pressed='true']");
      const firstYearButton = yearPanelRef.current?.querySelector("[data-year]");
      (selectedYearButton || firstYearButton)?.focus();
    });
  }, [isYearPickerOpen, visibleDecade]);

  const decadeOptions = useMemo(() => {
    const firstDecade = Math.floor(MIN_YEAR / 10) * 10;
    const lastDecade = Math.floor(currentYear / 10) * 10;
    const options = [];

    for (let decade = lastDecade; decade >= firstDecade; decade -= 10) {
      options.push(decade);
    }

    return options;
  }, [currentYear]);

  const yearsInVisibleDecade = useMemo(() => {
    const years = [];

    for (let year = visibleDecade; year <= visibleDecade + 9; year += 1) {
      if (year >= MIN_YEAR && year <= currentYear) years.push(year);
    }

    return years;
  }, [visibleDecade, currentYear]);

  const maxMonth = Number(parts.year) === currentYear ? currentMonth : 12;
  const daysInSelectedMonth = getDaysInMonth(parts.year, parts.month);
  const maxDay =
    Number(parts.year) === currentYear && Number(parts.month) === currentMonth
      ? Math.min(daysInSelectedMonth, currentDay)
      : daysInSelectedMonth;

  const calculatedAge = calculateAge(value);

  function updateParts(nextParts) {
    let adjustedParts = { ...nextParts };

    const nextMaxMonth = Number(adjustedParts.year) === currentYear ? currentMonth : 12;
    if (adjustedParts.month && Number(adjustedParts.month) > nextMaxMonth) {
      adjustedParts = { ...adjustedParts, month: "", day: "" };
    }

    const nextDaysInMonth = getDaysInMonth(adjustedParts.year, adjustedParts.month);
    const nextMaxDay =
      Number(adjustedParts.year) === currentYear && Number(adjustedParts.month) === currentMonth
        ? Math.min(nextDaysInMonth, currentDay)
        : nextDaysInMonth;

    if (adjustedParts.day && Number(adjustedParts.day) > nextMaxDay) {
      adjustedParts = { ...adjustedParts, day: "" };
    }

    setParts(adjustedParts);
    onChange(toIsoDate(adjustedParts));
  }

  function handleYearSelect(year) {
    updateParts({ ...parts, year: String(year) });
    setVisibleDecade(Math.floor(year / 10) * 10);
    setIsYearPickerOpen(false);
  }

  function handleYearPanelKeyDown(event) {
    if (event.key === "Escape") {
      setIsYearPickerOpen(false);
      document.getElementById(`${id}-year-button`)?.focus();
    }
  }

  return (
    <div
      className={`ss-dob-picker ${error ? "has-error" : ""}`}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-invalid={error ? "true" : "false"}
      aria-required={required ? "true" : "false"}
    >
      <div className="ss-dob-fields">
        <div className="ss-dob-field">
          <label htmlFor={id}>Day</label>
          <select
            id={id}
            className={`form-select ${error ? "is-invalid" : ""}`}
            value={parts.day}
            onChange={(event) => updateParts({ ...parts, day: event.target.value })}
            aria-label="Day of birth"
          >
            <option value="">Select day</option>
            {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>

        <div className="ss-dob-field month">
          <label htmlFor={`${id}-month`}>Month</label>
          <select
            id={`${id}-month`}
            className={`form-select ${error ? "is-invalid" : ""}`}
            value={parts.month}
            onChange={(event) => updateParts({ ...parts, month: event.target.value })}
            aria-label="Month of birth"
          >
            <option value="">Select month</option>
            {MONTHS.map((month, index) => {
              const monthNumber = index + 1;
              return (
                <option key={month} value={monthNumber} disabled={monthNumber > maxMonth}>
                  {month}
                </option>
              );
            })}
          </select>
        </div>

        <div className="ss-dob-field year">
          <span className="ss-dob-field-label" id={`${id}-year-label`}>Year</span>
          <button
            id={`${id}-year-button`}
            type="button"
            className={`ss-year-picker-trigger ${error ? "is-invalid" : ""}`}
            aria-labelledby={`${id}-year-label ${id}-year-button`}
            aria-expanded={isYearPickerOpen ? "true" : "false"}
            aria-controls={`${id}-year-panel`}
            onClick={() => setIsYearPickerOpen((isOpen) => !isOpen)}
          >
            <span>{parts.year || "Select year"}</span>
            <i className={`bi ${isYearPickerOpen ? "bi-chevron-up" : "bi-chevron-down"}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isYearPickerOpen && (
        <div
          id={`${id}-year-panel`}
          ref={yearPanelRef}
          className="ss-year-picker-panel"
          role="region"
          aria-label="Choose year of birth"
          onKeyDown={handleYearPanelKeyDown}
        >
          <div className="ss-year-picker-toolbar">
            <button
              type="button"
              className="ss-year-decade-button"
              onClick={() => setVisibleDecade((decade) => Math.max(decade - 10, Math.floor(MIN_YEAR / 10) * 10))}
              disabled={visibleDecade <= Math.floor(MIN_YEAR / 10) * 10}
              aria-label="Show previous decade"
            >
              <i className="bi bi-arrow-left" aria-hidden="true" /> Previous decade
            </button>

            <label htmlFor={`${id}-decade`}>
              <span>Jump to decade</span>
              <select
                id={`${id}-decade`}
                className="form-select"
                value={visibleDecade}
                onChange={(event) => setVisibleDecade(Number(event.target.value))}
              >
                {decadeOptions.map((decade) => (
                  <option key={decade} value={decade}>
                    {decade}–{Math.min(decade + 9, currentYear)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="ss-year-decade-button"
              onClick={() => setVisibleDecade((decade) => Math.min(decade + 10, Math.floor(currentYear / 10) * 10))}
              disabled={visibleDecade >= Math.floor(currentYear / 10) * 10}
              aria-label="Show next decade"
            >
              Next decade <i className="bi bi-arrow-right" aria-hidden="true" />
            </button>
          </div>

          <p className="ss-year-picker-instruction">
            Select a year from {visibleDecade} to {Math.min(visibleDecade + 9, currentYear)}.
          </p>

          <div className="ss-year-grid" role="group" aria-label={`Years ${visibleDecade} to ${Math.min(visibleDecade + 9, currentYear)}`}>
            {yearsInVisibleDecade.map((year) => (
              <button
                key={year}
                type="button"
                data-year={year}
                className="ss-year-option"
                aria-pressed={Number(parts.year) === year ? "true" : "false"}
                onClick={() => handleYearSelect(year)}
              >
                {year}
              </button>
            ))}
          </div>

          <button type="button" className="ss-year-picker-close" onClick={() => setIsYearPickerOpen(false)}>
            Close year selector
          </button>
        </div>
      )}

      <p className="ss-dob-guidance mb-0">
        Select the day, month and year. Use the decade buttons or the decade list to reach the year quickly.
      </p>

      {calculatedAge !== null && (
        <p className="ss-question-help mb-0 mt-2" aria-live="polite">
          Calculated age: {calculatedAge} year{calculatedAge === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

export default AccessibleDateOfBirthPicker;
