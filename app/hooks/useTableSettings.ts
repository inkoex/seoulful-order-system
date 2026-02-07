import { useState, useEffect, useCallback } from "react";
import { type OrderTableSettings } from "@/models";
import {
  DEFAULT_TABLE_SETTINGS,
  TABLE_SETTINGS_STORAGE_KEY,
  parseTableSettings,
  mergeTableSettings,
} from "@/lib/tableUtils";

/**
 * Custom hook for managing table settings with localStorage persistence
 *
 * Features:
 * - Loads settings from localStorage on mount
 * - Automatically saves changes to localStorage
 * - Validates data with Zod schema
 * - Provides reset functionality
 * - Handles loading state
 *
 * @returns Settings object, save function, reset function, and loading state
 */
export function useTableSettings() {
  const [settings, setSettings] = useState<OrderTableSettings>(DEFAULT_TABLE_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TABLE_SETTINGS_STORAGE_KEY);

      if (stored) {
        const validated = parseTableSettings(stored);

        if (validated) {
          // Robust merge: ensure new default columns/settings are not lost
          const merged = {
            ...DEFAULT_TABLE_SETTINGS,
            ...validated,
            columnVisibility: {
              ...DEFAULT_TABLE_SETTINGS.columnVisibility,
              ...validated.columnVisibility
            },
            columnSizing: {
              ...DEFAULT_TABLE_SETTINGS.columnSizing,
              ...validated.columnSizing
            }
          };
          setSettings(merged);
        } else {
          // Invalid data, use defaults and clear storage
          console.warn("Invalid table settings found, using defaults");
          localStorage.removeItem(TABLE_SETTINGS_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load table settings:", error);
      // On error, use defaults
    } finally {
      setIsLoaded(true);
    }
  }, []);

  /**
   * Save partial settings updates
   * Merges with existing settings and persists to localStorage
   */
  const saveSettings = useCallback((newSettings: Partial<OrderTableSettings>) => {
    setSettings((prev) => {
      const updated = mergeTableSettings(prev, newSettings);

      try {
        localStorage.setItem(TABLE_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save table settings:", error);

        // Check if it's a quota exceeded error
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          alert("브라우저 저장소 용량이 부족합니다. 일부 설정이 저장되지 않을 수 있습니다.");
        }
      }

      return updated;
    });
  }, []);

  /**
   * Reset settings to defaults
   * Clears localStorage and restores default values
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_TABLE_SETTINGS);

    try {
      localStorage.removeItem(TABLE_SETTINGS_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to reset table settings:", error);
    }
  }, []);

  return {
    settings,
    saveSettings,
    resetSettings,
    isLoaded,
  };
}
