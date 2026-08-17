import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { PROGRAMS } from './constants';

interface ProgramContextType {
  program: string;
  setProgram: (val: string) => void;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const [program, setProgram] = useState<string>(PROGRAMS[0]);

  return (
    <ProgramContext.Provider value={{ program, setProgram }}>
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  const context = useContext(ProgramContext);
  if (context === undefined) {
    throw new Error('useProgram must be used within a ProgramProvider');
  }
  return context;
}
