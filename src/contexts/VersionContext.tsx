import React, { createContext, useContext, useState, useMemo } from 'react';
import { VersionKey, VERSION_LABELS } from '@/hooks/useVolumeBPData';

interface VersionContextType {
  version: VersionKey;
  setVersion: (v: VersionKey) => void;
  label: string;
}

const VersionContext = createContext<VersionContextType | null>(null);

const STORAGE_KEY = 'comparison_version';

export function VersionProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersionState] = useState<VersionKey>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY) as VersionKey | null;
      if (v === 'bp' || v === 're05' || v === 're09') return v;
    } catch {}
    return 'bp';
  });

  const setVersion = (v: VersionKey) => {
    setVersionState(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch {}
  };

  const value = useMemo(() => ({ version, setVersion, label: VERSION_LABELS[version] }), [version]);

  return <VersionContext.Provider value={value}>{children}</VersionContext.Provider>;
}

export function useVersion() {
  const ctx = useContext(VersionContext);
  if (!ctx) throw new Error('useVersion must be used within VersionProvider');
  return ctx;
}
