import { useState } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { HeartPulse, Upload, PenLine, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { usePetContext } from '@/context/pet-context';
import { useCreatePet, getListPetsQueryKey } from '@workspace/api-client-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import { SPECIES_VALUES, SPECIES_OPTIONS } from '@/lib/pet-species';
import { setPendingTutorial } from '@/lib/onboarding-tutorial-flag';
import SmartUpload from '@/pages/smart-upload';

// Same shape as profile.tsx's profileSchema — kept independent rather than
// imported, since this wizard only ever creates a pet (never edits one) and
// deliberately doesn't need photoUrl in its form state at all.
const onboardingSchema = z.object({
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

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

type Step = 'choice' | 'manual-basics' | 'manual-vitals' | 'manual-vet' | 'upload-basics' | 'upload-review';

const DEFAULT_VALUES: OnboardingFormValues = {
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

const fieldClass = 'h-12 rounded-2xl bg-accent/40';

function StepShell({
  title,
  subtitle,
  children,
  onBack,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="font-serif text-[28px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 mb-6 text-[16px] text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

export default function Onboarding() {
  const { setActivePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('choice');

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const createPet = useCreatePet({
    mutation: {
      // Uses setQueryData (synchronous cache write), not just invalidateQueries
      // (which only marks stale and refetches in the background) — App.tsx's
      // zero-pets redirect guard reads this same list, and if it still saw
      // an empty array for the async gap after invalidate-but-before-refetch,
      // it would bounce back to /onboarding out from under the very
      // navigation this onSuccess is about to trigger.
      onSuccess: (data) => {
        queryClient.setQueryData(getListPetsQueryKey(), (old: typeof data[] | undefined) => [...(old ?? []), data]);
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        setActivePetId(data.id);
        setPendingTutorial();
        toast({ title: 'Welcome to the family!', description: `${data.name} has been added.` });
      },
      onError: (error) => {
        toast({ title: "Couldn't add your pet", description: error.message, variant: 'destructive' });
      },
    },
  });

  const finishManual = async () => {
    const valid = await form.trigger(['vetName', 'vetClinic', 'vetPhone', 'vetAddress']);
    if (!valid) return;
    const data = form.getValues();
    createPet.mutate(
      {
        data: {
          ...data,
          photoUrl: null,
          birthDate: data.birthDate || null,
          breed: data.breed || null,
          notes: data.notes || null,
          vetName: data.vetName || null,
          vetClinic: data.vetClinic || null,
          vetPhone: data.vetPhone || null,
          vetAddress: data.vetAddress || null,
        },
      },
      { onSuccess: () => setLocation('/') },
    );
  };

  const finishUpload = async () => {
    const valid = await form.trigger(['name', 'species']);
    if (!valid) return;
    const data = form.getValues();
    createPet.mutate(
      {
        data: {
          name: data.name,
          species: data.species,
          sex: 'unknown',
          weightUnit: 'lb',
          breed: null,
          birthDate: null,
          weight: null,
          photoUrl: null,
          notes: null,
          vetName: null,
          vetClinic: null,
          vetPhone: null,
          vetAddress: null,
        },
      },
      { onSuccess: () => setStep('upload-review') },
    );
  };

  const selectedSpecies = form.watch('species');
  const name = form.watch('name');
  const avatarSrc = resolvePetAvatar(null, selectedSpecies);

  if (step === 'choice') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-2xl text-center">
          <div className="w-20 h-20 rounded-full bg-accent text-primary flex items-center justify-center mx-auto mb-6">
            <HeartPulse size={38} strokeWidth={2} />
          </div>
          <h1 className="font-serif text-[34px] font-extrabold tracking-tight">Let's add your pet</h1>
          <p className="mt-2 mb-9 text-[17px] text-muted-foreground">
            How would you like to get started?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <button
              type="button"
              onClick={() => setStep('manual-basics')}
              className="text-left bg-card border border-border rounded-3xl p-7 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-accent text-primary flex items-center justify-center mb-4">
                <PenLine size={22} />
              </div>
              <div className="font-serif text-xl font-extrabold mb-1.5">Enter it myself</div>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                Type in your pet's basics, birthday, and vet contact — takes about a minute.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setStep('upload-basics')}
              className="text-left bg-card border border-border rounded-3xl p-7 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-accent text-primary flex items-center justify-center mb-4">
                <Upload size={22} />
              </div>
              <div className="font-serif text-xl font-extrabold mb-1.5">Upload their vet records</div>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                Just give us their name, then upload a vet report and we'll fill in the rest.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'upload-basics') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
        <StepShell
          title="What's their name?"
          subtitle="Just their name and species for now — we'll fill in the rest from the vet report you upload next."
          onBack={() => setStep('choice')}
        >
          <Form {...form}>
            <div className="bg-card border border-border rounded-3xl p-7 flex flex-col gap-5">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-primary shrink-0 overflow-hidden">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Pet avatar" className="w-full h-full object-cover" />
                  ) : (
                    <HeartPulse size={28} />
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Pet's name" className={fieldClass} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="species"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Species</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={fieldClass}>
                          <SelectValue placeholder="Species" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPECIES_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
          <button
            type="button"
            disabled={createPet.isPending}
            onClick={finishUpload}
            className="mt-6 w-full h-[52px] flex items-center justify-center gap-2.5 rounded-full bg-primary text-primary-foreground font-extrabold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Continue to upload <ArrowRight size={18} />
          </button>
        </StepShell>
      </div>
    );
  }

  if (step === 'upload-review') {
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

  // Manual path — three short steps sharing the same form instance.
  const stepIndex = { 'manual-basics': 1, 'manual-vitals': 2, 'manual-vet': 3 }[step as 'manual-basics' | 'manual-vitals' | 'manual-vet'];

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-xl">
        <div className="text-center text-xs font-bold tracking-wide text-muted-foreground mb-2">
          STEP {stepIndex} OF 3
        </div>
        <Form {...form}>
          {step === 'manual-basics' && (
            <StepShell
              title="Tell us about them"
              subtitle="Name, species, and sex — the essentials."
              onBack={() => setStep('choice')}
            >
              <div className="bg-card border border-border rounded-3xl p-7 flex flex-col gap-5">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-primary shrink-0 overflow-hidden">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="Pet avatar" className="w-full h-full object-cover" />
                    ) : name ? (
                      <span className="text-2xl font-serif font-extrabold">{name.charAt(0)}</span>
                    ) : (
                      <HeartPulse size={28} />
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Pet's name" className={fieldClass} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="species"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Species</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue('breed', '', { shouldDirty: true });
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className={fieldClass}>
                              <SelectValue placeholder="Species" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SPECIES_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sex</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={fieldClass}>
                              <SelectValue placeholder="Sex" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const valid = await form.trigger(['name', 'species', 'sex']);
                  if (valid) setStep('manual-vitals');
                }}
                className="mt-6 w-full h-[52px] flex items-center justify-center gap-2.5 rounded-full bg-primary text-primary-foreground font-extrabold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors"
              >
                Next <ArrowRight size={18} />
              </button>
            </StepShell>
          )}

          {step === 'manual-vitals' && (
            <StepShell
              title="A few vitals"
              subtitle="Birthday and weight — skip anything you don't know yet."
              onBack={() => setStep('manual-basics')}
            >
              <div className="bg-card border border-border rounded-3xl p-7 flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birthday or gotcha day (optional)</FormLabel>
                      <FormControl>
                        <Input type="date" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-3">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="0.0" className={fieldClass} {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="weightUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={fieldClass}>
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="lb">lbs</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('manual-vet')}
                className="mt-6 w-full h-[52px] flex items-center justify-center gap-2.5 rounded-full bg-primary text-primary-foreground font-extrabold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors"
              >
                Next <ArrowRight size={18} />
              </button>
            </StepShell>
          )}

          {step === 'manual-vet' && (
            <StepShell
              title="Their vet (optional)"
              subtitle="Handy for reminders and the one-tap call button on alerts — skip if you'd rather add it later."
              onBack={() => setStep('manual-vitals')}
            >
              <div className="bg-card border border-border rounded-3xl p-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vetName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vet</FormLabel>
                      <FormControl>
                        <Input placeholder="Dr. Jamie Rivera" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vetClinic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clinic</FormLabel>
                      <FormControl>
                        <Input placeholder="Harbor Veterinary Clinic" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vetPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="(555) 123-4567" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vetAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Harbor St, Portland, ME" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={createPet.isPending}
                  onClick={() => {
                    form.setValue('vetName', '');
                    form.setValue('vetClinic', '');
                    form.setValue('vetPhone', '');
                    form.setValue('vetAddress', '');
                    void finishManual();
                  }}
                  className="h-[52px] px-5 rounded-full border border-border font-bold text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Skip this step
                </button>
                <button
                  type="button"
                  disabled={createPet.isPending}
                  onClick={() => void finishManual()}
                  className="flex-1 h-[52px] flex items-center justify-center gap-2.5 rounded-full bg-primary text-primary-foreground font-extrabold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Check size={18} /> Create profile
                </button>
              </div>
            </StepShell>
          )}
        </Form>
      </div>
    </div>
  );
}
