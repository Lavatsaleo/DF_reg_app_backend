function ResultAlert({ result }) {
  if (!result) return null;

  return (
    <div className={`ss-result-alert ${result.isEligible ? "success" : "warning"}`}>
      <div className="d-flex gap-3 align-items-start">
        <div className="ss-result-icon">
          <i className={`bi ${result.isEligible ? "bi-check2" : "bi-exclamation"}`} />
        </div>
        <div>
          <h3>{result.message}</h3>
          <div className="row g-3 mt-1">
            <div className="col-12 col-md-6">
              <strong>Pathway:</strong> {result.pathway}
            </div>
            <div className="col-12 col-md-6">
              <strong>Registration mode:</strong> {result.registrationMode}
            </div>
            <div className="col-12 col-md-6">
              <strong>Status:</strong> {result.status}
            </div>
            <div className="col-12 col-md-6">
              <strong>Eligibility:</strong> {result.isEligible ? "Eligible" : "Not eligible"}
            </div>
          </div>
          <p className="mb-0 mt-3">{result.eligibilityReason}</p>
        </div>
      </div>
    </div>
  );
}

export default ResultAlert;
