import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { usePetContext } from '@/context/pet-context';
import { getListPetsQueryKey, type Pet, type PetInput } from '@workspace/api-client-react';
import { OnboardingChat } from '@/components/onboarding-chat';
import { OnboardingA2Form } from '@/components/onboarding-a2-form';
import { useToast } from '@/hooks/use-toast';
import { setPendingTutorial } from '@/lib/onboarding-tutorial-flag';
import SmartUpload from '@/pages/smart-upload';

// Per the finalized Pawlie onboarding design (handoff README): there is no
// variant picker in the product — onboarding always opens straight into the
// chat (B1), with the A2 form reachable only via "Use the form instead"
// inside it. The real plan-picker step already exists separately
// (pages/pick-a-plan.tsx, gating entry into this route — see App.tsx).
type View = 'chat' | 'a2-form';

export default function Onboarding() {
  const { setActivePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [view, setView] = useState<View>('chat');
  // A one-time snapshot handed up by OnboardingChat the first time "Use the
  // form instead" is clicked — seeds A2's form once (name/species/photo
  // already answered carry over), not a live two-way sync. Both
  // OnboardingChat and OnboardingA2Form stay mounted once this is set
  // (toggled via CSS below, not conditional rendering) so switching back
  // and forth preserves each one's own state — the chat's messages and
  // progress survive "Back" exactly as the handoff requires.
  const [a2Seed, setA2Seed] = useState<{ pet: PetInput; petId: number | null } | null>(null);
  const [needsReviewPet, setNeedsReviewPet] = useState<Pet | null>(null);

  // Shared by both flows once they've already created/updated their own
  // pet — just the "pet is done" cache + navigation side effects.
  const handleExternalPetDone = (pet: Pet) => {
    queryClient.setQueryData(getListPetsQueryKey(), (old: typeof pet[] | undefined) => [...(old ?? []), pet]);
    queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
    setActivePetId(pet.id);
    setPendingTutorial();
    toast({ title: 'Welcome to the family!', description: `${pet.name} has been added.` });
    setLocation('/');
  };

  // A2's upload can find health records/medications/reminders beyond the
  // basic profile fields it live-fills directly — those still need the
  // owner's review via the existing (more capable than the handoff's own
  // bespoke checklist) SmartUpload review screen.
  const handleA2NeedsReview = (pet: Pet) => {
    queryClient.setQueryData(getListPetsQueryKey(), (old: typeof pet[] | undefined) => [...(old ?? []), pet]);
    queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
    setActivePetId(pet.id);
    setNeedsReviewPet(pet);
  };

  if (needsReviewPet) {
    return (
      <div className="min-h-[100dvh] bg-background">
        {/* Reused as-is, not a route change — same drag-drop, extraction,
            and per-item review/edit/accept/reject UI as the standalone
            Uploads page. It reads activePetId from context, not the URL,
            so it drops in here unmodified. */}
        <SmartUpload />
        <div className="max-w-4xl mx-auto px-6 md:px-10 pb-16">
          <div className="bg-card border border-border rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[15px] text-muted-foreground">
              Review what we found above — accept, edit, or reject each item. Come back and upload more any time from "Uploads."
            </p>
            <button
              type="button"
              onClick={() => setLocation('/')}
              className="shrink-0 h-[52px] px-7 flex items-center justify-center gap-2.5 rounded-full bg-primary text-primary-foreground font-extrabold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors"
            >
              Let's go <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-background">
      <div className={view === 'chat' ? 'h-full' : 'hidden'}>
        <OnboardingChat
          onUseFormInstead={(pet, petId) => {
            setA2Seed({ pet, petId });
            setView('a2-form');
          }}
          onDone={handleExternalPetDone}
        />
      </div>
      {a2Seed && (
        <div className={view === 'a2-form' ? 'h-full overflow-y-auto' : 'hidden'}>
          <OnboardingA2Form
            initialPet={a2Seed.pet}
            initialPetId={a2Seed.petId}
            onBack={() => setView('chat')}
            onDone={handleExternalPetDone}
            onNeedsReview={handleA2NeedsReview}
          />
        </div>
      )}
    </div>
  );
}
