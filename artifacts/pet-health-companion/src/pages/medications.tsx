import { usePetContext } from '@/context/pet-context';
import {
  useListMedications,
  getListMedicationsQueryKey,
  useCreateMedication,
  useUpdateMedication,
  useLogMedicationDose,
  type Medication,
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pill, Clock, AlertCircle, Syringe, Ban, RotateCcw, Loader2, ChevronsUpDown, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
  const { toast } = useToast();

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

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <PageHeader
        title="Medications"
        description="Track active prescriptions, doses, and schedules."
        action={
          <button
            onClick={() => setIsNewOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus size={20} /> Add Medication
          </button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-64 bg-card/50 border border-border rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : !medications || medications.length === 0 ? (
        <div className="text-center py-20 bg-card border-2 border-dashed border-border rounded-3xl max-w-3xl mx-auto">
          <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <Pill size={32} />
          </div>
          <h3 className="text-2xl font-serif mb-3">No medications tracked</h3>
          <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
            Keep track of prescriptions, flea/tick preventatives, and supplements here.
          </p>
          <button
            onClick={() => setIsNewOpen(true)}
            className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all"
          >
            Add a medication
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {activeMeds.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl mb-6 text-foreground">Active Prescriptions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeMeds.map(med => (
                  <div key={med.id} className="bg-card border-t-[6px] border-t-primary border-x border-b border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500 pointer-events-none"></div>

                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                        <Pill size={24} />
                      </div>
                      {med.nextDoseAt && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                          <Clock size={14} />
                          Next: {format(parseISO(med.nextDoseAt), 'MMM d, h:mm a')}
                        </div>
                      )}
                    </div>

                    <h3 className="text-2xl font-medium text-foreground mb-1 leading-tight">{med.name}</h3>

                    <div className="mt-6 space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-xl">
                        <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border/50 text-muted-foreground">
                           <span className="font-bold text-lg leading-none">D</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dose</p>
                          <p className="font-medium">{med.dose}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-xl">
                        <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border/50 text-muted-foreground">
                           <Clock size={20} />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Frequency</p>
                          <p className="font-medium">{med.frequency}</p>
                        </div>
                      </div>
                    </div>

                    {med.instructions && (
                      <div className="mt-6 pt-5 border-t border-border/60">
                        <p className="text-sm text-muted-foreground flex gap-2">
                          <AlertCircle size={16} className="shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{med.instructions}</span>
                        </p>
                      </div>
                    )}

                    <div className="mt-6 pt-5 border-t border-border/60 flex gap-2">
                      {med.doseIntervalValue && med.doseIntervalUnit ? (
                        <button
                          onClick={() => logDose.mutate({ petId: activePetId, medicationId: med.id })}
                          disabled={logDose.isPending}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {logDose.isPending ? <Loader2 size={16} className="animate-spin" /> : <Syringe size={16} />}
                          Mark dose given
                        </button>
                      ) : (
                        <span className="flex-1 text-xs text-muted-foreground italic self-center">
                          Add a structured schedule to enable auto-rescheduling.
                        </span>
                      )}
                      <button
                        onClick={() => setMedicationActive(med, false)}
                        disabled={updateMedication.isPending}
                        title="Stop this medication"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground font-medium text-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
                      >
                        <Ban size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastMeds.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl mb-6 text-muted-foreground">Past Medications</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastMeds.map(med => (
                  <div key={med.id} className="bg-background border border-border rounded-3xl p-6 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 bg-muted text-muted-foreground rounded-xl shrink-0">
                          <Pill size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-medium text-foreground truncate">{med.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">{med.dose} • {med.frequency}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setMedicationActive(med, true)}
                        disabled={updateMedication.isPending}
                        title="My pet is taking this again"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
                      >
                        <RotateCcw size={14} /> Resume
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isNewOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Add Medication</DialogTitle>
            <DialogDescription>Track a new prescription or preventative.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => {
              const submissionData = { ...data, nextDoseAt: data.nextDoseAt || null };
              createMedication.mutate({ petId: activePetId, data: submissionData });
            })} className="space-y-5 mt-4">
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
                              "flex items-center justify-between h-10 w-full rounded-md border border-input bg-accent/50 px-3 py-2 text-sm",
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
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground bg-accent/40 rounded-lg px-3 py-2">
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
                        <Input placeholder="e.g. 1 chew, 5mg" className="bg-accent/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Frequency</label>
                  <Select value={frequencyPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="bg-accent/50">
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
                              className="bg-accent/50"
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
                              <SelectTrigger className="bg-accent/50">
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
                        className="bg-accent/50"
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
                        className="resize-none bg-accent/50"
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
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border p-4 bg-background">
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

              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-5 py-2.5 font-medium text-foreground hover:bg-accent rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMedication.isPending}
                  className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {createMedication.isPending ? 'Saving...' : 'Add Medication'}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
