import React, { createContext, useContext, useEffect, useState } from "react";

export interface SystemPreferences {
  require_qa_inbound: boolean;
  two_step_outbound: boolean;
  lot_number_format: string;
  default_tax_rate: number;
  fefo_warning_days: number;
  scanner_sound_enabled: boolean;
  theme_mode: string;
}

const defaultPreferences: SystemPreferences = {
  require_qa_inbound: true,
  two_step_outbound: false,
  lot_number_format: "LOT-{YYYYMMDD}-{XXXX}",
  default_tax_rate: 8.0,
  fefo_warning_days: 30,
  scanner_sound_enabled: true,
  theme_mode: "auto",
};

interface PreferencesContextType {
  preferences: SystemPreferences;
  loading: boolean;
  updatePreferences: (newPrefs: Partial<SystemPreferences>) => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<SystemPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = async () => {
    try {
      const res = await fetch("/api/preferences");
      if (res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
          setPreferences({ ...defaultPreferences, ...data });
        }
      }
    } catch (err) {
      console.error("Failed to fetch preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const updatePreferences = async (newPrefs: Partial<SystemPreferences>) => {
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(prev => ({ ...prev, ...data }));
      } else {
        throw new Error("Failed to update preferences");
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return (
    <PreferencesContext.Provider value={{ preferences, loading, updatePreferences, refreshPreferences: fetchPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
