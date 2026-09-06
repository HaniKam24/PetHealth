import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useListPets } from '@workspace/api-client-react';

interface PetContextType {
  activePetId: number | null;
  setActivePetId: (id: number) => void;
  isLoading: boolean;
}

const PetContext = createContext<PetContextType | undefined>(undefined);

export function PetProvider({ children }: { children: ReactNode }) {
  const [activePetId, setActivePetId] = useState<number | null>(null);
  const { data: pets, isLoading } = useListPets();

  useEffect(() => {
    if (pets && pets.length > 0 && !activePetId) {
      setActivePetId(pets[0].id);
    } else if (pets && pets.length === 0) {
      setActivePetId(null);
    }
  }, [pets, activePetId]);

  return (
    <PetContext.Provider value={{ activePetId, setActivePetId, isLoading }}>
      {children}
    </PetContext.Provider>
  );
}

export function usePetContext() {
  const context = useContext(PetContext);
  if (context === undefined) {
    throw new Error('usePetContext must be used within a PetProvider');
  }
  return context;
}
