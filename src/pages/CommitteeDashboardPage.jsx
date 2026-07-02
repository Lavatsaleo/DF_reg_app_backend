/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { formatPathwayLabel, formatStatusLabel } from "../utils/displayLabels";
import "./CommitteeDashboardPage.css";

const EMPTY_MEMBER_FORM = {
  fullName: "",
  email: "",
  phone: "",
  role: "MEMBER",
  notes: "",
  createLogin: false,
  temporaryPassword: "",
};

const REVIEW_DECISIONS = [
  { value: "SELECTED", label: "Selected", icon: "bi-check-circle" },
  { value: "WAITLISTED", label: "Waitlisted", icon: "bi-hourglass-split" },
  { value: "PENDING_VERIFICATION", label: "Pending verification", icon: "bi-shield-exclamation" },
  { value: "NOT_SELECTED", label: "Not selected", icon: "bi-x-circle" },
];

function formatDate(value) {
  if (!value) return "Not available";

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Not available";
  }
}

function formatDecision(value) {
  const found = REVIEW_DECISIONS.find((decision) => decision.value === value);
  return found?.label || String(value || "Pending").replace(/_/g, " ");
}

function getApplicantSubtitle(applicant) {
  return [
    applicant?.participantCode,
    applicant?.applicationReference,
    formatPathwayLabel(applicant?.pathway),
  ]
    .filter(Boolean)
    .join(" · ");
}

function StatCard({ label, value, icon, tone = "blue" }) {
  return (
    <div className={`committee-stat-card committee-stat-${tone}`}>
      <span aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </div>
  );
}

