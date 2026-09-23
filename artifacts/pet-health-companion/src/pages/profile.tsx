import { usePetContext } from '@/context/pet-context';
import {
  useGetPet,
  getGetPetQueryKey,
  useUpdatePet,
  useCreatePet,
  useDeletePet,
  useUploadPetPhoto,
  useRemovePetPhoto,
  useListMedications,
  getListMedicationsQueryKey,
  useGetPetTrends,
  getGetPetTrendsQueryKey,
  useGetPetVaccines,
  getGetPetVaccinesQueryKey,
  getListPetsQueryKey,
  type Pet,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2, HeartPulse, Check, Camera, Loader2, Share2, Printer, X, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import { SPECIES_VALUES, SPECIES_OPTIONS, BREEDS_BY_SPECIES } from '@/lib/pet-species';
import { ShareLinkCard } from '@/components/share-link-card';
import { PetPassportCard } from '@/components/pet-passport-card';

const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  species: z.enum(SPECIES_VALUES),
  breed: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  // Must match the `microchipId` pattern on PetInput in lib/api-spec/openapi.yaml
  // (this form schema isn't generated, so a change on one side needs the other).
  microchipId: z
    .string()
    .regex(/^[A-Za-z0-9]{9,15}$/, 'Microchip ID should be 9-15 letters/numbers, with no spaces or dashes')
    .optional()
    .nullable()
    .or(z.literal('')),
  sex: z.enum(['female', 'male', 'unknown']),
  spayNeuterStatus: z.enum(['spayed_neutered', 'intact', 'unknown']),
  birthDate: z.string().optional().nullable(),
  gotchaDate: z.string().optional().nullable(),
  weight: z.coerce.number().optional().nullable(),
  weightUnit: z.enum(['lb', 'kg']),
  photoUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  vetName: z.string().optional().nullable(),
  vetClinic: z.string().optional().nullable(),
  vetPhone: z.string().optional().nullable(),
  vetAddress: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// Sitter Brief — a separate, smaller form from the main profile edit form
// above. Edited as its own group from the "Things worth remembering" card
// rather than folded into "Edit all", since it's caretaking info for
// whoever's watching the pet, not core profile identity.
const briefSchema = z.object({
  criticalInfoSummary: z.string().optional().nullable(),
  criticalInfoDetails: z.string().optional().nullable(),
  feedingInstructions: z.string().optional().nullable(),
  whereThingsAre: z.string().optional().nullable(),
  walksAndTriggers: z.string().optional().nullable(),
  handlingNotes: z.string().optional().nullable(),
  whatNormalLooksLike: z.string().optional().nullable(),
  caretakingPreference: z.string().optional().nullable(),
  emergencyVetName: z.string().optional().nullable(),
  emergencyVetPhone: z.string().optional().nullable(),
  emergencyVetHours: z.string().optional().nullable(),
});
type BriefFormValues = z.infer<typeof briefSchema>;
const EMPTY_BRIEF: BriefFormValues = {
  criticalInfoSummary: '',
  criticalInfoDetails: '',
  feedingInstructions: '',
  whereThingsAre: '',
  walksAndTriggers: '',
  handlingNotes: '',
  whatNormalLooksLike: '',
  caretakingPreference: '',
  emergencyVetName: '',
  emergencyVetPhone: '',
  emergencyVetHours: '',
};

// Age is never stored — it's either derived from birthDate, or (when there's
// no birthDate) a free-standing number the user can type in for their own
// reference, which isn't part of the form's zod schema and isn't sent to the
// server at all.
function computeAgeYearsFromBirthDate(birthDate: string): string {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years -= 1;
  return String(Math.max(years, 0));
}

// A native <input type="date"> (so typing mm/dd/yyyy directly always works)
// plus: a clear button, since native date inputs don't reliably show one
// across browsers, and a dedicated calendar-icon button that opens a bigger,
// easier-to-browse picker for jumping across months/years by click instead.
//
// The calendar button is deliberately separate from the input itself and
// never attached to the input's own onClick — that was tried and reverted:
// showPicker() on a generic click popped the calendar open even when the
// click was meant to focus a specific mm/dd/yyyy segment for keyboard
// typing, and the calendar then intercepted the keystrokes instead of the
// field, so a typed date silently never registered.
function DateField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  // The formatted overlay (real date, or a "Month DD, YYYY" placeholder when
  // empty) only replaces the native mm/dd/yyyy display while the field is at
  // rest — while focused/being edited, the native segments show through as
  // normal. Tried hiding them unconditionally too: the browser's own
  // highlight for the focused segment ignores an author `color`, so it bled
  // through as garbled overlapping text with the overlay.
  const showOverlay = !focused;
  return (
    <div className="relative">
      <Input
        type="date"
        className={cn(
          className,
          'pl-9',
          value && 'pr-9',
          showOverlay && 'text-transparent caret-transparent',
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {showOverlay && (
        <span
          className={cn(
            'pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-sm',
            !selected && 'text-muted-foreground',
          )}
        >
          {selected ? format(selected, 'MMM d, yyyy') : 'Month DD, YYYY'}
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open calendar"
          >
            <CalendarDays size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-4 text-base"
          align="start"
          style={{ '--cell-size': '3rem' } as React.CSSProperties}
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown"
            onSelect={(date) => {
              onChange(date ? format(date, 'yyyy-MM-dd') : '');
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear date"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default function Profile() {
  const { activePetId, setActivePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  // wouter's useLocation() returns only the pathname, never the query
  // string — the "new=true" flag has to come from useSearch() instead.
  const isNew = new URLSearchParams(search).get('new') === 'true';

  const { data: pet, isLoading } = useGetPet(
    activePetId!,
    {
      query: {
        enabled: !!activePetId && !isNew,
        queryKey: activePetId ? getGetPetQueryKey(activePetId) : ['no-pet']
      }
    }
  );

  // Read-only — medications are managed on the Medicines page, this is just
  // a quick "what are they currently on" glance shown in the Health card.
  const { data: medications } = useListMedications(
    activePetId!,
    {
      query: {
        enabled: !!activePetId && !isNew,
        queryKey: activePetId ? getListMedicationsQueryKey(activePetId) : ['no-pet-medications'],
      },
    },
  );
  const activeMedications = (medications ?? []).filter((m) => m.active);
  const activeMedicationNames = activeMedications.map((m) => m.name);

  // Same weight-trend hook/derivation dashboard.tsx uses for its weight
  // delta — reused here rather than re-fetched or recomputed differently.
  const { data: trends } = useGetPetTrends(activePetId!, {
    query: {
      enabled: !!activePetId && !isNew,
      queryKey: activePetId ? getGetPetTrendsQueryKey(activePetId) : ['no-pet', 'trends'],
    },
  });
  const weightLogs = trends?.weightLogs ?? [];
  const hasWeightTrend = weightLogs.length >= 2;
  const weightDelta = hasWeightTrend ? weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight : 0;
  const lastWeighedAt = weightLogs.length > 0 ? new Date(weightLogs[weightLogs.length - 1].recordedAt) : null;

  const { data: petVaccines } = useGetPetVaccines(activePetId!, {
    query: {
      enabled: !!activePetId && !isNew,
      queryKey: activePetId ? getGetPetVaccinesQueryKey(activePetId) : ['no-pet', 'vaccines'],
    },
  });
  const vaccines = petVaccines?.vaccines ?? [];

  // Passport (read-only summary) is the default landing view; 'edit' reuses
  // the existing full form below. A brand-new pet has no passport to show
  // yet, so it always starts in edit mode.
  const [mode, setMode] = useState<'passport' | 'edit'>(isNew ? 'edit' : 'passport');
  const [shareOpen, setShareOpen] = useState(false);
  const [editBriefOpen, setEditBriefOpen] = useState(false);

  const briefForm = useForm<BriefFormValues>({
    resolver: zodResolver(briefSchema),
    defaultValues: EMPTY_BRIEF,
  });

  // Re-sync from the latest pet data each time the dialog opens, rather than
  // on every pet refetch — this is a short-lived popup, not a page that
  // needs to react to background updates while open.
  useEffect(() => {
    if (editBriefOpen && pet) {
      briefForm.reset({
        criticalInfoSummary: pet.criticalInfoSummary || '',
        criticalInfoDetails: pet.criticalInfoDetails || '',
        feedingInstructions: pet.feedingInstructions || '',
        whereThingsAre: pet.whereThingsAre || '',
        walksAndTriggers: pet.walksAndTriggers || '',
        handlingNotes: pet.handlingNotes || '',
        whatNormalLooksLike: pet.whatNormalLooksLike || '',
        caretakingPreference: pet.caretakingPreference || '',
        emergencyVetName: pet.emergencyVetName || '',
        emergencyVetPhone: pet.emergencyVetPhone || '',
        emergencyVetHours: pet.emergencyVetHours || '',
      });
    }
  }, [editBriefOpen, pet, briefForm]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      species: 'dog',
      breed: '',
      color: '',
      microchipId: '',
      sex: 'unknown',
      spayNeuterStatus: 'unknown',
      birthDate: '',
      gotchaDate: '',
      weight: null,
      weightUnit: 'lb',
      photoUrl: '',
      notes: '',
      allergies: '',
      vetName: '',
      vetClinic: '',
      vetPhone: '',
      vetAddress: '',
    },
  });

  // Guarded by isDirty rather than a one-shot "have we ever synced" flag —
  // the latter meant that once this page had synced the form once, a pet
  // update accepted from *elsewhere* (e.g. a Smart Document Upload proposal
  // accepted from that page) never showed up here even though the
  // underlying query had genuinely refetched fresh data, because the form
  // was never told to re-read it. isDirty still protects an in-progress
  // edit from being clobbered by an unrelated background refetch.
  useEffect(() => {
    if (pet && !isNew && !form.formState.isDirty) {
      form.reset({
        name: pet.name,
        species: pet.species,
        breed: pet.breed || '',
        color: pet.color || '',
        microchipId: pet.microchipId || '',
        sex: pet.sex,
        spayNeuterStatus: pet.spayNeuterStatus,
        birthDate: pet.birthDate ? pet.birthDate.split('T')[0] : '',
        gotchaDate: pet.gotchaDate ? pet.gotchaDate.split('T')[0] : '',
        weight: pet.weight,
        weightUnit: pet.weightUnit,
         photoUrl: pet.photoUrl?.startsWith('preset:') ? '' : pet.photoUrl || '',
        notes: pet.notes || '',
        allergies: pet.allergies || '',
        vetName: pet.vetName || '',
        vetClinic: pet.vetClinic || '',
        vetPhone: pet.vetPhone || '',
        vetAddress: pet.vetAddress || '',
      });
    }
  }, [pet, isNew, form]);

  // Reset form when entering 'new' mode
  useEffect(() => {
    if (isNew) {
      form.reset({
        name: '', species: 'dog', breed: '', color: '', microchipId: '', sex: 'unknown', spayNeuterStatus: 'unknown', birthDate: '', gotchaDate: '',
        weight: null, weightUnit: 'lb', photoUrl: '', notes: '', allergies: '',
        vetName: '', vetClinic: '', vetPhone: '', vetAddress: '',
      });
    }
  }, [isNew, form]);



  const updatePet = useUpdatePet({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(data.id) });
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        toast({ title: "Profile updated successfully" });
        setMode('passport');
      },
      onError: (error) => {
        toast({ title: "Couldn't save changes", description: error.message, variant: "destructive" });
      },
    }
  });

  const createPet = useCreatePet({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        setActivePetId(data.id);
        setLocation('/profile');
        toast({ title: "Welcome to the family!", description: `${data.name} has been added.` });
      },
      onError: (error) => {
        toast({ title: "Couldn't add pet", description: error.message, variant: "destructive" });
      },
    }
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deletePet = useDeletePet({
    mutation: {
      onSuccess: async (_data, variables) => {
        const deletedPetName = pet?.name;
        // This page only ever deletes the pet currently being viewed
        // (activePetId), so it's always responsible for picking the next
        // one. `await` here — not fire-and-forget — so the list is
        // genuinely refetched before we read it; PetProvider's own effect
        // deliberately doesn't do this correction itself (see its comment)
        // since it can't tell a stale list from a fresh one.
        await queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        const remaining = (queryClient.getQueryData<Pet[]>(getListPetsQueryKey()) ?? []).filter(
          (p) => p.id !== variables.petId,
        );
        setActivePetId(remaining.length > 0 ? remaining[0].id : null);
        setIsDeleteDialogOpen(false);
        setLocation('/');
        toast({ title: "Profile deleted", description: deletedPetName ? `${deletedPetName} has been removed.` : undefined });
      },
      onError: (error) => {
        setIsDeleteDialogOpen(false);
        toast({ title: "Couldn't delete profile", description: error.message, variant: "destructive" });
      },
    }
  });

  const photoInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = useUploadPetPhoto({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetPetQueryKey(updated.id), updated);
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        toast({ title: "Photo updated" });
      },
      onError: (error) => {
        toast({ title: "Couldn't upload photo", description: error.message, variant: "destructive" });
      },
    },
  });

  const removePhoto = useRemovePetPhoto({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetPetQueryKey(updated.id), updated);
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        toast({ title: "Photo removed" });
      },
      onError: (error) => {
        toast({ title: "Couldn't remove photo", description: error.message, variant: "destructive" });
      },
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activePetId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Photo is too large', description: 'Maximum size is 10MB.', variant: 'destructive' });
      return;
    }
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.type)) {
      toast({ title: 'Unsupported file type', description: 'Use a JPEG, PNG, WEBP, or HEIC image.', variant: 'destructive' });
      return;
    }
    uploadPhoto.mutate({ petId: activePetId, data: { file } });
  };

  const onSubmit = (data: ProfileFormValues) => {
    const payload = {
      ...data,
      photoUrl: pet?.photoUrl ?? null,
      birthDate: data.birthDate || null,
      gotchaDate: data.gotchaDate || null,
      breed: data.breed || null,
      color: data.color || null,
      microchipId: data.microchipId || null,
      notes: data.notes || null,
      allergies: data.allergies || null,
      vetName: data.vetName || null,
      vetClinic: data.vetClinic || null,
      vetPhone: data.vetPhone || null,
      vetAddress: data.vetAddress || null,
    };

    if (isNew) {
      createPet.mutate({ data: payload });
    } else if (activePetId) {
      updatePet.mutate({ petId: activePetId, data: payload });
    }
  };

  // A separate, smaller update than onSubmit above — but PetInput/PetUpdate
  // requires name/species/sex/spayNeuterStatus/weightUnit on every write, so
  // this still has to carry those 5 current values along even though only
  // the brief fields actually change. Omitting every other optional field
  // (breed, notes, vet contact, etc.) is safe — the API only touches keys
  // actually present in the request body.
  const onSubmitBrief = (data: BriefFormValues) => {
    if (!activePetId || !pet) return;
    updatePet.mutate({
      petId: activePetId,
      data: {
        name: pet.name,
        species: pet.species,
        sex: pet.sex,
        spayNeuterStatus: pet.spayNeuterStatus,
        weightUnit: pet.weightUnit,
        criticalInfoSummary: data.criticalInfoSummary || null,
        criticalInfoDetails: data.criticalInfoDetails || null,
        feedingInstructions: data.feedingInstructions || null,
        whereThingsAre: data.whereThingsAre || null,
        walksAndTriggers: data.walksAndTriggers || null,
        handlingNotes: data.handlingNotes || null,
        whatNormalLooksLike: data.whatNormalLooksLike || null,
        caretakingPreference: data.caretakingPreference || null,
        emergencyVetName: data.emergencyVetName || null,
        emergencyVetPhone: data.emergencyVetPhone || null,
        emergencyVetHours: data.emergencyVetHours || null,
      },
    }, {
      onSuccess: () => setEditBriefOpen(false),
    });
  };

  if (isLoading && !isNew) return <div className="p-10 animate-pulse text-center text-muted-foreground">Loading profile...</div>;

  if (mode === 'passport' && pet) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto pb-16">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[34px] font-extrabold tracking-tight">{pet.name}&#39;s passport</h1>
            <p className="mt-1 text-[16px] text-muted-foreground">
              Everything a vet, sitter or boarding kennel asks for, on one badge.
            </p>
          </div>
          <div className="print:hidden flex items-center gap-2">
            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="h-10 px-4 flex items-center gap-1.5 rounded-full bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <Share2 size={16} /> Share
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                {activePetId && <ShareLinkCard petId={activePetId} petName={pet.name} />}
              </DialogContent>
            </Dialog>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-10 px-4 flex items-center gap-1.5 rounded-full border border-border text-sm font-bold hover:bg-accent transition-colors"
            >
              <Printer size={16} /> Print
            </button>
          </div>
        </div>

        <div className="mt-6">
          <PetPassportCard
            pet={pet}
            activeMedications={activeMedications}
            hasWeightTrend={hasWeightTrend}
            weightDelta={weightDelta}
            lastWeighedAt={lastWeighedAt}
            vaccines={vaccines}
            onEditAll={() => setMode('edit')}
            onEditBrief={() => setEditBriefOpen(true)}
            onChangePhoto={() => photoInputRef.current?.click()}
            isUploadingPhoto={uploadPhoto.isPending}
          />
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={handlePhotoSelect}
          className="hidden"
        />

        <Dialog open={editBriefOpen} onOpenChange={setEditBriefOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle>Edit {pet.name}&#39;s sitter brief</DialogTitle>
            </DialogHeader>
            <Form {...briefForm}>
              <form onSubmit={briefForm.handleSubmit(onSubmitBrief)} className="space-y-5 mt-2">
                <FormField
                  control={briefForm.control}
                  name="criticalInfoSummary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Critical info — short summary</FormLabel>
                      <FormControl>
                        <Input placeholder="No chicken · door-dasher · never off-leash near the road" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={briefForm.control}
                  name="criticalInfoDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Critical info — details</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Explain the summary above — what happens, and what to do about it." className="resize-none min-h-[80px]" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={briefForm.control}
                  name="feedingInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feeding</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Amounts, schedule, water" className="resize-none min-h-[70px]" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={briefForm.control}
                  name="whereThingsAre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Where things are</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Food, leash, treats, crate, clean-up supplies — wherever you keep them" className="resize-none min-h-[90px]" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={briefForm.control}
                  name="walksAndTriggers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Walks &amp; triggers</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Schedule, leash habits, what sets them off and how to handle it" className="resize-none min-h-[80px]" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={briefForm.control}
                  name="handlingNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Handling</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What's fine, what to avoid" className="resize-none min-h-[70px]" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={briefForm.control}
                  name="whatNormalLooksLike"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What normal looks like</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Baseline behavior, and when to call the owner" className="resize-none min-h-[70px]" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={briefForm.control}
                  name="caretakingPreference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caretaking preference</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. A photo and a quick note each evening" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={briefForm.control}
                    name="emergencyVetName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency vet</FormLabel>
                        <FormControl>
                          <Input placeholder="Eastside Animal Emergency" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={briefForm.control}
                    name="emergencyVetPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency vet phone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="(555) 911-0000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={briefForm.control}
                  name="emergencyVetHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency vet hours / distance</FormLabel>
                      <FormControl>
                        <Input placeholder="Open 24h · 12 min away" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditBriefOpen(false)}
                    className="h-11 px-5 rounded-full text-muted-foreground font-bold hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatePet.isPending}
                    className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {updatePet.isPending ? 'Saving…' : 'Save brief'}
                  </button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const name = form.watch('name');
  const watchedBirthDate = form.watch('birthDate');
  const displayedAge = watchedBirthDate ? computeAgeYearsFromBirthDate(watchedBirthDate) : '';
  const selectedSpecies = form.watch('species');
  const currentPhotoSrc = resolvePetAvatar(isNew ? null : pet?.photoUrl ?? null, selectedSpecies);
  const hasUploadedPhoto = !isNew && !!pet?.photoUrl && !pet.photoUrl.startsWith('preset:');
  const savedBreed = form.watch('breed');
  const breedOptions = BREEDS_BY_SPECIES[selectedSpecies] ?? [];
  const visibleBreedOptions =
    savedBreed && !breedOptions.some((breed) => breed.value === savedBreed)
      ? [{ value: savedBreed, label: `${savedBreed} (saved)` }, ...breedOptions]
      : breedOptions;

  const fieldClass = 'h-12 rounded-2xl bg-accent/40';

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[34px] font-extrabold tracking-tight">
            {isNew ? "Let's add your pet" : `${pet?.name ?? 'Pet'}'s details`}
          </h1>
          <p className="mt-1 mb-6 text-[16.5px] text-muted-foreground">
            {isNew ? 'Tell us about your furry, feathered, or scaly friend.' : 'The bits a vet always asks for. Keep them current and everything else gets smarter.'}
          </p>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={() => setMode('passport')}
            className="shrink-0 text-sm font-bold text-primary hover:underline"
          >
            Back to passport
          </button>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-6">
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={isNew || uploadPhoto.isPending}
                onClick={() => photoInputRef.current?.click()}
                className={cn(
                  'w-24 h-24 rounded-full bg-accent flex items-center justify-center text-primary overflow-hidden',
                  !isNew && 'cursor-pointer',
                )}
                aria-label="Change pet photo"
              >
                {currentPhotoSrc ? (
                  <img src={currentPhotoSrc} alt="Pet avatar" className="w-full h-full object-cover" />
                ) : name ? (
                  <span className="text-4xl font-serif font-extrabold">{name.charAt(0)}</span>
                ) : (
                  <HeartPulse size={40} />
                )}
                {uploadPhoto.isPending && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 size={24} className="text-white animate-spin" />
                  </div>
                )}
              </button>
              {!isNew && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-card pointer-events-none">
                  <Camera size={14} />
                </div>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-muted-foreground">Name</div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        placeholder="Pet's Name"
                        className="w-full mt-0.5 text-[32px] font-serif font-extrabold tracking-tight bg-transparent border-b-2 border-border focus:border-primary focus:outline-none pb-1 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="text-sm shrink-0 hidden sm:flex flex-col items-end gap-1 text-right">
              {isNew ? (
                <span className="text-muted-foreground">Using the {selectedSpecies} illustration</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadPhoto.isPending}
                    className="text-primary font-bold hover:underline disabled:opacity-50"
                  >
                    {hasUploadedPhoto ? 'Change photo' : 'Add a photo'}
                  </button>
                  {hasUploadedPhoto && (
                    <button
                      type="button"
                      onClick={() => activePetId && removePhoto.mutate({ petId: activePetId })}
                      disabled={removePhoto.isPending}
                      className="text-muted-foreground hover:underline disabled:opacity-50"
                    >
                      Remove photo
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-3xl p-6">
              <div className="font-serif text-lg font-extrabold mb-4">Identity</div>
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

              <div className="mt-3">
                <FormField
                  control={form.control}
                  name="breed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breed</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger className={fieldClass}>
                            <SelectValue placeholder={`Select a ${selectedSpecies} breed`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {visibleBreedOptions.map((breed) => (
                            <SelectItem key={breed.value} value={breed.value}>
                              {breed.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-3">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input placeholder="Black and white" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-3">
                <FormField
                  control={form.control}
                  name="spayNeuterStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spay/Neuter status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={fieldClass}>
                            <SelectValue placeholder="Spay/Neuter status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="spayed_neutered">Spayed/Neutered</SelectItem>
                          <SelectItem value="intact">Intact</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-3">
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birthday</FormLabel>
                      <FormControl>
                        <DateField value={field.value || ''} onChange={field.onChange} className={fieldClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-3 space-y-1">
                <Label>Age</Label>
                <p className="text-[15px] font-medium">
                  {displayedAge ? `${displayedAge} ${displayedAge === '1' ? 'year' : 'years'}` : <span className="text-muted-foreground">—</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {watchedBirthDate ? 'Calculated automatically from birthday.' : 'Set a birthday to calculate age.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-5">
            <div className="bg-card border border-border rounded-3xl p-6">
              <div className="font-serif text-lg font-extrabold mb-4">Health</div>
              <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-3">
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Weight</FormLabel>
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

              <div className="mt-3">
                <FormField
                  control={form.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allergies</FormLabel>
                      <FormControl>
                        <Input placeholder="Chicken, pollen…" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-3 space-y-1">
                <Label>Medication</Label>
                {activeMedicationNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {activeMedicationNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-accent/60 px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None on file.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Read from the Medicines page — manage medications there.
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6">
              <div className="font-serif text-lg font-extrabold mb-4">Details</div>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="gotchaDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gotcha day</FormLabel>
                      <FormControl>
                        <DateField value={field.value || ''} onChange={field.onChange} className={fieldClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="microchipId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Microchip ID</FormLabel>
                      <FormControl>
                        <Input placeholder="985141000000000" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="font-serif text-lg font-extrabold mb-4">My Vet</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-serif text-lg font-extrabold">Things worth remembering</FormLabel>
                  <p className="text-sm text-muted-foreground mb-1">Allergies, what frightens them, where they hide.</p>
                  <FormControl>
                    <Textarea
                      placeholder="Allergies, favorite hiding spots, fears..."
                      className="resize-none rounded-2xl bg-accent/40 min-h-[130px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            {!isNew ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="h-[50px] px-5 flex items-center gap-2 rounded-full border border-destructive/30 text-destructive font-bold hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={17} /> Delete {pet?.name ?? 'pet'} and everything in their file
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={updatePet.isPending || createPet.isPending}
              className="h-[52px] px-7 flex items-center gap-2.5 rounded-full bg-primary text-primary-foreground font-extrabold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Check size={19} />
              {isNew ? 'Create profile' : 'Save changes'}
            </button>
          </div>
        </form>
      </Form>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pet?.name || 'this'} profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {pet?.name || 'this pet'} and all of their health records, medications, reminders, and uploaded documents. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deletePet.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePet.isPending}
              onClick={() => {
                if (activePetId) {
                  deletePet.mutate({ petId: activePetId });
                }
              }}
            >
              {deletePet.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
