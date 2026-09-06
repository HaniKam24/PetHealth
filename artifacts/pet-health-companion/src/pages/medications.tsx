import { usePetContext } from '@/context/pet-context';
import { useListMedications, getListMedicationsQueryKey, useCreateMedication } from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pill, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

const medicationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dose: z.string().min(1, 'Dose is required (e.g. 5mg, 1 tablet)'),
  frequency: z.string().min(1, 'Frequency is required (e.g. Twice daily)'),
  nextDoseAt: z.string().optional().nullable(),
  active: z.boolean().default(true),
  instructions: z.string().optional(),
});

type MedicationFormValues = z.infer<typeof medicationSchema>;

export default function Medications() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [isNewOpen, setIsNewOpen] = useState(false);
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

  const createMedication = useCreateMedication({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListMedicationsQueryKey(activePetId) });
        }
        setIsNewOpen(false);
        form.reset();
        toast({ title: "Medication added", description: "Medication has been saved successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save medication.", variant: "destructive" });
      }
    }
  });

  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      name: '',
      dose: '',
      frequency: '',
      nextDoseAt: '',
      active: true,
      instructions: '',
    },
  });

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
                  <div key={med.id} className="bg-background border border-border rounded-3xl p-6 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-2 bg-muted text-muted-foreground rounded-xl">
                        <Pill size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-foreground">{med.name}</h3>
                        <p className="text-sm text-muted-foreground">{med.dose} • {med.frequency}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Add Medication</DialogTitle>
            <DialogDescription>Track a new prescription or preventative.</DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => {
              // Convert empty nextDoseAt to null or leave undefined
              const submissionData = { ...data, nextDoseAt: data.nextDoseAt || null };
              createMedication.mutate({ petId: activePetId, data: submissionData });
            })} className="space-y-5 mt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medication Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Heartgard, Amoxicillin" className="bg-accent/50" {...field} />
                    </FormControl>
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
                
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Monthly, Twice daily" className="bg-accent/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  onClick={() => setIsNewOpen(false)}
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