function MemberWorkloadCard({ member, canManage, onToggleActive, onCreateLogin, creatingLoginForMemberId }) {
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const hasLogin = member.hasLogin === true;

  return (
    <article className="committee-member-card">
      <div className="committee-member-avatar" aria-hidden="true">
        {member.fullName?.charAt(0)?.toUpperCase() || "M"}
      </div>
      <div className="committee-member-main">
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-2">
          <div>
            <h3>{member.fullName}</h3>
            <p>{member.email}</p>
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-start">
            <span className={`committee-role-pill ${member.role === "CHAIRPERSON" ? "chair" : "member"}`}>
              {member.role === "CHAIRPERSON" ? "Chairperson" : "Member"}
            </span>
            <span className={`committee-login-pill ${hasLogin ? "active" : "profile-only"}`}>
              {hasLogin ? "Login enabled" : "Profile only"}
            </span>
          </div>
        </div>
        <div className="committee-workload-row" aria-label="Committee member workload">
          <span><strong>{member.workload?.pending || 0}</strong> pending</span>
          <span><strong>{member.workload?.completed || 0}</strong> completed</span>
          <span><strong>{member.workload?.total || 0}</strong> total</span>
        </div>

        {canManage && showLoginForm && (
          <form
            className="committee-member-login-form"
            onSubmit={(event) => {
              event.preventDefault();
              onCreateLogin(member.id, temporaryPassword, () => {
                setTemporaryPassword("");
                setShowLoginForm(false);
              });
            }}
          >
            <input
              type="password"
              minLength="8"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              placeholder="Temporary password, minimum 8 characters"
              required
            />
            <button
              type="submit"
              className="btn committee-small-action"
              disabled={creatingLoginForMemberId === member.id}
            >
              {creatingLoginForMemberId === member.id ? "Saving..." : hasLogin ? "Reset login" : "Create login"}
            </button>
          </form>
        )}
      </div>
      {canManage && (
        <div className="committee-member-actions">
          <button
            type="button"
            className="btn committee-small-action"
            onClick={() => setShowLoginForm((current) => !current)}
          >
            {showLoginForm ? "Cancel login" : hasLogin ? "Reset login" : "Create login"}
          </button>
          <button
            type="button"
            className={`btn committee-small-action ${member.isActive ? "committee-danger-ghost" : "committee-success-ghost"}`}
            onClick={() => onToggleActive(member)}
          >
            {member.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      )}
    </article>
  );
}

function AddMemberForm({ memberForm, onChange, onSubmit, submitting }) {
  return (
    <form className="committee-add-member-card" onSubmit={onSubmit}>
      <div>
        <span className="ss-small-label dark">Committee setup</span>
        <h3>Add committee member</h3>
        <p>Members added here can receive automatic applicant assignments.</p>
      </div>

      <div className="committee-form-grid">
        <label>
          Full name
          <input
            type="text"
            value={memberForm.fullName}
            onChange={(event) => onChange("fullName", event.target.value)}
            placeholder="e.g. Mary Wanjiku"
            required
          />
        </label>
        <label>
          Email address
          <input
            type="email"
            value={memberForm.email}
            onChange={(event) => onChange("email", event.target.value)}
            placeholder="member@example.org"
            required
          />
        </label>
        <label>
          Phone number
          <input
            type="tel"
            value={memberForm.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          Role
          <select
            value={memberForm.role}
            onChange={(event) => onChange("role", event.target.value)}
          >
            <option value="MEMBER">Member</option>
            <option value="CHAIRPERSON">Chairperson</option>
          </select>
        </label>
      </div>

      <label className="committee-notes-field">
        Notes
        <textarea
          rows="3"
          value={memberForm.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          placeholder="Optional notes, area of expertise, or availability"
        />
      </label>

      <label className="committee-login-check">
        <input
          type="checkbox"
          checked={memberForm.createLogin}
          onChange={(event) => onChange("createLogin", event.target.checked)}
        />
        Create a staff login for this committee member
      </label>

      {memberForm.createLogin && (
        <label className="committee-notes-field">
          Temporary password
          <input
            type="password"
            minLength="8"
            value={memberForm.temporaryPassword}
            onChange={(event) => onChange("temporaryPassword", event.target.value)}
            placeholder="Minimum 8 characters"
            required
          />
        </label>
      )}

      <div className="committee-form-actions">
        <button type="submit" className="btn committee-primary-action" disabled={submitting}>
          <i className="bi bi-person-plus" aria-hidden="true" /> {submitting ? "Adding..." : "Add member"}
        </button>
      </div>
    </form>
  );
}

function formatApplicantLocation(applicant) {
  return [
    applicant?.country,
    applicant?.county,
    applicant?.subCounty,
    applicant?.state,
    applicant?.region,
    applicant?.district,
    applicant?.town,
  ].filter(Boolean).join(" · ") || "Not available";
}

function ApplicantMiniProfile({ applicant }) {
  if (!applicant) return null;

  return (
    <div className="committee-profile-grid">
      <div>
        <span>Applicant</span>
        <strong>{applicant.fullName || "Unnamed applicant"}</strong>
      </div>
      <div>
        <span>Participant ID</span>
        <strong>{applicant.participantCode || "Not available"}</strong>
      </div>
      <div>
        <span>Reference</span>
        <strong>{applicant.applicationReference || "Not available"}</strong>
      </div>
      <div>
        <span>Pathway</span>
        <strong>{formatPathwayLabel(applicant.pathway)}</strong>
      </div>
      <div>
        <span>Location</span>
        <strong>{formatApplicantLocation(applicant)}</strong>
      </div>
      <div>
        <span>Age at application</span>
        <strong>{applicant.ageAtApplication ?? "Not available"}</strong>
      </div>
      <div>
        <span>Disability</span>
        <strong>{applicant.hasDisability ? applicant.disabilityType || "Yes" : "No"}</strong>
      </div>
      <div>
        <span>Education</span>
        <strong>{applicant.educationLevel || "Not available"}</strong>
      </div>
      <div>
        <span>Employment</span>
        <strong>{applicant.employmentStatus || "Not available"}</strong>
      </div>
      <div>
        <span>Status</span>
        <strong>{formatStatusLabel(applicant.status)}</strong>
      </div>
    </div>
  );
}

function UnassignedApplicantCard({ applicant, onAssign, assigning }) {
  const test = applicant?.skillsTest;

  return (
    <article className="committee-waiting-card">
      <div className="committee-waiting-icon" aria-hidden="true">
        <i className="bi bi-person-lines-fill" />
      </div>
      <div className="committee-waiting-main">
        <h3>{applicant.fullName || "Unnamed applicant"}</h3>
        <p>{getApplicantSubtitle(applicant)}</p>
        <div className="committee-waiting-meta">
          <span><i className="bi bi-telephone" aria-hidden="true" /> {applicant.contactNumber || "No phone"}</span>
          {test && <span><i className="bi bi-journal-check" aria-hidden="true" /> Test {test.score}/{test.maxScore} ({test.percentage}%)</span>}
          <span><i className="bi bi-clock" aria-hidden="true" /> Ready {formatDate(applicant.updatedAt)}</span>
        </div>
      </div>
      <button
        type="button"
        className="btn committee-primary-action"
        onClick={() => onAssign(applicant.id)}
        disabled={assigning}
      >
        <i className="bi bi-magic" aria-hidden="true" />
        {assigning ? "Assigning..." : "Auto-assign"}
      </button>
    </article>
  );
}

function ApplicantsWaitingPanel({ applicants, onAssignApplicant, assigningApplicantId, onAutoAssignAll, assigningAll }) {
  if (!applicants.length) return null;

  return (
    <section className="committee-section-card committee-waiting-panel">
      <div className="committee-section-header with-filters">
        <div>
          <span className="ss-small-label dark">Waiting for assignment</span>
          <h2>Applicants who need to be assigned</h2>
          <p>These applicants have completed the Basic IT Skills Test but are not yet assigned to any committee member.</p>
        </div>
        <button type="button" className="btn committee-primary-action" onClick={onAutoAssignAll} disabled={assigningAll}>
          <i className="bi bi-magic" aria-hidden="true" />
          {assigningAll ? "Assigning..." : "Auto-assign all"}
        </button>
      </div>
      <div className="committee-waiting-list">
        {applicants.map((applicant) => (
          <UnassignedApplicantCard
            key={applicant.id}
            applicant={applicant}
            onAssign={onAssignApplicant}
            assigning={assigningApplicantId === applicant.id}
          />
        ))}
      </div>
    </section>
  );
}

function AssignmentCard({ assignment, members, canReassign, onSelect, onReassign, activeAssignmentId, reassigning }) {
  const [toMemberId, setToMemberId] = useState(assignment.committeeMember?.id || "");
  const [reason, setReason] = useState("");
  const isActive = activeAssignmentId === assignment.id;
  const applicant = assignment.applicant;
  const test = applicant?.skillsTest;

  return (
    <article className={`committee-assignment-card ${isActive ? "active" : ""}`}>
      <div className="committee-assignment-top">
        <button type="button" className="committee-assignment-title" onClick={() => onSelect(assignment)}>
          <span>{applicant?.fullName || "Applicant"}</span>
          <small>{getApplicantSubtitle(applicant)}</small>
        </button>
        <span className={`committee-assignment-status status-${assignment.status?.toLowerCase()}`}>
          {String(assignment.status || "Assigned").replace(/_/g, " ")}
        </span>
      </div>

      <div className="committee-assignment-meta">
        <span><i className="bi bi-person-badge" aria-hidden="true" /> {assignment.committeeMember?.fullName || "Unassigned"}</span>
        <span><i className="bi bi-clock" aria-hidden="true" /> {formatDate(assignment.assignedAt)}</span>
        {test && (
          <span><i className="bi bi-journal-check" aria-hidden="true" /> Test {test.score}/{test.maxScore} ({test.percentage}%)</span>
        )}
      </div>

      {canReassign && (
        <div className="committee-reassign-row">
          <select value={toMemberId} onChange={(event) => setToMemberId(event.target.value)}>
            <option value="">Reassign to...</option>
            {members
              .filter((member) => member.isActive && member.role === "MEMBER")
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
          </select>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for reassignment"
          />
          <button
            type="button"
            className="btn committee-small-action"
            disabled={!toMemberId || toMemberId === assignment.committeeMember?.id || reassigning}
            onClick={() => onReassign(assignment.id, toMemberId, reason)}
          >
            Reassign
          </button>
        </div>
      )}
    </article>
  );
}

function ReviewPanel({ assignment, onStartReview, onSubmitReview, submittingReview }) {
  const [decision, setDecision] = useState("SELECTED");
  const [comments, setComments] = useState("");

  useEffect(() => {
    setDecision("SELECTED");
    setComments("");
  }, [assignment?.id]);

  if (!assignment) {
    return null;
  }

  const applicant = assignment.applicant;
  const test = applicant?.skillsTest;
  const review = assignment.review;

  return (
    <aside className="committee-review-panel">
      <div className="committee-panel-header">
        <div>
          <span className="ss-small-label dark">Review workspace</span>
          <h2>{applicant?.fullName || "Applicant"}</h2>
          <p>{getApplicantSubtitle(applicant)}</p>
        </div>
        <span className="committee-score-badge">
          {test ? `${test.score}/${test.maxScore}` : "No test"}
        </span>
      </div>

      {test && (
        <div className="committee-test-card">
          <div>
            <span>Basic IT Skills Test</span>
            <strong>{test.percentage}%</strong>
          </div>
          <p>{test.passed ? "Passed the test threshold" : "Below the current test threshold"}</p>
        </div>
      )}

      <ApplicantMiniProfile applicant={applicant} />

      {review ? (
        <div className="committee-existing-review">
          <span>Decision submitted</span>
          <h3>{formatDecision(review.decision)}</h3>
          <p>{review.comments || "No comment was provided."}</p>
          <small>Reviewed on {formatDate(review.reviewedAt)}</small>
        </div>
      ) : (
        <form
          className="committee-decision-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitReview(assignment.id, { decision, comments });
          }}
        >
          {assignment.status === "ASSIGNED" && (
            <button
              type="button"
              className="btn committee-secondary-action"
              onClick={() => onStartReview(assignment.id)}
            >
              <i className="bi bi-play-circle" aria-hidden="true" /> Start review
            </button>
          )}

          <label>
            Committee decision
            <div className="committee-decision-grid">
              {REVIEW_DECISIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`committee-decision-option ${decision === item.value ? "selected" : ""}`}
                  onClick={() => setDecision(item.value)}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </label>

          <label>
            Review comments
            <textarea
              rows="4"
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Add the committee rationale, conditions, or next actions."
            />
          </label>

          <button type="submit" className="btn committee-primary-action" disabled={submittingReview}>
            <i className="bi bi-check2-circle" aria-hidden="true" />
            {submittingReview ? "Saving decision..." : "Save committee decision"}
          </button>
        </form>
      )}
    </aside>
  );
}

function CommitteeDashboardPage({ staffUser, onBackHome, onStaffLogout, onSessionExpired }) {
  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [unassignedApplicants, setUnassignedApplicants] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [filterMemberId, setFilterMemberId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assigningApplicantId, setAssigningApplicantId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [creatingLoginForMemberId, setCreatingLoginForMemberId] = useState("");

  const userRole = staffUser?.role || "";
  const canManageCommittee = ["ADMIN", "COMMITTEE_CHAIRPERSON"].includes(userRole);
  const canViewUnassignedApplicants = ["ADMIN", "COMMITTEE_CHAIRPERSON", "VIEWER"].includes(userRole);
  const canReassignApplicants = canManageCommittee;

  const selectedAssignmentFromList = useMemo(() => {
    if (!selectedAssignment?.id) return selectedAssignment;
    return assignments.find((assignment) => assignment.id === selectedAssignment.id) || selectedAssignment;
  }, [assignments, selectedAssignment]);

  function handleApiError(errorObject, fallbackMessage) {
    const status = errorObject.response?.status;
    if (status === 401) {
      setError("Your staff session has expired. Please sign in again.");
      onSessionExpired?.();
      return;
    }

    setError(errorObject.response?.data?.message || fallbackMessage);
  }

  async function loadCommitteeData() {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();
      if (filterMemberId && !["COMMITTEE_MEMBER"].includes(userRole)) query.set("memberId", filterMemberId);
      if (filterStatus) query.set("status", filterStatus);
      if (search.trim()) query.set("search", search.trim());

      const requests = [
        axios.get(`${API_BASE_URL}/api/committee/overview`),
        axios.get(`${API_BASE_URL}/api/committee/assignments?${query.toString()}`),
      ];

      if (canViewUnassignedApplicants) {
        requests.push(axios.get(`${API_BASE_URL}/api/committee/unassigned-ready`));
      }

      const [overviewResponse, assignmentsResponse, unassignedResponse] = await Promise.all(requests);

      setOverview(overviewResponse.data?.overview || null);
      setMembers(overviewResponse.data?.members || []);
      setAssignments(assignmentsResponse.data?.assignments || []);
      setUnassignedApplicants(canViewUnassignedApplicants ? (unassignedResponse?.data?.applicants || []) : []);
    } catch (loadError) {
      handleApiError(loadError, "Failed to load committee dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCommitteeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddMember(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setAddingMember(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/committee/members`, memberForm);
      setMessage(response.data?.message || "Committee member added.");
      setMemberForm(EMPTY_MEMBER_FORM);
      await loadCommitteeData();
    } catch (submitError) {
      handleApiError(submitError, "Failed to add committee member.");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleToggleMember(member) {
    setMessage("");
    setError("");

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/committee/members/${member.id}`, {
        isActive: !member.isActive,
      });
      setMessage(response.data?.message || "Committee member updated.");
      await loadCommitteeData();
    } catch (toggleError) {
      handleApiError(toggleError, "Failed to update committee member.");
    }
  }

  async function handleCreateMemberLogin(memberId, temporaryPassword, onSuccess) {
    setCreatingLoginForMemberId(memberId);
    setMessage("");
    setError("");

    try {
      const response = await axios.post(`${API_BASE_URL}/api/committee/members/${memberId}/login`, {
        temporaryPassword,
      });
      setMessage(response.data?.message || "Committee member login saved.");
      onSuccess?.();
      await loadCommitteeData();
    } catch (loginError) {
      handleApiError(loginError, "Failed to create committee member login.");
    } finally {
      setCreatingLoginForMemberId("");
    }
  }

  async function handleAutoAssign() {
    setAssigning(true);
    setMessage("");
    setError("");

    try {
      const response = await axios.post(`${API_BASE_URL}/api/committee/auto-assign`);
      setMessage(response.data?.message || "Automatic assignment completed.");
      await loadCommitteeData();
    } catch (assignError) {
      handleApiError(assignError, "Failed to run automatic assignment.");
    } finally {
      setAssigning(false);
    }
  }

  async function handleAssignApplicant(applicantId) {
    setAssigningApplicantId(applicantId);
    setMessage("");
    setError("");

    try {
      const response = await axios.post(`${API_BASE_URL}/api/committee/applicants/${applicantId}/assign`);
      setMessage(response.data?.message || "Applicant assigned successfully.");
      await loadCommitteeData();
    } catch (assignError) {
      handleApiError(assignError, "Failed to assign applicant.");
    } finally {
      setAssigningApplicantId("");
    }
  }

  async function handleReassign(assignmentId, toCommitteeMemberId, reason) {
    setReassigning(true);
    setMessage("");
    setError("");

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/committee/assignments/${assignmentId}/reassign`, {
        toCommitteeMemberId,
        reason,
      });
      setMessage(response.data?.message || "Applicant reassigned.");
      setSelectedAssignment(response.data?.assignment || selectedAssignment);
      await loadCommitteeData();
    } catch (reassignError) {
      handleApiError(reassignError, "Failed to reassign applicant.");
    } finally {
      setReassigning(false);
    }
  }

  async function handleStartReview(assignmentId) {
    setMessage("");
    setError("");

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/committee/assignments/${assignmentId}/start`);
      setMessage(response.data?.message || "Review started.");
      setSelectedAssignment(response.data?.assignment || selectedAssignment);
      await loadCommitteeData();
    } catch (startError) {
      handleApiError(startError, "Failed to start review.");
    }
  }

  async function handleSubmitReview(assignmentId, reviewPayload) {
    setSubmittingReview(true);
    setMessage("");
    setError("");

    try {
      const response = await axios.post(`${API_BASE_URL}/api/committee/assignments/${assignmentId}/review`, reviewPayload);
      setMessage(response.data?.message || "Committee decision saved.");
      setSelectedAssignment(response.data?.assignment || selectedAssignment);
      await loadCommitteeData();
    } catch (reviewError) {
      handleApiError(reviewError, "Failed to submit committee review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <main id="main-content" className="page committee-page">
      <section className="committee-hero">
        <div>
          <button type="button" className="back-button" onClick={onBackHome}>
            <i className="bi bi-arrow-left" aria-hidden="true" /> Back to portal
          </button>
          <p className="eyebrow">Internal review workspace</p>
          <h1>Committee Review & Assignment Board</h1>
          <p>
            Add committee members, monitor workload, automatically assign applicants, reassign reviews, and record committee decisions.
          </p>
        </div>
        <div className="committee-hero-card">
          <span>Signed in as</span>
          <strong>{staffUser?.fullName || "Staff user"}</strong>
          <p>{String(userRole || "STAFF").replace(/_/g, " ").toLowerCase()}</p>
          <button type="button" className="btn committee-secondary-action" onClick={onStaffLogout}>
            <i className="bi bi-box-arrow-right" aria-hidden="true" /> Sign out
          </button>
        </div>
      </section>

      <section className="committee-shell">
        {message && <div className="alert alert-success mb-3">{message}</div>}
        {error && <div className="alert alert-error mb-3">{error}</div>}

        <div className="committee-stat-grid">
          <StatCard label="Active members" value={overview?.activeMembers || 0} icon="bi-people" />
          <StatCard label="Ready for review" value={overview?.readyForReview || 0} icon="bi-person-check" tone="green" />
          <StatCard label="Unassigned" value={overview?.unassignedReadyForReview || 0} icon="bi-diagram-3" tone="orange" />
          <StatCard label="Completed reviews" value={overview?.completedReviews || 0} icon="bi-clipboard2-check" tone="purple" />
        </div>

        <div className="committee-action-bar">
          <div>
            <h2>Chairperson oversight</h2>
            <p>Use automatic assignment to distribute new applicants to the active member with the lightest workload.</p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn committee-secondary-action" onClick={loadCommitteeData} disabled={loading}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Refresh
            </button>
            {canManageCommittee && (
              <button type="button" className="btn committee-primary-action" onClick={handleAutoAssign} disabled={assigning}>
                <i className="bi bi-magic" aria-hidden="true" /> {assigning ? "Assigning..." : "Auto-assign ready applicants"}
              </button>
            )}
          </div>
        </div>

        {unassignedApplicants.length > 0 && (
          <div className="committee-unassigned-strip">
            <i className="bi bi-info-circle" aria-hidden="true" />
            <span>
              {unassignedApplicants.length} applicant{unassignedApplicants.length === 1 ? "" : "s"} completed the test and still need assignment. They are listed below under <strong>Applicants who need to be assigned</strong>.
            </span>
          </div>
        )}

        <ApplicantsWaitingPanel
          applicants={unassignedApplicants}
          onAssignApplicant={handleAssignApplicant}
          assigningApplicantId={assigningApplicantId}
          onAutoAssignAll={handleAutoAssign}
          assigningAll={assigning}
        />

        <div className="committee-layout">
          <div className="committee-management-grid">
            {canManageCommittee && (
              <AddMemberForm
                memberForm={memberForm}
                onChange={(field, value) => setMemberForm((current) => ({ ...current, [field]: value }))}
                onSubmit={handleAddMember}
                submitting={addingMember}
              />
            )}

            <section className="committee-section-card committee-workload-card">
              <div className="committee-section-header">
                <div>
                  <span className="ss-small-label dark">Members</span>
                  <h2>Committee workload</h2>
                  <p>Monitor active members and keep assignments balanced.</p>
                </div>
              </div>
              <div className="committee-member-list">
                {members.length === 0 ? (
                  <p className="committee-empty-text">No committee members have been added yet.</p>
                ) : (
                  members.map((member) => (
                    <MemberWorkloadCard
                      key={member.id}
                      member={member}
                      canManage={canManageCommittee}
                      onToggleActive={handleToggleMember}
                      onCreateLogin={handleCreateMemberLogin}
                      creatingLoginForMemberId={creatingLoginForMemberId}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="committee-section-card committee-board-card">
            <div className="committee-section-header with-filters">
              <div>
                <span className="ss-small-label dark">Assignment board</span>
                <h2>Applicants assigned for review</h2>
                <p>Select an applicant only when you are ready to review their details.</p>
              </div>
              <div className="committee-filter-grid">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, ID, phone, or reference"
                />
                {userRole !== "COMMITTEE_MEMBER" && (
                  <select value={filterMemberId} onChange={(event) => setFilterMemberId(event.target.value)}>
                    <option value="">All members</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.fullName}</option>
                    ))}
                  </select>
                )}
                <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_REVIEW">In review</option>
                  <option value="COMPLETED">Completed</option>
                </select>
                <button type="button" className="btn committee-small-action" onClick={loadCommitteeData}>
                  Apply
                </button>
              </div>
            </div>

            <div className={`committee-board-grid ${selectedAssignmentFromList ? "has-review" : ""}`}>
              <div className="committee-assignment-list">
                {assignments.length === 0 ? (
                  <div className="committee-empty-state">
                    <i className="bi bi-inboxes" aria-hidden="true" />
                    <h3>No assignments yet</h3>
                    <p>Add committee members, then run auto-assignment after applicants complete the Basic IT Skills Test.</p>
                  </div>
                ) : (
                  assignments.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      members={members}
                      canReassign={canReassignApplicants}
                      activeAssignmentId={selectedAssignmentFromList?.id}
                      reassigning={reassigning}
                      onSelect={setSelectedAssignment}
                      onReassign={handleReassign}
                    />
                  ))
                )}
              </div>

              {selectedAssignmentFromList && (
                <ReviewPanel
                  assignment={selectedAssignmentFromList}
                  onStartReview={handleStartReview}
                  onSubmitReview={handleSubmitReview}
                  submittingReview={submittingReview}
                />
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default CommitteeDashboardPage;
