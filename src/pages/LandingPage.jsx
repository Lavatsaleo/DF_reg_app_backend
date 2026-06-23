import { pathways } from "../data/pathways";
import PathwayCard from "../components/PathwayCard";

function LandingPage({ pathwayMessage, onPathwaySelect, onCheckStatus }) {
  return (
    <main id="main-content" tabIndex="-1">
      <section className="ss-hero">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-12 col-lg-7">
              <span className="ss-hero-badge">
                <i className="bi bi-stars" /> Sightsavers Digital Futures
              </span>
              <h1 className="ss-title mt-4">
                Digital skills. <span>Inclusive futures.</span>
              </h1>
              <p className="ss-subtitle mt-4">
                A streamlined registration portal for the Digital Futures Project, designed for fast application, accessible participation, and end-to-end participant tracking.
              </p>
              <div className="d-flex flex-column flex-sm-row gap-3 mt-4">
                <a href="#pathways" className="btn ss-btn-primary">
                  Choose pathway <i className="bi bi-arrow-right-short" />
                </a>
                <button type="button" className="btn ss-btn-outline" onClick={onCheckStatus}>
                  <i className="bi bi-search" aria-hidden="true" /> Check application status
                </button>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="ss-hero-panel">
                <div className="ss-ring-graphic" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="ss-panel-content">
                  <span>Registration</span>
                  <strong>Open</strong>
                  <p>Physical Academy intake</p>
                </div>
                <div className="ss-metric-row">
                  <div>
                    <strong>3</strong>
                    <span>Pathways</span>
                  </div>
                  <div>
                    <strong>1</strong>
                    <span>Open now</span>
                  </div>
                  <div>
                    <strong>~5m</strong>
                    <span>To apply</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-before-apply-section py-5" aria-labelledby="before-apply-title">
        <div className="container">
          <div className="ss-before-apply-card">
            <div>
              <span className="ss-small-label dark">Before you apply</span>
              <h2 id="before-apply-title">Simple, accessible, and trackable</h2>
              <p>
                Applicants complete one short application. The system checks first-level eligibility in the background, prevents duplicates, and keeps the same participant identifier across testing and review.
              </p>
            </div>
            <div className="ss-before-apply-steps" role="list">
              <div role="listitem"><span>1</span><strong>Apply in minutes</strong><small>Only essential questions are required.</small></div>
              <div role="listitem"><span>2</span><strong>Background screening</strong><small>Eligibility runs quietly after submission.</small></div>
              <div role="listitem"><span>3</span><strong>Secure test link</strong><small>Eligible applicants receive the Basic IT skills test by email.</small></div>
            </div>
          </div>
        </div>
      </section>

      <section id="pathways" className="ss-pathway-section py-5">
        <div className="container">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
            <div>
              <span className="ss-small-label dark">Choose your pathway</span>
              <h2 className="ss-section-title display-6">Select a Digital Futures pathway</h2>
            </div>
            <span className="ss-count-badge">3 pathways</span>
          </div>

          {pathwayMessage && (
            <div className="alert ss-alert-warning" role="alert">
              <i className="bi bi-info-circle" /> {pathwayMessage}
            </div>
          )}

          <div className="row g-4">
            {pathways.map((pathway) => (
              <div key={pathway.id} className="col-12 col-lg-4">
                <PathwayCard pathway={pathway} onSelect={onPathwaySelect} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
