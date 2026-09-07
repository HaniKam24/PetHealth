import { usePetContext } from '@/context/pet-context';
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey, useCompleteReminder, useLogMedicationDose } from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { Link } from 'wouter';
import { Calendar, Pill, FileText, Sparkles, Circle, HeartPulse, ArrowRight, Syringe, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;

type UpcomingItem =
  | { kind: 'reminder'; id: number; title: string; when: Date; category: string; suggested: boolean }
  | { kind: 'medication'; id: number; title: string; when: Date; dose: string; suggested: false };

export default function Dashboard() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();

  const { data: summary, isLoading, error } = useGetDashboardSummary(
    activePetId ? { petId: activePetId } : undefined,
    {
      query: {
      enabled: !!activePetId,
      queryKey: activePetId ? getGetDashboardSummaryQueryKey({ petId: activePetId }) : ['no-pet']
      }
    }
  );

  const invalidateSummary = () => {
    if (activePetId) {
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ petId: activePetId }) });
    }
  };

  const completeReminder = useCompleteReminder({
    mutation: { onSuccess: invalidateSummary }
  });

  const logDose = useLogMedicationDose({
    mutation: { onSuccess: invalidateSummary }
  });

  if (!activePetId) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md animate-in fade-in zoom-in-95 duration-700 ease-out">
          <div className="w-24 h-24 bg-card shadow-sm border border-border rounded-full flex items-center justify-center mx-auto mb-8 text-primary relative">
             <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20"></div>
             <HeartPulse size={40} strokeWidth={2} />
          </div>
          <h2 className="text-3xl font-serif mb-4 text-foreground">Welcome to Health Hub</h2>
          <p className="text-muted-foreground mb-10 text-lg">Your peaceful space for tracking your pet's wellness, medications, and care routines.</p>
          <Link href="/profile?new=true" className="inline-flex items-center gap-2 justify-center rounded-xl bg-primary text-primary-foreground px-8 py-4 text-lg font-medium hover:bg-primary/90 hover:scale-105 transition-all shadow-xl shadow-primary/20">
            Add Your Pet <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 animate-pulse flex space-x-4">
       <div className="flex-1 space-y-6 py-1">
         <div className="h-10 bg-muted rounded-lg w-1/3"></div>
         <div className="h-4 bg-muted rounded w-1/4 mb-8"></div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 h-64 bg-muted rounded-2xl"></div>
           <div className="h-64 bg-muted rounded-2xl"></div>
         </div>
       </div>
    </div>;
  }

  if (error || !summary) {
    return <div className="p-8 text-destructive bg-destructive/10 rounded-xl m-8 border border-destructive/20 text-center py-12">Failed to load dashboard. Please try again.</div>;
  }

  const now = Date.now();
  const isDueSoon = (when: Date) => when.getTime() - now <= DUE_SOON_WINDOW_MS;

  const upcomingItems: UpcomingItem[] = [
    ...summary.upcomingReminders.map((r): UpcomingItem => ({
      kind: 'reminder', id: r.id, title: r.title, when: new Date(r.dueDate), category: r.category, suggested: r.source === 'system',
    })),
    ...summary.activeMedications
      .filter((m) => m.nextDoseAt)
      .map((m): UpcomingItem => ({
        kind: 'medication', id: m.id, title: m.name, when: new Date(m.nextDoseAt!), dose: m.dose, suggested: false,
      })),
  ].sort((a, b) => a.when.getTime() - b.when.getTime());

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <PageHeader 
        title={`How is ${summary.pet.name} doing?`} 
        description="Here's a gentle overview of their upcoming care and recent health context."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Reminders Card */}
        <div className="col-span-1 lg:col-span-2 bg-card border border-border rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-serif text-2xl flex items-center gap-3 text-foreground">
              <div className="p-2 bg-accent rounded-xl text-primary"><Calendar size={22} /></div>
              Upcoming Care
            </h3>
            <Link href="/reminders" className="text-sm font-medium text-primary hover:bg-primary/10 px-4 py-2 rounded-full transition-colors">View All</Link>
          </div>
          
          {upcomingItems.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl bg-background/50">
              <p className="text-muted-foreground">No upcoming reminders.</p>
              <Link href="/reminders?new=true" className="text-primary font-medium hover:underline mt-2 inline-block">Add a reminder</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingItems.map(item => {
                const dueSoon = isDueSoon(item.when);
                return (
                  <div key={`${item.kind}-${item.id}`} className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300",
                    dueSoon ? "bg-amber-50 border-amber-200" : "bg-background border-border hover:border-primary/30 shadow-sm"
                  )}>
                    {item.kind === 'reminder' ? (
                      <button
                        onClick={() => completeReminder.mutate({ reminderId: item.id })}
                        disabled={completeReminder.isPending}
                        className="flex-shrink-0 text-primary hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                      >
                        <Circle size={28} className="text-muted-foreground hover:text-primary transition-colors" />
                      </button>
                    ) : (
                      <button
                        onClick={() => activePetId && logDose.mutate({ petId: activePetId, medicationId: item.id })}
                        disabled={logDose.isPending}
                        title="Mark dose given"
                        className="flex-shrink-0 text-primary hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full disabled:opacity-50"
                      >
                        {logDose.isPending ? <Loader2 size={28} className="animate-spin" /> : <Syringe size={28} />}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-lg">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        {item.suggested && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-medium text-xs tracking-wide">
                            <Sparkles size={12} /> Suggested
                          </span>
                        )}
                        <span className="capitalize px-2.5 py-0.5 rounded-md bg-accent text-accent-foreground font-medium text-xs tracking-wide">
                          {item.kind === 'reminder' ? item.category : item.dose}
                        </span>
                        <span>{format(item.when, item.kind === 'medication' ? 'MMM d, h:mm a' : 'MMM d, yyyy')}</span>
                        {dueSoon && (
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-white font-medium text-xs tracking-wide">Due soon</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats & Quick Actions */}
        <div className="space-y-6 flex flex-col">
          <div className="bg-primary text-primary-foreground rounded-3xl p-8 shadow-md flex-1 flex flex-col justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            
            <div>
              <h3 className="font-serif text-xl flex items-center gap-2 mb-6">
                 <Sparkles size={20} className="text-primary-foreground/80" />
                 Health Snapshot
              </h3>
              <div className="space-y-5">
                <div className="flex justify-between items-end border-b border-primary-foreground/20 pb-3">
                   <span className="text-primary-foreground/80 text-sm font-medium">Active Meds</span>
                   <span className="font-serif text-3xl leading-none">{summary.stats.activeMedicationCount}</span>
                </div>
                <div className="flex justify-between items-end border-b border-primary-foreground/20 pb-3">
                   <span className="text-primary-foreground/80 text-sm font-medium">Total Records</span>
                   <span className="font-serif text-3xl leading-none">{summary.stats.recordCount}</span>
                </div>
                <div className="flex justify-between items-end">
                   <span className="text-primary-foreground/80 text-sm font-medium">Pending Reminders</span>
                   <span className="font-serif text-3xl leading-none">{summary.stats.upcomingReminderCount}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <Link href="/records?new=true" className="group flex flex-col items-center justify-center p-5 rounded-3xl bg-card border border-border hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all duration-300 text-center gap-3 shadow-sm hover:shadow-md">
               <div className="p-3 rounded-full bg-accent group-hover:bg-primary-foreground/20 transition-colors">
                 <FileText size={22} className="text-primary group-hover:text-primary-foreground" />
               </div>
               <span className="text-sm font-medium">Add Record</span>
             </Link>
             <Link href="/medications?new=true" className="group flex flex-col items-center justify-center p-5 rounded-3xl bg-card border border-border hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all duration-300 text-center gap-3 shadow-sm hover:shadow-md">
               <div className="p-3 rounded-full bg-accent group-hover:bg-primary-foreground/20 transition-colors">
                 <Pill size={22} className="text-primary group-hover:text-primary-foreground" />
               </div>
               <span className="text-sm font-medium">Add Meds</span>
             </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
         {/* Recent Insights */}
         <div className="bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <h3 className="font-serif text-xl flex items-center gap-3">
                <div className="p-2 bg-accent rounded-xl text-primary"><Sparkles size={20} /></div>
                Recent Insights
              </h3>
              <Link href="/insights" className="text-sm font-medium text-primary hover:bg-primary/10 px-4 py-2 rounded-full transition-colors">Ask AI</Link>
           </div>
           {summary.recentInsights.length === 0 ? (
             <div className="flex-1 flex items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-2xl bg-background/50">
               <p className="text-muted-foreground text-sm">Ask a question to generate personalized AI insights.</p>
             </div>
           ) : (
             <div className="space-y-4">
               {summary.recentInsights.slice(0, 2).map(insight => (
                 <div key={insight.id} className="p-5 rounded-2xl bg-accent/40 border border-border/50">
                   <div className="flex items-center gap-2 mb-2">
                     <span className={cn(
                       "w-2 h-2 rounded-full",
                       insight.tone === 'urgent' ? "bg-destructive" : insight.tone === 'watch' ? "bg-amber-500" : "bg-emerald-500"
                     )}></span>
                     <h4 className="font-medium text-foreground">{insight.title}</h4>
                   </div>
                   <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{insight.content}</p>
                 </div>
               ))}
             </div>
           )}
         </div>

         {/* Recent Records */}
         <div className="bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <h3 className="font-serif text-xl flex items-center gap-3">
                <div className="p-2 bg-accent rounded-xl text-primary"><FileText size={20} /></div>
                Recent Records
              </h3>
              <Link href="/records" className="text-sm font-medium text-primary hover:bg-primary/10 px-4 py-2 rounded-full transition-colors">View All</Link>
           </div>
           {summary.recentRecords.length === 0 ? (
             <div className="flex-1 flex items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-2xl bg-background/50">
               <p className="text-muted-foreground text-sm">No recent health records added.</p>
             </div>
           ) : (
             <div className="space-y-5">
               {summary.recentRecords.slice(0, 3).map((record, i) => (
                 <div key={record.id} className={cn("flex justify-between items-start", i !== summary.recentRecords.slice(0, 3).length - 1 && "border-b border-border/60 pb-5")}>
                   <div className="pr-4">
                     <p className="font-medium text-foreground mb-1">{record.title}</p>
                     <p className="text-sm text-muted-foreground flex items-center gap-2">
                       <span>{format(new Date(record.date), 'MMM d, yyyy')}</span>
                       <span className="w-1 h-1 bg-border rounded-full"></span>
                       <span className="capitalize">{record.type}</span>
                     </p>
                   </div>
                   {record.clinic && (
                     <span className="text-xs font-medium bg-background border border-border text-muted-foreground px-3 py-1 rounded-full whitespace-nowrap">
                       {record.clinic}
                     </span>
                   )}
                 </div>
               ))}
             </div>
           )}
         </div>
      </div>
    </div>
  );
}
