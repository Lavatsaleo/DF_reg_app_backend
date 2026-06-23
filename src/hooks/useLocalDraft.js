import { useEffect, useMemo, useRef, useState } from "react";

function safeRead(storageKey) {
  try {
    const rawDraft = window.localStorage.getItem(storageKey);
    return rawDraft ? JSON.parse(rawDraft) : null;
  } catch (error) {
    console.warn("Unable to read saved registration draft", error);
    return null;
  }
}

function safeWrite(storageKey, payload) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Unable to save registration draft", error);
    return false;
  }
}

function safeRemove(storageKey) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn("Unable to clear registration draft", error);
  }
}

export function useLocalDraft({ storageKey, enabled, answers, documentType, onRestoreDraft }) {
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const hasCompletedInitialRestore = useRef(false);
  const skipNextSave = useRef(false);

  const draftPayload = useMemo(
    () => ({
      answers,
      documentType,
    }),
    [answers, documentType]
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!enabled || !storageKey) return;

    hasCompletedInitialRestore.current = false;

    const storedDraft = safeRead(storageKey);

    if (storedDraft) {
      onRestoreDraft?.({
        answers: storedDraft.answers || {},
        documentType: storedDraft.documentType,
      });
      setLastSavedAt(storedDraft.savedAt || null);
    } else {
      setLastSavedAt(null);
    }

    window.requestAnimationFrame(() => {
      hasCompletedInitialRestore.current = true;
    });
  }, [enabled, storageKey, onRestoreDraft]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!enabled || !storageKey || !hasCompletedInitialRestore.current) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const saveTimeout = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const saved = safeWrite(storageKey, {
        ...draftPayload,
        savedAt,
      });

      if (saved) {
        setLastSavedAt(savedAt);
      }
    }, 450);

    return () => window.clearTimeout(saveTimeout);
  }, [enabled, storageKey, draftPayload]);

  function clearDraft() {
    if (!storageKey) return;
    skipNextSave.current = true;
    safeRemove(storageKey);
    setLastSavedAt(null);
  }

  return {
    lastSavedAt,
    clearDraft,
  };
}
