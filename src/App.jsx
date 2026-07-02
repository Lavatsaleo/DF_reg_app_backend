import { useEffect, useState } from "react";
import axios from "axios";
import AccessibilityToolbar from "./components/AccessibilityToolbar";
import AppNavbar from "./components/AppNavbar";
import LandingPage from "./pages/LandingPage";
import RegistrationPage from "./pages/RegistrationPage";
import StatusCheckPage from "./pages/StatusCheckPage";
import SkillsTestPage from "./pages/SkillsTestPage";
import CommitteeDashboardPage from "./pages/CommitteeDashboardPage";
import StaffLoginPage from "./pages/StaffLoginPage";
import { useAccessibilityPreferences } from "./hooks/useAccessibilityPreferences";
import { useRegistrationForm } from "./hooks/useRegistrationForm";
import { clearStaffSession, loadStaffSession, saveStaffSession } from "./utils/staffAuthStorage";

function getInitialSkillsTestToken() {
  const match = window.location.pathname.match(/^\/basic-skills-test\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function configureAxiosAuth(token) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
}

function App() {
  const registration = useRegistrationForm();
  const accessibility = useAccessibilityPreferences();
  const initialSkillsTestToken = getInitialSkillsTestToken();
  const [currentView, setCurrentView] = useState(initialSkillsTestToken ? "skills-test" : "home");
  const [skillsTestReference, setSkillsTestReference] = useState("");
  const [skillsTestToken, setSkillsTestToken] = useState(initialSkillsTestToken);
  const [staffSession, setStaffSession] = useState(() => loadStaffSession());

  useEffect(() => {
    configureAxiosAuth(staffSession?.token || "");
  }, [staffSession?.token]);

  function resetBrowserPath() {
    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
  }

  function handleShowHome() {
    resetBrowserPath();
    setCurrentView("home");
    setSkillsTestReference("");
    setSkillsTestToken("");
    registration.handleBackToPathways();
  }

  function handleShowStatus() {
    resetBrowserPath();
    setCurrentView("status");
    setSkillsTestReference("");
    setSkillsTestToken("");
    registration.handleBackToPathways();
  }


  function handleShowCommittee() {
    resetBrowserPath();
    setCurrentView(staffSession?.token ? "committee" : "staff-login");
    setSkillsTestReference("");
    setSkillsTestToken("");
    registration.handleBackToPathways();
  }

  function handleStaffLogin(session) {
    saveStaffSession(session);
    configureAxiosAuth(session.token);
    setStaffSession(session);
    setCurrentView("committee");
  }

  function handleStaffLogout() {
    clearStaffSession();
    configureAxiosAuth("");
    setStaffSession(null);
    setCurrentView("staff-login");
  }

  function handleSessionExpired() {
    clearStaffSession();
    configureAxiosAuth("");
    setStaffSession(null);
    setCurrentView("staff-login");
  }

  function handleShowSkillsTest(reference = "") {
    resetBrowserPath();
    setCurrentView("skills-test");
    setSkillsTestReference(reference || "");
    setSkillsTestToken("");
    registration.handleBackToPathways();
  }

  function handlePathwaySelect(pathway) {
    resetBrowserPath();
    setCurrentView("home");
    registration.handlePathwaySelect(pathway);
  }

  const showStatusButton = !(
    registration.submitResult?.hideApplicationReference === true ||
    registration.submitResult?.status === "INELIGIBLE" ||
    registration.submitResult?.screeningStatus === "NOT_ELIGIBLE"
  );

  return (
    <>
      <a className="ss-skip-link" href="#main-content">
        Skip to main content
      </a>

      <AppNavbar
        selectedPathway={registration.selectedPathway}
        currentView={currentView === "staff-login" ? "committee" : currentView}
        onBackToPathways={handleShowHome}
        onCheckStatus={handleShowStatus}
        showStatusButton={showStatusButton}
        onShowCommittee={handleShowCommittee}
      />

      <AccessibilityToolbar
        preferences={accessibility.preferences}
        onTogglePreference={accessibility.togglePreference}
        onResetPreferences={accessibility.resetPreferences}
      />

      {currentView === "staff-login" ? (
        <StaffLoginPage onLogin={handleStaffLogin} onBackHome={handleShowHome} />
      ) : currentView === "committee" ? (
        <CommitteeDashboardPage
          staffUser={staffSession?.user}
          onBackHome={handleShowHome}
          onStaffLogout={handleStaffLogout}
          onSessionExpired={handleSessionExpired}
        />
      ) : currentView === "status" ? (
        <StatusCheckPage
          onBackHome={handleShowHome}
          onStartApplication={handleShowHome}
          onTakeSkillsTest={handleShowSkillsTest}
        />
      ) : currentView === "skills-test" ? (
        <SkillsTestPage
          initialReference={skillsTestReference}
          initialToken={skillsTestToken}
          onBackHome={handleShowHome}
          onCheckStatus={handleShowStatus}
        />
      ) : !registration.selectedPathway ? (
        <LandingPage
          pathwayMessage={registration.pathwayMessage}
          onPathwaySelect={handlePathwaySelect}
          onCheckStatus={handleShowStatus}
        />
      ) : (
        <RegistrationPage
          selectedPathway={registration.selectedPathway}
          groupedQuestions={registration.groupedQuestions}
          answers={registration.answers}
          documents={registration.documents}
          documentType={registration.documentType}
          loadingQuestions={registration.loadingQuestions}
          submitting={registration.submitting}
          submitResult={registration.submitResult}
          errorMessage={registration.errorMessage}
          fieldErrors={registration.fieldErrors}
          formProgress={registration.formProgress}
          draftLastSavedAt={registration.draftLastSavedAt}
          draftReference={registration.draftReference}
          draftSaveStatus={registration.draftSaveStatus}
          draftSaveMessage={registration.draftSaveMessage}
          currentStep={registration.currentStep}
          onBackToPathways={handleShowHome}
          onCheckStatus={handleShowStatus}
          onTakeSkillsTest={handleShowSkillsTest}
          onAnswerChange={registration.handleAnswerChange}
          onMultiSelectChange={registration.handleMultiSelectChange}
          onSubmit={registration.handleSubmit}
          onValidateQuestions={registration.handleValidateQuestions}
          onDocumentsChange={registration.setDocuments}
          onDocumentTypeChange={registration.setDocumentType}
          onClearDraft={registration.handleClearDraft}
          onStepChange={registration.handleCurrentStepChange}
        />
      )}
    </>
  );
}

export default App;
