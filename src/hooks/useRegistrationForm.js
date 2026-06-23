import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { groupQuestionsBySection, isQuestionVisible } from "../utils/formUtils";
import { calculateFormProgress, validateAnswers } from "../utils/validationUtils";
import { useLocalDraft } from "./useLocalDraft";
import { saveSubmittedApplication } from "../utils/applicationStatusStorage";

function createLocalReference(pathwayId) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  const pathwayPart = String(pathwayId || "DF").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "DF";

  return `SS-${pathwayPart}-${datePart}-${randomPart}`;
}

function normalizeSubmissionResult(apiResult, selectedPathway, contactNumber) {
  const rawResult = apiResult || {};
  const nestedData = rawResult.data && typeof rawResult.data === "object" ? rawResult.data : {};
  const result = { ...rawResult, ...nestedData };
  const existingReference =
    result.applicationReference ||
    result.referenceNumber ||
    result.registrationReference ||
    result.registrationId ||
    result.id;
  const hideApplicationReference =
    result.hideApplicationReference === true ||
    result.screeningStatus === "NOT_ELIGIBLE" ||
    result.status === "INELIGIBLE";

  return {
    ...result,
    hideApplicationReference,
    allowStatusCheck: result.allowStatusCheck !== false && !hideApplicationReference,
    applicationReference: hideApplicationReference
      ? null
      : existingReference || createLocalReference(selectedPathway?.id),
    pathway: result.pathway || selectedPathway?.id,
    registrationMode: result.registrationMode || selectedPathway?.mode,
    status: result.status || "Submitted",
    message: result.message || "Your application has been submitted successfully.",
    contactNumber: result.contactNumber || contactNumber || null,
    submittedAt: result.submittedAt || new Date().toISOString(),
  };
}

function shouldIncludeQuestionInApplicantView(question, answers) {
  if (question.hiddenFromApplicant) return false;
  return isQuestionVisible(question, answers);
}

function shouldIncludeQuestionInSubmission(question, answers) {
  if (question.hiddenFromApplicant) {
    return answers[question.questionCode] !== undefined && answers[question.questionCode] !== null && answers[question.questionCode] !== "";
  }

  return isQuestionVisible(question, answers);
}

