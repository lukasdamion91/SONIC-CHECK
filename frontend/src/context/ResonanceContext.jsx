import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { INITIAL_SCAN_PROGRESS } from '@/lib/scanProgress.mjs';
import { unobservedResonance } from '@/lib/resonanceIdentity.mjs';

const ResonanceContext = createContext(null);

export function ResonanceProvider({ children }) {
  const [progress, setProgress] = useState(INITIAL_SCAN_PROGRESS);
  const [paused, setPaused] = useState(false);
  const release = useCallback(() => setProgress(previous => unobservedResonance(previous)), []);
  const togglePaused = useCallback(() => setPaused(value => !value), []);
  const value = useMemo(() => ({ progress, setProgress, release, paused, togglePaused }), [progress, release, paused, togglePaused]);
  return <ResonanceContext.Provider value={value}>{children}</ResonanceContext.Provider>;
}

export const useResonance = () => useContext(ResonanceContext);
