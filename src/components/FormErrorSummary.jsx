import { useEffect, useRef } from "react";

function FormErrorSummary({ errors }) {
  const summaryRef = useRef(null);
  const entries = Object.entries(errors || {});

  useEffect(() => {
    if (entries.length > 0) {
      summaryRef.current?.focus();
    }
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div
      ref={summaryRef}
      className="ss-error-summary"
      role="alert"
      tabIndex="-1"
      aria-labelledby="form-error-summary-title"
    >
      <div className="d-flex gap-3 align-items-start">
        <div className="ss-error-icon" aria-hidden="true">
          <i className="bi bi-exclamation-triangle" />
        </div>
        <div>
          <h3 id="form-error-summary-title">Please check the form</h3>
          <p>{entries.length} field{entries.length === 1 ? "" : "s"} need your attention before submission.</p>
          <ul>
            {entries.slice(0, 8).map(([code, message]) => (
              <li key={code}>
                <a href={`#${code}`}>{message}</a>
              </li>
            ))}
          </ul>
          {entries.length > 8 && <small>And {entries.length - 8} more issue{entries.length - 8 === 1 ? "" : "s"}.</small>}
        </div>
      </div>
    </div>
  );
}

export default FormErrorSummary;
