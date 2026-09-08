// Deterministic, zero-AI-cost red-flag check for symptom chat — mirrors the
// rule-based style of care-recommendations.ts. "Escalation over guessing"
// (PRD 7c): a red flag short-circuits the normal AI answer path entirely
// rather than asking the model to recognize it, so this can never depend on
// the model's reliability for the one path that's actually safety-critical.
const RED_FLAG_PATTERN =
  /trouble breathing|difficulty breathing|collapse|seizure|uncontrolled bleeding|prolonged bleeding|poison|cannot urinate|swollen abdomen|severe pain|emergency/i;

export function isRedFlagQuestion(question: string): boolean {
  return RED_FLAG_PATTERN.test(question);
}

interface PetVetContact {
  vetName: string | null;
  vetClinic: string | null;
  vetPhone: string | null;
  vetAddress: string | null;
}

export function buildEscalationMessage(pet: PetVetContact): string {
  const contactLines = [
    pet.vetName ? `Vet: ${pet.vetName}` : null,
    pet.vetClinic ? `Clinic: ${pet.vetClinic}` : null,
    pet.vetPhone ? `Phone: ${pet.vetPhone}` : null,
    pet.vetAddress ? `Address: ${pet.vetAddress}` : null,
  ].filter((line): line is string => line !== null);

  const contactBlock =
    contactLines.length > 0
      ? `Contact your pet's saved vet right away:\n\n${contactLines.join("\n")}`
      : "Contact the nearest emergency veterinary clinic right away — this app doesn't have a vet saved for this pet yet.";

  return `What you're describing could be a medical emergency. Please don't wait — seek veterinary care now rather than continuing to look for guidance here.\n\n${contactBlock}`;
}
