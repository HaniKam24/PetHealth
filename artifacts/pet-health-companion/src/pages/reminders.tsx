import { usePetContext } from '@/context/pet-context';
import { useListReminders, getListRemindersQueryKey, useCreateReminder, useCompleteReminder } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Bell, CheckCircle2, Circle, Sparkles } from 'lucide-react';
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

  const sortedReminders = useMemo(() => {
    if (!reminders) return [];
    return [...reminders].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [reminders]);

  const pendingCount = sortedReminders.filter((r) => !r.completed).length;
  const completedCount = sortedReminders.filter((r) => r.completed).length;

  const filteredReminders = useMemo(() => {
    if (filter === 'pending') return sortedReminders.filter((r) => !r.completed);
    if (filter === 'completed') return sortedReminders.filter((r) => r.completed);
    return sortedReminders;
  }, [sortedReminders, filter]);

  if (!activePetId) return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'pending', label: `To do (${pendingCount})` },
    { key: 'completed', label: `Done (${completedCount})` },
    { key: 'all', label: 'Everything' },
  ];

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto pb-16">
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="font-serif text-[34px] font-extrabold tracking-tight">Reminders</h1>
          <p className="mt-1 text-[16.5px] text-muted-foreground">Appointments, jabs and everyday care. Tick things off as you go.</p>
        </div>
        <button
          onClick={() => setIsNewOpen(true)}
          className="h-[46px] shrink-0 flex items-center gap-2 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors"
        >
          <Plus size={17} /> New reminder
        </button>
      </div>

      <div className="flex gap-1.5 mb-6 bg-card border border-border p-1.5 rounded-full w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "h-9 px-4 text-sm font-bold rounded-full transition-colors",
              filter === f.key ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card/50 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="text-center py-16 bg-card border-2 border-dashed border-border rounded-3xl">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <Bell size={28} />
          </div>
          <h3 className="font-serif text-xl font-extrabold mb-2">No {filter !== 'all' ? filter : ''} reminders</h3>
          <p className="text-muted-foreground">You're all caught up! Add a new reminder for their next appointment.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredReminders.map((reminder) => {
            const date = parseISO(reminder.dueDate);
            const pastDue = isPast(date) && !isToday(date) && !reminder.completed;
            const today = isToday(date) && !reminder.completed;
            const suggested = reminder.source === 'system' && !reminder.completed;

            return (
              <div
                key={reminder.id}
                className={cn(
                  'flex gap-4 p-5 rounded-2xl border',
                  reminder.completed
                    ? 'bg-accent/40 border-transparent opacity-75'
                    : pastDue
                      ? 'bg-destructive/5 border-destructive/20'
                      : suggested
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-card border-border'
                )}
              >
                <button
                  onClick={() => !reminder.completed && completeReminder.mutate({ reminderId: reminder.id })}
                  disabled={reminder.completed || completeReminder.isPending}
                  className="shrink-0 mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                >
                  {reminder.completed ? (
                    <CheckCircle2 size={30} className="text-primary/70" />
                  ) : (
                    <Circle
                      size={30}
                      className={cn(
                        'fill-current transition-colors',
                        pastDue ? 'text-destructive' : suggested ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-primary'
                      )}
                    />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'font-serif text-[21px] font-extrabold',
                      reminder.completed && 'line-through text-muted-foreground'
                    )}
                  >
                    {reminder.title}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm">
                    {suggested && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                        <Sparkles size={11} /> We suggested this
                      </span>
                    )}
                    {!reminder.completed && (
                      <span className="px-2.5 py-0.5 rounded-full bg-background text-xs font-bold text-foreground">{reminder.category}</span>
                    )}
                    <span className={cn('font-semibold', reminder.completed ? 'text-muted-foreground' : pastDue ? 'text-destructive' : 'text-muted-foreground')}>
                      {reminder.completed ? `Done on ${format(date, 'MMM d')}` : `${format(date, 'MMM d')} · ${format(date, 'h:mm a')}`}
                      {pastDue && ' · late'}
                    </span>
                  </div>
                  {reminder.note && !reminder.completed && (
                    <p className="mt-2.5 text-sm text-muted-foreground bg-background rounded-xl px-3.5 py-2.5">{reminder.note}</p>
                  )}
                </div>

                {!reminder.completed && (
                  <button
                    onClick={() => completeReminder.mutate({ reminderId: reminder.id })}
                    disabled={completeReminder.isPending}
                    className="h-11 px-5 self-center shrink-0 rounded-full bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Done
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-extrabold">New reminder</DialogTitle>
            <DialogDescription>Schedule an upcoming care event.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => {
               // Ensure proper datetime string format handling if needed by API
               createReminder.mutate({ petId: activePetId, data });
            })} className="space-y-5 mt-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What needs to happen?</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Annual Checkup, Give Heartworm Pill" className="bg-accent/40 h-11 rounded-2xl" {...field} />
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
                          <SelectTrigger className="bg-accent/40 h-11 rounded-2xl">
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
                        <Input type="datetime-local" className="bg-accent/40 h-11 rounded-2xl" {...field} />
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
                        className="resize-none bg-accent/40 rounded-2xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-5 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewOpen(false)}
                  className="h-11 px-5 font-bold text-muted-foreground hover:bg-accent rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReminder.isPending}
                  className="h-11 px-6 bg-primary text-primary-foreground font-bold rounded-full hover:bg-primary/90 transition-colors shadow-md shadow-primary/25 disabled:opacity-50"
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
