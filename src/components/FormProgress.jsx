function FormProgress({ progress, sectionCount, submitting }) {
  const remainingRequired = Math.max(0, progress.totalRequired - progress.completedRequired);

  return (
    <aside className="ss-progress-card ss-executive-progress-card">
      <div className="d-flex align-items-center justify-content-between gap-3">
        <div>
          <span className="ss-small-label dark">Quick application</span>
          <h3>Progress</h3>
          <p className="ss-progress-subtitle">Designed to take a few minutes.</p>
        </div>
        <div className="ss-progress-ring" aria-label={`${progress.percentage}% complete`}>
          {progress.percentage}%
        </div>
      </div>

      <div className="progress ss-progress-bar mt-3" role="progressbar" aria-valuenow={progress.percentage} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-bar" style={{ width: `${progress.percentage}%` }} />
      </div>

      <div className="ss-progress-grid mt-3 compact">
        <div>
          <strong>{progress.completedRequired}</strong>
          <span>Completed</span>
        </div>
        <div>
          <strong>{remainingRequired}</strong>
          <span>Left</span>
        </div>
        <div>
          <strong>{sectionCount}</strong>
          <span>Steps</span>
        </div>
        <div>
          <strong>~5</strong>
          <span>Minutes</span>
        </div>
      </div>

      <div className="ss-progress-note mt-3">
        <i className="bi bi-lightning-charge" />
        <span>
          Only fields marked <strong>Required</strong> must be completed. Optional details can be brief.
        </span>
      </div>

      {submitting && (
        <div className="ss-progress-note mt-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>Submitting your registration...</span>
        </div>
      )}
    </aside>
  );
}

export default FormProgress;
