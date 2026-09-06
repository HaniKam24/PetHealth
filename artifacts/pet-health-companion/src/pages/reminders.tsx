import { usePetContext } from '@/context/pet-context';
import { useListReminders, getListRemindersQueryKey, useCreateReminder, useCompleteReminder } from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Bell, CheckCircle2, Circle, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday, parseISO } from 'date-fns';

const reminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.enum(['appointment', 'vaccine', 'medication', 'wellness', 'other']),
  dueDate: z.string().min(1, 'Due date is required'),
  note: z.string().optional(),
});

type ReminderFormValues = z.infer<typeof reminderSchema>;

export default function Reminders() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const { toast } = useToast();

  const { data: reminders, isLoading } = useListReminders(
    activePetId!,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getListRemindersQueryKey(activePetId) : ['no-pet', 'reminders']
      }
    }
  );

  const createReminder = useCreateReminder({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey(activePetId) });
        }
        setIsNewOpen(false);
        form.reset();
        toast({ title: "Reminder added" });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create reminder.", variant: "destructive" });
      }
    }
  });

  const completeReminder = useCompleteReminder({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey(activePetId) });
        }
        toast({ title: "Task completed", description: "Great job keeping up with care!" });
      }
    }
  });

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      title: '',
      category: 'appointment',
      dueDate: new Date().toISOString().slice(0, 16), // YYYY-MM-DDThh:mm
      note: '',
    },
  });

  const filteredReminders = useMemo(() => {
    if (!reminders) return [];
    let sorted = [...reminders].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    if (filter === 'pending') sorted = sorted.filter(r => !r.completed);
    if (filter === 'completed') sorted = sorted.filter(r => r.completed);
    
    return sorted;
  }, [reminders, filter]);

  if (!activePetId) return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <PageHeader 
        title="Reminders" 
        description="Stay on top of appointments, vaccines, and daily care."
        action={
          <button 
            onClick={() => setIsNewOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus size={20} /> New Reminder
          </button>
        }
      />

      <div className="flex gap-2 mb-8 bg-card border border-border p-1.5 rounded-xl w-fit">
        {(['pending', 'completed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors",
              filter === f 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-card/50 border border-border rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="text-center py-20 bg-card border-2 border-dashed border-border rounded-3xl">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <Bell size={28} />
          </div>
          <h3 className="text-xl font-serif mb-2">No {filter !== 'all' ? filter : ''} reminders</h3>
          <p className="text-muted-foreground">
            You're all caught up! Add a new reminder for their next appointment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReminders.map(reminder => {
            const date = parseISO(reminder.dueDate);
            const pastDue = isPast(date) && !isToday(date) && !reminder.completed;
            const today = isToday(date) && !reminder.completed;

            return (
              <div key={reminder.id} className={cn(
                "group flex gap-4 p-5 rounded-2xl border transition-all duration-300", 
                reminder.completed ? "bg-accent/30 border-transparent opacity-70" : 
                pastDue ? "bg-destructive/5 border-destructive/30 shadow-sm" : 
                today ? "bg-primary/5 border-primary/30 shadow-sm" :
                "bg-card border-border hover:border-primary/30 shadow-sm"
              )}>
                <button 
                  onClick={() => !reminder.completed && completeReminder.mutate({ reminderId: reminder.id })}
                  disabled={reminder.completed || completeReminder.isPending}
                  className="flex-shrink-0 mt-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                >
                  {reminder.completed ? (
                    <CheckCircle2 size={32} className="text-primary/70" />
                  ) : (
                    <Circle size={32} className={cn(
                      "transition-colors hover:fill-primary/20",
                      pastDue ? "text-destructive" : today ? "text-primary" : "text-muted-foreground hover:text-primary"
                    )} />
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <h3 className={cn("text-xl font-medium", reminder.completed && "line-through text-muted-foreground")}>
                        {reminder.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider",
                          pastDue ? "bg-destructive/10 text-destructive" :
                          today ? "bg-primary/10 text-primary" :
                          "bg-accent text-muted-foreground"
                        )}>
                          {reminder.category}
                        </span>
                        
                        <span className={cn(
                          "flex items-center gap-1.5 text-sm font-medium",
                          pastDue ? "text-destructive" : today ? "text-primary" : "text-muted-foreground"
                        )}>
                          {pastDue ? <AlertTriangle size={14} /> : <Calendar size={14} />}
                          {format(date, 'MMM d, yyyy')}
                          <span className="opacity-50 mx-1">•</span>
                          <Clock size={14} />
                          {format(date, 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {reminder.note && (
                    <p className="mt-4 text-muted-foreground text-sm bg-background p-3 rounded-xl border border-border/50">
                      {reminder.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">New Reminder</DialogTitle>
            <DialogDescription>Schedule an upcoming care event.</DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => {
               // Ensure proper datetime string format handling if needed by API
               createReminder.mutate({ petId: activePetId, data });
            })} className="space-y-5 mt-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What needs to happen?</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Annual Checkup, Give Heartworm Pill" className="bg-accent/50 h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 gap-5">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-accent/50 h-12">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="appointment">Appointment</SelectItem>
                          <SelectItem value="vaccine">Vaccine</SelectItem>
                          <SelectItem value="medication">Medication</SelectItem>
                          <SelectItem value="wellness">Wellness/Grooming</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>When?</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" className="bg-accent/50 h-12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="e.g. Bring stool sample, fast for 12 hours..." 
                        className="resize-none bg-accent/50" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
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
                  disabled={createReminder.isPending}
                  className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {createReminder.isPending ? 'Saving...' : 'Add Reminder'}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
