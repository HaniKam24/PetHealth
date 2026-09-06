import { usePetContext } from '@/context/pet-context';
import { useListHealthRecords, getListHealthRecordsQueryKey, useCreateHealthRecord } from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, FileText, Calendar as CalendarIcon, Syringe, Stethoscope, TestTube, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const recordSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['visit', 'vaccine', 'lab', 'procedure', 'note']),
  date: z.string().min(1, 'Date is required'),
  clinic: z.string().optional(),
  summary: z.string().optional(),
});

type RecordFormValues = z.infer<typeof recordSchema>;

const iconMap = {
  visit: Stethoscope,
  vaccine: Syringe,
  lab: TestTube,
  procedure: Activity,
  note: FileText,
};

export default function Records() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const { toast } = useToast();

  const { data: records, isLoading } = useListHealthRecords(
    activePetId!,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getListHealthRecordsQueryKey(activePetId) : ['no-pet', 'records']
      }
    }
  );

  const createRecord = useCreateHealthRecord({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListHealthRecordsQueryKey(activePetId) });
        }
        setIsNewOpen(false);
        form.reset();
        toast({ title: "Record added", description: "Health record has been saved successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save record.", variant: "destructive" });
      }
    }
  });

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      title: '',
      type: 'visit',
      date: new Date().toISOString().split('T')[0],
      clinic: '',
      summary: '',
    },
  });

  if (!activePetId) {
    return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;
  }

  const filteredRecords = records?.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.summary?.toLowerCase().includes(search.toLowerCase()) ||
    r.clinic?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <PageHeader 
        title="Health Records" 
        description="A complete history of care, visits, and notes."
        action={
          <button 
            onClick={() => setIsNewOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus size={20} /> Add Record
          </button>
        }
      />

      <div className="mb-8 relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
          <Search size={20} />
        </div>
        <input 
          type="search"
          placeholder="Search records by title, clinic, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm text-foreground transition-all"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-card/50 border border-border rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-20 bg-card border-2 border-dashed border-border rounded-3xl">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <FileText size={28} />
          </div>
          <h3 className="text-xl font-serif mb-2">No records found</h3>
          <p className="text-muted-foreground">
            {search ? "No records match your search." : "Start building a health history for your pet."}
          </p>
          {!search && (
            <button 
              onClick={() => setIsNewOpen(true)}
              className="mt-6 text-primary font-medium hover:underline"
            >
              Add their first record
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[2.25rem] md:before:ml-[2.75rem] before:-translate-x-px md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/80 before:to-transparent">
          {filteredRecords.map(record => {
            const Icon = iconMap[record.type] || FileText;
            return (
              <div key={record.id} className="relative flex items-start gap-6 group">
                <div className="absolute left-[2.25rem] md:left-[2.75rem] top-8 -ml-2 w-4 h-4 rounded-full bg-background border-2 border-primary z-10 group-hover:scale-125 transition-transform duration-300 shadow-sm" />
                
                <div className="w-16 md:w-20 pt-7 text-right shrink-0 relative z-10">
                  <span className="text-sm font-medium text-muted-foreground block">{format(new Date(record.date), 'MMM d')}</span>
                  <span className="text-xs text-muted-foreground opacity-70 block">{format(new Date(record.date), 'yyyy')}</span>
                </div>
                
                <div className="flex-1 bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md transition-all group-hover:border-primary/30">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div className="flex gap-4">
                      <div className="mt-1 w-12 h-12 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0">
                        <Icon size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium text-foreground mb-1 group-hover:text-primary transition-colors">{record.title}</h3>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span className="capitalize font-medium text-foreground/80 bg-accent px-2 py-0.5 rounded-md">{record.type}</span>
                          {record.clinic && (
                            <span className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-border inline-block"></span>
                              {record.clinic}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {record.summary && (
                    <p className="text-muted-foreground mt-4 leading-relaxed bg-background p-4 rounded-2xl border border-border/50">
                      {record.summary}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Add Health Record</DialogTitle>
            <DialogDescription>Log a new visit, vaccine, or observation.</DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createRecord.mutate({ petId: activePetId, data }))} className="space-y-6 mt-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Annual Checkup, Rabies Vaccine..." className="h-12 bg-accent/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Record Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 bg-accent/50">
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="visit">Vet Visit</SelectItem>
                          <SelectItem value="vaccine">Vaccine</SelectItem>
                          <SelectItem value="lab">Lab Results</SelectItem>
                          <SelectItem value="procedure">Procedure</SelectItem>
                          <SelectItem value="note">Observation Note</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-12 bg-accent/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="clinic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinic / Vet (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Main Street Animal Hospital" className="h-12 bg-accent/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes / Summary (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any details about the visit, recommendations, or how they're feeling..." 
                        className="min-h-[120px] resize-none bg-accent/50" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsNewOpen(false)}
                  className="px-6 py-3 font-medium text-foreground hover:bg-accent rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createRecord.isPending}
                  className="px-8 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {createRecord.isPending ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
