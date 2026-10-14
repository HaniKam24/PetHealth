import { z } from 'zod';
import { SPECIES_VALUES } from '@/lib/pet-species';

// Shared between the manual-entry wizard (onboarding.tsx) and the A2
// live-fill form (components/onboarding-a2-form.tsx) — same shape as
// profile.tsx's profileSchema, kept independent since onboarding only ever
// creates a pet (never edits one) and deliberately doesn't need photoUrl in
// its form state at all.
export const onboardingSchema = z.object({
  name: z.string().min(1, "Your pet's name is required"),
  species: z.enum(SPECIES_VALUES),
  breed: z.string().optional().nullable(),
  sex: z.enum(['female', 'male', 'unknown']),
  birthDate: z.string().optional().nullable(),
  weight: z.coerce.number().optional().nullable(),
  weightUnit: z.enum(['lb', 'kg']),
  notes: z.string().optional().nullable(),
  vetName: z.string().optional().nullable(),
  vetClinic: z.string().optional().nullable(),
  vetPhone: z.string().optional().nullable(),
  vetAddress: z.string().optional().nullable(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export const ONBOARDING_FORM_DEFAULTS: OnboardingFormValues = {
  name: '',
  species: 'dog',
  breed: '',
  sex: 'unknown',
  birthDate: '',
  weight: null,
  weightUnit: 'lb',
  notes: '',
  vetName: '',
  vetClinic: '',
  vetPhone: '',
  vetAddress: '',
};
