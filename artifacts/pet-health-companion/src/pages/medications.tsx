import { usePetContext } from '@/context/pet-context';
import {
  useListMedications,
  getListMedicationsQueryKey,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
  useLogMedicationDose,
  useListPets,
  type Medication,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Pill,
  Clock,
  AlertCircle,
  Syringe,
  Ban,
  RotateCcw,
  Loader2,
  ChevronsUpDown,
  Check,
  Info,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

const DOSE_INTERVAL_UNITS = ['hours', 'days', 'weeks', 'months'] as const;

// Common companion-animal medications — not exhaustive, and there's no
// public "pet drug database" API to pull this from, so this is a curated
// starting list with a brief, general note on what each is typically used
// for (educational, not a substitute for the prescribing vet's guidance).
// "Use <typed value>" always falls back to free text for anything not listed.
const COMMON_MEDICATIONS: { name: string; uses: string }[] = [
  { name: 'Amoxicillin', uses: 'Broad-spectrum antibiotic for a range of bacterial infections.' },
  { name: 'Amoxicillin/Clavulanate (Clavamox)', uses: 'Broad-spectrum antibiotic combo for infections resistant to plain amoxicillin.' },
  { name: 'Apoquel (Oclacitinib)', uses: 'Controls itching and inflammation from allergic skin disease.' },
  { name: 'Benazepril', uses: 'ACE inhibitor for heart failure and chronic kidney disease.' },
  { name: 'Bravecto', uses: 'Long-acting chewable that kills fleas and ticks for up to 12 weeks.' },
  { name: 'Carprofen (Rimadyl)', uses: 'NSAID for pain and inflammation, often arthritis or post-surgery.' },
  { name: 'Cephalexin', uses: 'Antibiotic for skin, wound, and urinary tract infections.' },
  { name: 'Clindamycin', uses: 'Antibiotic for dental infections, deep skin infections, and toxoplasmosis.' },
  { name: 'Clomipramine', uses: 'Treats separation anxiety and compulsive behaviors.' },
  { name: 'Cyclosporine (Atopica)', uses: 'Immune-modulating medication for chronic allergic skin disease.' },
  { name: 'Cytopoint', uses: 'Injectable antibody therapy that reduces allergic itching in dogs.' },
  { name: 'Deracoxib (Deramaxx)', uses: 'NSAID for pain and inflammation from arthritis or surgery.' },
  { name: 'Dexamethasone', uses: 'Corticosteroid that reduces inflammation and suppresses immune response.' },
  { name: 'Diphenhydramine (Benadryl)', uses: 'Antihistamine for mild allergic reactions and itching.' },
  { name: 'Doxycycline', uses: 'Antibiotic for respiratory infections, tick-borne disease, and some skin infections.' },
  { name: 'Enalapril', uses: 'ACE inhibitor for managing congestive heart failure.' },
  { name: 'Enrofloxacin (Baytril)', uses: 'Broad-spectrum antibiotic for serious bacterial infections.' },
  { name: 'Famotidine', uses: 'Reduces stomach acid; used for reflux, gastritis, and ulcers.' },
  { name: 'Firocoxib (Previcox)', uses: 'NSAID for pain and inflammation from osteoarthritis.' },
  { name: 'Fluoxetine (Reconcile)', uses: 'SSRI for separation anxiety and compulsive behaviors.' },
  { name: 'Frontline Plus', uses: 'Topical treatment that kills fleas and ticks.' },
  { name: 'Furosemide', uses: 'Diuretic that reduces fluid buildup from heart failure.' },
  { name: 'Gabapentin', uses: 'Nerve pain, seizure control, and calming for anxious or fractious pets.' },
  { name: 'Heartgard Plus', uses: 'Monthly chewable preventing heartworm and treating some intestinal parasites.' },
  { name: 'Insulin (Vetsulin)', uses: 'Manages blood sugar in pets with diabetes mellitus.' },
  { name: 'Levetiracetam (Keppra)', uses: 'Anti-seizure medication for epilepsy.' },
  { name: 'Levothyroxine', uses: 'Replaces thyroid hormone in pets with hypothyroidism.' },
  { name: 'Meloxicam (Metacam)', uses: 'NSAID for pain and inflammation from arthritis or surgery.' },
  { name: 'Metoclopramide', uses: 'Reduces nausea and vomiting; helps with GI motility.' },
  { name: 'Metronidazole', uses: 'Antibiotic/antiprotozoal for GI infections and some diarrhea cases.' },
  { name: 'Methimazole', uses: 'Reduces thyroid hormone production in cats with hyperthyroidism.' },
  { name: 'Mirtazapine', uses: 'Stimulates appetite and eases nausea, often used in cats.' },
  { name: 'NexGard', uses: 'Monthly chewable that kills fleas and ticks in dogs.' },
  { name: 'Omeprazole', uses: 'Reduces stomach acid; used for ulcers, reflux, and gastritis.' },
  { name: 'Otomax', uses: 'Topical ear medication for bacterial and yeast ear infections.' },
  { name: 'Phenobarbital', uses: 'Long-term anti-seizure medication for epilepsy.' },
  { name: 'Pimobendan (Vetmedin)', uses: 'Strengthens heart contractions; used for congestive heart failure.' },
  { name: 'Potassium Bromide', uses: 'Anti-seizure medication, often combined with other epilepsy drugs.' },
  { name: 'Prednisolone', uses: 'Corticosteroid for inflammation, allergies, and immune conditions (cat-preferred form).' },
  { name: 'Prednisone', uses: 'Corticosteroid for inflammation, allergies, and immune conditions.' },
  { name: 'Revolution', uses: 'Monthly topical preventing heartworm and treating fleas, ear mites, and some ticks.' },
  { name: 'Sentinel', uses: 'Monthly chewable preventing heartworm and controlling flea eggs.' },
  { name: 'Sildenafil', uses: 'Lowers blood pressure in the lungs (pulmonary hypertension).' },
  { name: 'Simparica Trio', uses: 'Monthly chewable covering heartworm, fleas, ticks, and intestinal parasites.' },
  { name: 'Spironolactone', uses: 'Diuretic often combined with other heart failure medications.' },
  { name: 'Sucralfate', uses: 'Coats and protects the GI lining; used for ulcers.' },
  { name: 'Sulfasalazine', uses: 'Anti-inflammatory used for inflammatory bowel disease.' },
  { name: 'Terramycin', uses: 'Topical/ophthalmic antibiotic for eye infections.' },
  { name: 'Tramadol', uses: 'Pain reliever for moderate pain, often after injury or surgery.' },
  { name: 'Trazodone', uses: 'Short-term anti-anxiety medication, often for vet visits or recovery confinement.' },
  { name: 'Trifexis', uses: 'Monthly chewable preventing heartworm, fleas, and treating intestinal parasites.' },
  { name: 'Zonisamide', uses: 'Anti-seizure medication for epilepsy.' },
].sort((a, b) => a.name.localeCompare(b.name));

type FrequencyPreset = {
  key: string;
  label: string;
  value: number | null;
  unit: (typeof DOSE_INTERVAL_UNITS)[number] | null;
};

const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { key: 'once-daily', label: 'Once daily', value: 24, unit: 'hours' },
  { key: 'twice-daily', label: 'Twice daily', value: 12, unit: 'hours' },
  { key: 'three-times-daily', label: 'Three times daily', value: 8, unit: 'hours' },
  { key: 'every-other-day', label: 'Every other day', value: 48, unit: 'hours' },
  { key: 'weekly', label: 'Weekly', value: 7, unit: 'days' },
  { key: 'biweekly', label: 'Every 2 weeks', value: 14, unit: 'days' },
  { key: 'monthly', label: 'Monthly', value: 1, unit: 'months' },
  { key: 'as-needed', label: 'As needed', value: null, unit: null },
  { key: 'custom', label: 'Custom schedule...', value: null, unit: null },
];
const DEFAULT_PRESET = FREQUENCY_PRESETS[1]!; // twice-daily

const medicationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dose: z.string().min(1, 'Dose is required (e.g. 5mg, 1 tablet)'),
  frequency: z.string().min(1, 'Frequency is required'),
  doseIntervalValue: z.number().int().min(1).optional().nullable(),
  doseIntervalUnit: z.enum(DOSE_INTERVAL_UNITS).optional().nullable(),
  nextDoseAt: z.string().optional().nullable(),
  active: z.boolean().default(true),
  instructions: z.string().optional(),
}).refine((data) => (data.doseIntervalValue == null) === (data.doseIntervalUnit == null), {
  message: 'Set both a number and a unit, or leave both blank.',
  path: ['doseIntervalUnit'],
});

type MedicationFormValues = z.infer<typeof medicationSchema>;

const EMPTY_MEDICATION: MedicationFormValues = {
  name: '',
  dose: '',
  frequency: DEFAULT_PRESET.label,
  doseIntervalValue: DEFAULT_PRESET.value,
  doseIntervalUnit: DEFAULT_PRESET.unit,
  nextDoseAt: '',
  active: true,
  instructions: '',
};

export default function Medications() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [frequencyPreset, setFrequencyPreset] = useState(DEFAULT_PRESET.key);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [detailMedication, setDetailMedication] = useState<Medication | null>(null);
  const [medicationPendingDelete, setMedicationPendingDelete] = useState<Medication | null>(null);
  const { toast } = useToast();

  const { data: pets } = useListPets();
  const activePet = pets?.find((p) => p.id === activePetId);

  const { data: medications, isLoading } = useListMedications(
    activePetId!,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getListMedicationsQueryKey(activePetId) : ['no-pet', 'medications']
      }
    }
  );

  const invalidateMedications = () => {
    if (activePetId) {
      queryClient.invalidateQueries({ queryKey: getListMedicationsQueryKey(activePetId) });
    }
  };

  const closeDialog = () => {
    setIsNewOpen(false);
    setFrequencyPreset(DEFAULT_PRESET.key);
    setNameSearch('');
    form.reset(EMPTY_MEDICATION);
  };

  const createMedication = useCreateMedication({
    mutation: {
      onSuccess: () => {
        invalidateMedications();
        closeDialog();
        toast({ title: "Medication added", description: "Medication has been saved successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save medication.", variant: "destructive" });
      }
    }
  });

  const updateMedication = useUpdateMedication({
    mutation: {
      onSuccess: invalidateMedications,
      onError: () => {
        toast({ title: "Error", description: "Failed to update medication.", variant: "destructive" });
      }
    }
  });

  const logDose = useLogMedicationDose({
    mutation: {
      onSuccess: () => {
        invalidateMedications();
        toast({ title: "Dose logged", description: "The next dose has been scheduled." });
      },
      onError: (error) => {
        toast({ title: "Couldn't log dose", description: error.message, variant: "destructive" });
      }
    }
  });

  const deleteMedication = useDeleteMedication({
    mutation: {
      onSuccess: (_data, variables) => {
        invalidateMedications();
        setMedicationPendingDelete(null);
        setDetailMedication((current) => (current?.id === variables.medicationId ? null : current));
        toast({ title: "Medication deleted" });
      },
      onError: (error) => {
        toast({ title: "Couldn't delete medication", description: error.message, variant: "destructive" });
      }
    }
  });

  const setMedicationActive = (med: Medication, active: boolean) => {
    updateMedication.mutate({
      petId: activePetId!,
      medicationId: med.id,
      data: {
        name: med.name,
        dose: med.dose,
        frequency: med.frequency,
        doseIntervalValue: med.doseIntervalValue,
        doseIntervalUnit: med.doseIntervalUnit,
        nextDoseAt: med.nextDoseAt,
        active,
        instructions: med.instructions,
      },
    });
  };

  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationSchema),
    defaultValues: EMPTY_MEDICATION,
  });

  const handlePresetChange = (key: string) => {
    setFrequencyPreset(key);
    const preset = FREQUENCY_PRESETS.find((p) => p.key === key);
    if (!preset || key === 'custom') {
      form.setValue('frequency', '');
      form.setValue('doseIntervalValue', null);
      form.setValue('doseIntervalUnit', null);
      return;
    }
    form.setValue('frequency', preset.label);
    form.setValue('doseIntervalValue', preset.value);
    form.setValue('doseIntervalUnit', preset.unit);
  };

  const syncCustomFrequencyLabel = (value: number | null | undefined, unit: string | null | undefined) => {
    form.setValue('frequency', value && unit ? `Every ${value} ${unit}` : '');
  };

  if (!activePetId) return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;

  const activeMeds = medications?.filter(m => m.active) || [];
  const pastMeds = medications?.filter(m => !m.active) || [];

  // Re-looked-up from the live list (not the snapshot captured on click) so
  // the dialog reflects a stop/resume/log-dose that happens while it's open.
  const detailMed = detailMedication
    ? medications?.find((m) => m.id === detailMedication.id) ?? detailMedication
    : null;

  // Same curated lookup the "Add a medicine" search uses — surfaces a plain-
  // English description when the medication matches one of our known names.
  const detailMedInfo = detailMed
    ? COMMON_MEDICATIONS.find((m) => m.name.toLowerCase() === detailMed.name.toLowerCase())
    : null;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto pb-16">
      <div className="flex items-end justify-between gap-6 mb-7">
        <div>
          <h1 className="font-serif text-[34px] font-extrabold tracking-tight">{activePet ? `${activePet.name}'s medicines` : 'Medicines'}</h1>
          <p className="mt-1 text-[16.5px] text-muted-foreground">
            {activeMeds.length > 0
              ? `${activeMeds.length} on the go. We'll work out the next dose each time you tick one off.`
              : 'Track prescriptions, preventatives, and supplements here.'}
          </p>
        </div>
        <button
          onClick={() => setIsNewOpen(true)}
          className="h-[46px] shrink-0 flex items-center gap-2 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors"
        >
          <Plus size={17} /> Add a medicine
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-card/50 border border-border rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : !medications || medications.length === 0 ? (
        <div className="text-center py-16 bg-card border-2 border-dashed border-border rounded-3xl">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-5 text-primary">
            <Pill size={28} />
          </div>
          <h3 className="font-serif text-xl font-extrabold mb-2">No medicines tracked yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Keep track of prescriptions, flea/tick preventatives, and supplements here.
          </p>
          <button
            onClick={() => setIsNewOpen(true)}
            className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
          >
            Add a medicine
          </button>
        </div>
      ) : (
        <div className="space-y-9">
          {activeMeds.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              {activeMeds.map((med) => (
                <div
                  key={med.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailMedication(med)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailMedication(med);
                    }
                  }}
                  className="relative flex flex-col text-left bg-card border border-border rounded-3xl p-5 cursor-pointer transition-colors hover:border-primary/40 hover:shadow-sm"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMedicationPendingDelete(med);
                    }}
                    aria-label={`Delete ${med.name}`}
                    className="absolute top-3.5 right-3.5 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="flex items-center gap-3 pr-9">
                    <div className="w-11 h-11 rounded-2xl bg-accent text-primary flex items-center justify-center shrink-0">
                      <Pill size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-serif text-[19px] font-extrabold leading-tight">{med.name}</div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                        <span>{med.dose} · {med.frequency}</span>
                        {med.nextDoseAt && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            <Clock size={11} /> {format(parseISO(med.nextDoseAt), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {med.instructions && (
                    <div className="mt-3 flex gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-3.5 py-2.5">
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-700" />
                      <span className="text-sm leading-relaxed text-amber-900">{med.instructions}</span>
                    </div>
                  )}

                  <div className="mt-auto pt-4 flex items-center gap-2">
                    {med.doseIntervalValue && med.doseIntervalUnit ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          logDose.mutate({ petId: activePetId, medicationId: med.id });
                        }}
                        disabled={logDose.isPending}
                        className="flex-1 h-10 flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {logDose.isPending ? <Loader2 size={16} className="animate-spin" /> : <Syringe size={16} />}
                        Given
                      </button>
                    ) : (
                      <span className="flex-1 text-xs text-muted-foreground italic">
                        Add a schedule to enable one-tap logging.
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMedicationActive(med, false);
                      }}
                      disabled={updateMedication.isPending}
                      className="h-10 px-3.5 flex items-center gap-1.5 rounded-full border border-border text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
                    >
                      <Ban size={15} /> Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pastMeds.length > 0 && (
            <div>
              <div className="font-serif text-xl font-extrabold mb-3">Stopped</div>
              <div className="bg-card border border-border rounded-3xl overflow-hidden">
                {pastMeds.map((med, i) => (
                  <div
                    key={med.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailMedication(med)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailMedication(med);
                      }
                    }}
                    className={cn(
                      'flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-accent/40',
                      i > 0 && 'border-t border-border',
                    )}
                  >
                    <div className="w-[42px] h-[42px] rounded-2xl bg-accent text-muted-foreground flex items-center justify-center shrink-0">
                      <Pill size={19} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[16.5px] font-bold">{med.name}</span>{' '}
                      <span className="text-[15px] text-muted-foreground">· {med.dose}, {med.frequency}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMedicationActive(med, true);
                      }}
                      disabled={updateMedication.isPending}
                      className="h-10 px-4 flex items-center gap-1.5 rounded-full bg-accent text-primary text-sm font-bold hover:bg-accent/70 transition-colors disabled:opacity-50 shrink-0"
                    >
                      <RotateCcw size={14} /> He's taking this again
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`More options for ${med.name}`}
                          className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent transition-colors shrink-0"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setMedicationPendingDelete(med)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 size={14} className="mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isNewOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-extrabold">Add a medicine</DialogTitle>
            <DialogDescription>Track a new prescription or preventative.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => {
              const submissionData = { ...data, nextDoseAt: data.nextDoseAt || null };
              createMedication.mutate({ petId: activePetId, data: submissionData });
            })} className="space-y-5 mt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Medication Name</FormLabel>
                    <Popover open={nameOpen} onOpenChange={setNameOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <button
                            type="button"
                            className={cn(
                              "flex items-center justify-between h-11 w-full rounded-2xl border border-input bg-accent/40 px-3.5 py-2 text-sm",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <span className="truncate">{field.value || 'Select or type a medication...'}</span>
                            <ChevronsUpDown size={16} className="opacity-50 shrink-0 ml-2" />
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                        <Command>
                          <CommandInput placeholder="Search medications..." value={nameSearch} onValueChange={setNameSearch} />
                          <CommandList>
                            <CommandEmpty>
                              <button
                                type="button"
                                onClick={() => { field.onChange(nameSearch); setNameOpen(false); }}
                                className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-sm"
                              >
                                Use "{nameSearch}"
                              </button>
                            </CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-y-auto">
                              {COMMON_MEDICATIONS.map((med) => (
                                <CommandItem
                                  key={med.name}
                                  value={med.name}
                                  onSelect={() => { field.onChange(med.name); setNameSearch(med.name); setNameOpen(false); }}
                                  className="flex items-start gap-2 py-2"
                                >
                                  <Check size={16} className={cn("mt-0.5 shrink-0", field.value === med.name ? "opacity-100" : "opacity-0")} />
                                  <div className="min-w-0">
                                    <div>{med.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{med.uses}</div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {(() => {
                      const info = COMMON_MEDICATIONS.find((m) => m.name === field.value);
                      return info ? (
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground bg-accent/40 rounded-xl px-3 py-2">
                          <Info size={14} className="shrink-0 mt-0.5" />
                          {info.uses}
                        </p>
                      ) : null;
                    })()}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dose</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1 chew, 5mg" className="h-11 rounded-2xl bg-accent/40" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Frequency</label>
                  <Select value={frequencyPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="h-11 rounded-2xl bg-accent/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_PRESETS.map((p) => (
                        <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {frequencyPreset === 'custom' && (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Set a custom interval to enable one-tap "mark dose given" with automatic rescheduling.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="doseIntervalValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Every</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="e.g. 36"
                              className="h-11 rounded-2xl bg-accent/40"
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const newValue = e.target.value === '' ? null : Number(e.target.value);
                                field.onChange(newValue);
                                syncCustomFrequencyLabel(newValue, form.getValues('doseIntervalUnit'));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="doseIntervalUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Unit</FormLabel>
                          <Select
                            onValueChange={(unit) => {
                              field.onChange(unit);
                              syncCustomFrequencyLabel(form.getValues('doseIntervalValue'), unit);
                            }}
                            value={field.value ?? undefined}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 rounded-2xl bg-accent/40">
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DOSE_INTERVAL_UNITS.map((unit) => (
                                <SelectItem key={unit} value={unit} className="capitalize">{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField control={form.control} name="frequency" render={() => <FormMessage />} />
                </div>
              )}

              <FormField
                control={form.control}
                name="nextDoseAt"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Next Dose Due (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="h-11 rounded-2xl bg-accent/40"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Give with food, watch for lethargy..."
                        className="resize-none rounded-2xl bg-accent/40"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-border p-4 bg-background">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Currently taking</FormLabel>
                      <DialogDescription>
                        Turn off for past medications.
                      </DialogDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-5 border-t border-border">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="h-11 px-5 font-bold text-muted-foreground hover:bg-accent rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMedication.isPending}
                  className="h-11 px-6 bg-primary text-primary-foreground font-bold rounded-full hover:bg-primary/90 transition-colors shadow-md shadow-primary/25 disabled:opacity-50"
                >
                  {createMedication.isPending ? 'Saving...' : 'Add Medicine'}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailMedication} onOpenChange={(open) => !open && setDetailMedication(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          {detailMed && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-accent text-primary flex items-center justify-center shrink-0">
                    <Pill size={22} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="font-serif text-2xl font-extrabold leading-tight">
                      {detailMed.name}
                    </DialogTitle>
                    <span
                      className={cn(
                        'inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full mt-1',
                        detailMed.active ? 'bg-emerald-100 text-emerald-700' : 'bg-accent text-muted-foreground',
                      )}
                    >
                      {detailMed.active ? 'Active' : 'Stopped'}
                    </span>
                  </div>
                </div>
                <DialogDescription className="sr-only">Medication details</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Dose</div>
                    <div className="text-[15px] font-medium mt-0.5">{detailMed.dose}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Frequency</div>
                    <div className="text-[15px] font-medium mt-0.5">{detailMed.frequency}</div>
                  </div>
                </div>

                {detailMedInfo && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground bg-accent/40 rounded-2xl px-4 py-3">
                    <Info size={15} className="shrink-0 mt-0.5" />
                    {detailMedInfo.uses}
                  </p>
                )}

                {detailMed.active && detailMed.nextDoseAt && (
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-700 bg-amber-100 px-4 py-2.5 rounded-2xl">
                    <Clock size={15} /> Next dose {format(parseISO(detailMed.nextDoseAt), 'MMM d, h:mm a')}
                  </div>
                )}

                {detailMed.instructions && (
                  <div className="flex gap-2.5 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-700" />
                    <span className="text-sm leading-relaxed text-amber-900">{detailMed.instructions}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-5 mt-2 border-t border-border">
                <button
                  onClick={() => setMedicationPendingDelete(detailMed)}
                  className="h-10 px-4 flex items-center gap-1.5 rounded-full text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={15} /> Delete
                </button>
                <div className="flex items-center gap-2">
                  {detailMed.active ? (
                    <button
                      onClick={() => setMedicationActive(detailMed, false)}
                      disabled={updateMedication.isPending}
                      className="h-10 px-4 flex items-center gap-1.5 rounded-full border border-border text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      <Ban size={14} /> Stop taking
                    </button>
                  ) : (
                    <button
                      onClick={() => setMedicationActive(detailMed, true)}
                      disabled={updateMedication.isPending}
                      className="h-10 px-4 flex items-center gap-1.5 rounded-full bg-accent text-primary text-sm font-bold hover:bg-accent/70 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={14} /> He's taking this again
                    </button>
                  )}
                  {detailMed.active && detailMed.doseIntervalValue && detailMed.doseIntervalUnit && (
                    <button
                      onClick={() => logDose.mutate({ petId: activePetId, medicationId: detailMed.id })}
                      disabled={logDose.isPending}
                      className="h-10 px-4 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {logDose.isPending ? <Loader2 size={14} className="animate-spin" /> : <Syringe size={14} />}
                      I've given this
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!medicationPendingDelete} onOpenChange={(open) => !open && setMedicationPendingDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {medicationPendingDelete?.name || 'this medication'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from {activePet?.name || "this pet"}'s medicine list. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleteMedication.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMedication.isPending}
              onClick={() => {
                if (medicationPendingDelete && activePetId) {
                  deleteMedication.mutate({ petId: activePetId, medicationId: medicationPendingDelete.id });
                }
              }}
            >
              {deleteMedication.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
