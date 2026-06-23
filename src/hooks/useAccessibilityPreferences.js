import { useEffect, useState } from "react";

const STORAGE_KEY = "sightsavers-accessibility-preferences";

const defaultPreferences = {
  highContrast: false,
  largeText: false,
  reduceMotion: false,
};

function readStoredPreferences() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultPreferences;
    return { ...defaultPreferences, ...JSON.parse(stored) };
  } catch {
    return defaultPreferences;
  }
}

export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState(readStoredPreferences);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("ss-high-contrast", preferences.highContrast);
    root.classList.toggle("ss-large-text", preferences.largeText);
    root.classList.toggle("ss-reduce-motion", preferences.reduceMotion);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // The app still works even when localStorage is disabled.
    }
  }, [preferences]);

  function togglePreference(key) {
    setPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function resetPreferences() {
    setPreferences(defaultPreferences);
  }

  return {
    preferences,
    togglePreference,
    resetPreferences,
  };
}