export function useRegistrationForm() {
  const [selectedPathway, setSelectedPathway] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [documents, setDocuments] = useState([]);
  const [documentType, setDocumentType] = useState("DISABILITY_DOCUMENT");
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [pathwayMessage, setPathwayMessage] = useState("");

  const draftStorageKey = selectedPathway
    ? `sightsavers-registration-draft-${selectedPathway.id}`
    : "";

  const restoreDraft = useCallback((draft) => {
    if (draft.answers && Object.keys(draft.answers).length > 0) {
      setAnswers({
        ...draft.answers,
        ...(selectedPathway ? { COURSE_APPLIED_FOR: selectedPathway.title } : {}),
      });
    }

    if (draft.documentType) {
      setDocumentType(draft.documentType);
    }
  }, [selectedPathway]);

  const { lastSavedAt: draftLastSavedAt, clearDraft } = useLocalDraft({
    storageKey: draftStorageKey,
    enabled: Boolean(selectedPathway),
    answers,
    documentType,
    onRestoreDraft: restoreDraft,
  });

  useEffect(() => {
    if (!selectedPathway) return;

    async function fetchQuestions() {
      try {
        setLoadingQuestions(true);
        setErrorMessage("");
        setFieldErrors({});

        const response = await axios.get(
          `${API_BASE_URL}/api/registrations/form/questions`
        );

        setQuestions(response.data.questions || []);
      } catch (error) {
        console.error(error);
        setErrorMessage("Unable to load the registration form. Please try again.");
      } finally {
        setLoadingQuestions(false);
      }
    }

    fetchQuestions();
  }, [selectedPathway]);

  const groupedQuestions = useMemo(() => {
    const visibleQuestions = questions.filter((question) =>
      shouldIncludeQuestionInApplicantView(question, answers)
    );

    return groupQuestionsBySection(visibleQuestions);
  }, [questions, answers]);

  const formProgress = useMemo(
    () => calculateFormProgress({ groupedQuestions, answers }),
    [groupedQuestions, answers]
  );

  function handlePathwaySelect(pathway) {
    setPathwayMessage("");
    setSubmitResult(null);
    setErrorMessage("");
    setFieldErrors({});

    if (pathway.status !== "open") {
      setPathwayMessage(
        `${pathway.title} is not yet open for registration. For now, please use the Physical Academy workflow.`
      );
      return;
    }

    setSelectedPathway(pathway);
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      COURSE_APPLIED_FOR: pathway.title,
    }));
  }

  function handleBackToPathways() {
    setSelectedPathway(null);
    setAnswers({});
    setDocuments([]);
    setSubmitResult(null);
    setErrorMessage("");
    setFieldErrors({});
    setPathwayMessage("");
  }

  function handleAnswerChange(question, value) {
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [question.questionCode]: value,
    }));

    setFieldErrors((previousErrors) => {
      if (!previousErrors[question.questionCode]) return previousErrors;

      const updatedErrors = { ...previousErrors };
      delete updatedErrors[question.questionCode];
      return updatedErrors;
    });

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleMultiSelectChange(question, option) {
    const currentValues = Array.isArray(answers[question.questionCode])
      ? answers[question.questionCode]
      : [];

    const updatedValues = currentValues.includes(option)
      ? currentValues.filter((item) => item !== option)
      : [...currentValues, option];

    handleAnswerChange(question, updatedValues);
  }

  function buildResponsesPayload() {
    return questions
      .filter((question) => shouldIncludeQuestionInSubmission(question, answers))
      .map((question) => ({
        questionCode: question.questionCode,
        questionNumber: question.questionNumber,
        questionText: question.questionText,
        section: question.section,
        responseType: question.responseType,
        answer:
          answers[question.questionCode] === undefined
            ? null
            : answers[question.questionCode],
      }));
  }

  function scrollToFormErrors() {
    window.requestAnimationFrame(() => {
      const errorElement = document.querySelector(".ss-error-summary, .ss-question-card.has-error");
      errorElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleValidateQuestions(questionList) {
    const validationErrors = validateAnswers({
      questions: questionList,
      answers,
      isQuestionVisible,
    });

    setFieldErrors((previousErrors) => {
      const updatedErrors = { ...previousErrors };

      questionList.forEach((question) => {
        delete updatedErrors[question.questionCode];
      });

      return {
        ...updatedErrors,
        ...validationErrors,
      };
    });

    const hasErrors = Object.keys(validationErrors).length > 0;

    if (hasErrors) {
      setErrorMessage("Please complete the highlighted questions before continuing.");
      scrollToFormErrors();
      return false;
    }

    setErrorMessage("");
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitResult(null);
    setErrorMessage("");

    const validationErrors = validateAnswers({
      questions: questions.filter((question) => shouldIncludeQuestionInApplicantView(question, answers)),
      answers,
      isQuestionVisible,
    });

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setErrorMessage("Please correct the highlighted fields before submitting.");
      scrollToFormErrors();
      return;
    }

    setFieldErrors({});

    try {
      setSubmitting(true);

      const formData = new FormData();

      formData.append("pathway", selectedPathway.id);
      formData.append("registrationMode", selectedPathway.mode);
      formData.append("documentType", documentType);
      formData.append("responses", JSON.stringify(buildResponsesPayload()));

      for (const file of documents) {
        formData.append("documents", file);
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/registrations`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const normalizedResult = normalizeSubmissionResult(
        response.data,
        selectedPathway,
        answers.CONTACT_NUMBER
      );
      saveSubmittedApplication(normalizedResult, selectedPathway);
      setSubmitResult(normalizedResult);
      setAnswers({});
      setDocuments([]);
      setFieldErrors({});
      clearDraft();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);

      const responseData = error.response?.data || {};

      if (error.response?.status === 409 && responseData.duplicate) {
        const duplicateResult = normalizeSubmissionResult(
          { ...responseData, duplicate: true },
          selectedPathway,
          answers.CONTACT_NUMBER
        );

        saveSubmittedApplication(duplicateResult, selectedPathway);
        setSubmitResult(duplicateResult);
        setAnswers({});
        setDocuments([]);
        setFieldErrors({});
        clearDraft();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (Array.isArray(responseData.missingRequiredQuestions)) {
        const missingErrors = responseData.missingRequiredQuestions.reduce((accumulator, item) => {
          accumulator[item.questionCode] = `${item.questionText || item.questionCode} is required.`;
          return accumulator;
        }, {});
        setFieldErrors(missingErrors);
      }

      if (Array.isArray(responseData.invalidQuestions)) {
        const formatErrors = responseData.invalidQuestions.reduce((accumulator, item) => {
          accumulator[item.questionCode] = item.message || `${item.questionText || item.questionCode} is not valid.`;
          return accumulator;
        }, {});
        setFieldErrors(formatErrors);
      }

      const apiMessage =
        responseData.message ||
        responseData.error ||
        "Failed to submit registration. Please try again.";

      setErrorMessage(apiMessage);
      scrollToFormErrors();
    } finally {
      setSubmitting(false);
    }
  }

  function handleClearDraft() {
    clearDraft();
    setAnswers({});
    setDocuments([]);
    setDocumentType("DISABILITY_DOCUMENT");
    setFieldErrors({});
    setErrorMessage("");
  }

  return {
    selectedPathway,
    groupedQuestions,
    answers,
    documents,
    documentType,
    loadingQuestions,
    submitting,
    submitResult,
    errorMessage,
    fieldErrors,
    pathwayMessage,
    formProgress,
    draftLastSavedAt,
    handlePathwaySelect,
    handleBackToPathways,
    handleAnswerChange,
    handleMultiSelectChange,
    handleSubmit,
    handleValidateQuestions,
    handleClearDraft,
    setDocuments,
    setDocumentType,
  };
}
