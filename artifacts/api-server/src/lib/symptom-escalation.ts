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

// A US zipcode, 5-digit or ZIP+4, as a standalone token anywhere in the
// message — not anchored to the whole string, since a reply to "what's your
// zipcode?" often isn't *just* a zipcode (e.g. "02143, he's also drooling a
// lot now") and that extra detail matters just as much as the zip itself.
// Word-boundaried so it doesn't match a stray 5-digit number embedded in an
// unrelated sentence.
const ZIP_CODE_PATTERN = /(?<!\d)\d{5}(?:-\d{4})?(?!\d)/;

export function extractZipCode(text: string): string | null {
  return text.match(ZIP_CODE_PATTERN)?.[0] ?? null;
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

  return `What you're describing could be a medical emergency. Please don't wait — seek veterinary care now rather than continuing to look for guidance here.\n\n${contactBlock}\n\nIf you'd like, I can also look up emergency vet clinics near you — just reply with your zipcode.`;
}
