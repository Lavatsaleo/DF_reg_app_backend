import { useState } from "react";
import AccessibilityToolbar from "./components/AccessibilityToolbar";
import AppNavbar from "./components/AppNavbar";
import LandingPage from "./pages/LandingPage";
import RegistrationPage from "./pages/RegistrationPage";
import StatusCheckPage from "./pages/StatusCheckPage";
import SkillsTestPage from "./pages/SkillsTestPage";
import CommitteeDashboardPage from "./pages/CommitteeDashboardPage";
import { useAccessibilityPreferences } from "./hooks/useAccessibilityPreferences";
import { useRegistrationForm } from "./hooks/useRegistrationForm";

function getInitialSkillsTestToken() {
  const match = window.location.pathname.match(/^\/basic-skills-test\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function App() {
  const registration = useRegistrationForm();
  const accessibility = useAccessibilityPreferences();
  const initialSkillsTestToken = getInitialSkillsTestToken();
  const [currentView, setCurrentView] = useState(initialSkillsTestToken ? "skills-test" : "home");
  const [skillsTestReference, setSkillsTestReference] = useState("");
  const [skillsTestToken, setSkillsTestToken] = useState(initialSkillsTestToken);

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
    setCurrentView("committee");
    setSkillsTestReference("");
    setSkillsTestToken("");
    registration.handleBackToPathways();
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
        currentView={currentView}
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

      {currentView === "committee" ? (
        <CommitteeDashboardPage onBackHome={handleShowHome} />
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
        />
      )}
    </>
  );
}

export default App;