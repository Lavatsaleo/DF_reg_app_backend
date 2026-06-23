function PathwayCard({ pathway, onSelect }) {
  const isOpen = pathway.status === "open";

  return (
    <article className={`ss-pathway-card h-100 ${!isOpen ? "is-disabled" : ""}`}>
      <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
        <div className="ss-pathway-icon">
          <i className={`bi ${pathway.icon}`} />
        </div>
        <span className={`ss-status-badge ${isOpen ? "open" : "soon"}`}>
          {isOpen ? "Open" : "Coming soon"}
        </span>
      </div>

      <span className="ss-small-label">{pathway.tag}</span>
      <h3>{pathway.title}</h3>
      <p>{pathway.description}</p>

      <ul className="ss-highlight-list">
        {pathway.highlights.map((highlight) => (
          <li key={highlight}>
            <i className="bi bi-check2-circle" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`btn w-100 mt-auto ${isOpen ? "ss-btn-primary" : "ss-btn-muted"}`}
        onClick={() => onSelect(pathway)}
      >
        {isOpen ? `Start ${pathway.title} registration` : "Not yet available"}
      </button>
    </article>
  );
}

export default PathwayCard;
