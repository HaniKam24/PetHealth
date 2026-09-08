import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useListPets } from '@workspace/api-client-react';

interface PetContextType {
  activePetId: number | null;
  setActivePetId: (id: number | null) => void;
  isLoading: boolean;
}

const PetContext = createContext<PetContextType | undefined>(undefined);

export function PetProvider({ children }: { children: ReactNode }) {
  const [activePetId, setActivePetId] = useState<number | null>(null);
  const { data: pets, isLoading } = useListPets();

  // Only auto-picks when nothing is selected at all — deliberately does NOT
  // try to detect "activePetId no longer exists in the list" and correct it,
  // because right after any mutation that both invalidates this list and
  // explicitly sets a new activePetId in the same tick (e.g. creating a
  // pet), this list is briefly stale (invalidation triggers an async
  // refetch) while activePetId has already changed — a "does it still
  // exist" check reads that stale list and incorrectly reverts the fresh
  // selection. Any mutation that can orphan activePetId (deleting the
  // active pet) is responsible for explicitly setting the next value itself
  // — see profile.tsx's delete handler — rather than leaning on this effect
  // to infer it from a list that isn't guaranteed fresh yet.
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
