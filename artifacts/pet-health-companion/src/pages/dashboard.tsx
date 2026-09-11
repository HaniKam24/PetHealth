import { usePetContext } from '@/context/pet-context';
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useCompleteReminder,
  useLogMedicationDose,
  useGetPetTrends,
  getGetPetTrendsQueryKey,
  useListDocumentImports,
  getListDocumentImportsQueryKey,
  useListPets,
  type Pet,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import {
  Plus,
  UploadCloud,
  Check,
  Loader2,
  Syringe,
  Stethoscope,
  Pill,
  HeartPulse,
  Sparkles,
  ClipboardList,
  MessageCircle,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { format, parseISO, addDays } from 'date-fns';
import { resolvePetAvatar } from '@/lib/pet-avatar';

const CATEGORY_ICON: Record<string, typeof Stethoscope> = {
  appointment: Stethoscope,
  vaccine: Syringe,
  medication: Pill,
  wellness: HeartPulse,
  other: ClipboardList,
};

type Bucket = 'late' | 'today' | 'tomorrow' | 'later';

type UpcomingItem =
  | { kind: 'reminder'; id: number; title: string; subtitle: string; bucket: Bucket; suggested: boolean; icon: typeof Stethoscope }
  | { kind: 'medication'; id: number; title: string; subtitle: string; bucket: Bucket; suggested: false; icon: typeof Pill };

function bucketReminder(dueDate: string, todayStr: string, tomorrowStr: string): Bucket {
  if (dueDate < todayStr) return 'late';
  if (dueDate === todayStr) return 'today';
  if (dueDate === tomorrowStr) return 'tomorrow';
  return 'later';
}

function bucketMedication(nextDoseAt: string, now: Date, todayStr: string, tomorrowStr: string): Bucket {
  if (new Date(nextDoseAt).getTime() < now.getTime()) return 'late';
  const doseDateStr = format(new Date(nextDoseAt), 'yyyy-MM-dd');
  if (doseDateStr === todayStr) return 'today';
  if (doseDateStr === tomorrowStr) return 'tomorrow';
  return 'later';
}

export default function Dashboard() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const { data: pets } = useListPets();

  const { data: summary, isLoading, error } = useGetDashboardSummary(
    activePetId ? { petId: activePetId } : undefined,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getGetDashboardSummaryQueryKey({ petId: activePetId }) : ['no-pet'],
      },
    },
  );

  const { data: trends } = useGetPetTrends(activePetId!, {
    query: {
      enabled: !!activePetId,
      queryKey: activePetId ? getGetPetTrendsQueryKey(activePetId) : ['no-pet', 'trends'],
    },
  });

  const { data: imports } = useListDocumentImports(activePetId!, {
    query: {
      enabled: !!activePetId,
      queryKey: activePetId ? getListDocumentImportsQueryKey(activePetId) : ['no-pet', 'document-imports'],
    },
  });
  const pendingImportItems = (imports?.imports ?? []).flatMap((imp) => imp.items.filter((item) => item.status === 'pending'));

  const invalidateSummary = () => {
    if (activePetId) {
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ petId: activePetId }) });
    }
  };
  const completeReminder = useCompleteReminder({ mutation: { onSuccess: invalidateSummary } });
  const logDose = useLogMedicationDose({ mutation: { onSuccess: invalidateSummary } });

  const otherPet = (pets ?? []).find((pet) => pet.id !== activePetId);

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
    return (
      <div className="p-8 animate-pulse flex space-x-4">
        <div className="flex-1 space-y-6 py-1">
          <div className="h-10 bg-muted rounded-lg w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-muted rounded-2xl"></div>
            <div className="h-64 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return <div className="p-8 text-destructive bg-destructive/10 rounded-xl m-8 border border-destructive/20 text-center py-12">Failed to load dashboard. Please try again.</div>;
  }

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

  const items: UpcomingItem[] = [
    ...summary.upcomingReminders.map((r): UpcomingItem => ({
      kind: 'reminder',
      id: r.id,
      title: r.title,
      subtitle: `Due ${format(parseISO(r.dueDate), 'EEEE, MMM d')}${r.note ? ` · ${r.note}` : ''}`,
      bucket: bucketReminder(r.dueDate, todayStr, tomorrowStr),
      suggested: r.source === 'system',
      icon: CATEGORY_ICON[r.category] ?? ClipboardList,
    })),
    ...summary.activeMedications
      .filter((m) => m.nextDoseAt)
      .map((m): UpcomingItem => ({
        kind: 'medication',
        id: m.id,
        title: `${m.name}, ${m.dose}`,
        subtitle: `${format(new Date(m.nextDoseAt!), 'h:mm a, MMM d')} · ${m.frequency}`,
        bucket: bucketMedication(m.nextDoseAt!, now, todayStr, tomorrowStr),
        suggested: false,
        icon: Pill,
      })),
  ];

  const late = items.filter((i) => i.bucket === 'late');
  const today = items.filter((i) => i.bucket === 'today');
  const tomorrow = items.filter((i) => i.bucket === 'tomorrow');
  const later = items.filter((i) => i.bucket === 'later').sort((a, b) => a.subtitle.localeCompare(b.subtitle));

  const actionableCount = late.length + today.length;
  const nextClearDate = tomorrow.length > 0 ? 'tomorrow' : later.length > 0 ? 'soon' : null;
  const headline =
    actionableCount === 0
      ? `${summary.pet.name} is all caught up`
      : `${summary.pet.name} needs you ${actionableCount === 1 ? 'once' : `${actionableCount} times`} today`;
  const subheadline =
    actionableCount === 0
      ? nextClearDate
        ? `Nothing due until ${nextClearDate}.`
        : "Nothing on the horizon — they're all clear."
      : `${late.length > 0 ? `${late.length} thing${late.length > 1 ? 's are' : ' is'} overdue. ` : ''}${nextClearDate ? `After that, clear until ${nextClearDate}.` : 'That covers everything for now.'}`;

  const lastVisit = summary.recentRecords.find((r) => r.type === 'visit');
  const nextAppointment = summary.upcomingReminders.find((r) => r.category === 'appointment');

  const weightBars = (trends?.weightLogs ?? []).slice(-4);
  const maxWeight = Math.max(...weightBars.map((w) => Number(w.weight)), 1);

  return (
    <div className="px-6 md:px-10 py-9 pb-16 max-w-[1180px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="flex items-end justify-between gap-8 flex-wrap mb-6">
        <div>
          <div className="text-sm font-bold text-muted-foreground">{format(now, 'EEEE, d MMMM')}</div>
          <h1 className="font-serif text-3xl md:text-4xl font-extrabold tracking-tight mt-2 text-foreground">{headline}</h1>
          <p className="mt-2 text-base text-muted-foreground max-w-xl">{subheadline}</p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <Link
            href="/smart-upload"
            className="h-[46px] flex items-center gap-2 px-[18px] rounded-full bg-card border border-border text-sm font-bold hover:border-primary/30 transition-colors"
          >
            <UploadCloud size={17} /> Upload a vet report
          </Link>
          <Link
            href="/records?new=true"
            className="h-[46px] flex items-center gap-2 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm shadow-primary/30 hover:bg-primary/90 transition-colors"
          >
            <Plus size={17} /> Add something
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <TriageSection
            label="Late"
            tone="late"
            items={late}
            onComplete={(id) => completeReminder.mutate({ reminderId: id })}
            onLogDose={(id) => activePetId && logDose.mutate({ petId: activePetId, medicationId: id })}
            pending={completeReminder.isPending || logDose.isPending}
          />
          <TriageSection
            label="Today"
            tone="today"
            items={today}
            onComplete={(id) => completeReminder.mutate({ reminderId: id })}
            onLogDose={(id) => activePetId && logDose.mutate({ petId: activePetId, medicationId: id })}
            pending={completeReminder.isPending || logDose.isPending}
          />
          <TriageSection
            label="Tomorrow"
            tone="tomorrow"
            items={tomorrow}
            onComplete={(id) => completeReminder.mutate({ reminderId: id })}
            onLogDose={(id) => activePetId && logDose.mutate({ petId: activePetId, medicationId: id })}
            pending={completeReminder.isPending || logDose.isPending}
          />

          {late.length === 0 && today.length === 0 && tomorrow.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-2xl bg-card/50">
              <p className="text-muted-foreground">Nothing due in the next couple of days.</p>
            </div>
          )}

          {otherPet && (
            <OtherPetNudge pet={otherPet} />
          )}

          {pendingImportItems.length > 0 && (
            <div className="bg-card border border-border rounded-[20px] p-5 flex items-center gap-[18px]">
              <div className="w-[52px] h-[52px] rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <FileText size={24} />
              </div>
              <div className="flex-1">
                <div className="font-serif text-lg font-extrabold">
                  {pendingImportItems.length} thing{pendingImportItems.length > 1 ? 's' : ''} from a vet report {pendingImportItems.length > 1 ? 'are' : 'is'} waiting
                </div>
                <div className="mt-1 text-sm text-muted-foreground">Nothing goes in the file until you say yes.</div>
              </div>
              <Link href="/smart-upload" className="h-11 flex items-center px-5 rounded-full bg-foreground text-background text-sm font-bold shrink-0">
                Check them over
              </Link>
            </div>
          )}

          {later.length > 0 && (
            <div className="bg-card border border-border rounded-[20px] px-5 pt-2 pb-4">
              <div className="h-[52px] flex items-center justify-between">
                <span className="font-serif text-[17px] font-extrabold">Coming up</span>
                <Link href="/reminders" className="text-sm font-bold text-primary">All reminders</Link>
              </div>
              {later.slice(0, 4).map((item) => (
                <div key={`${item.kind}-${item.id}`} className="flex items-center gap-4 py-3 border-t border-border/60">
                  <span className="flex-1 text-[15px]">{item.title} <span className="text-muted-foreground">· {item.subtitle}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-[20px] p-6">
            <div className="flex items-center gap-3.5 gap-[14px]">
              {resolvePetAvatar(null, summary.pet.species) && (
                <img src={resolvePetAvatar(null, summary.pet.species)!} alt={summary.pet.name} className="w-[62px] h-[62px] rounded-full bg-muted shrink-0" />
              )}
              <div>
                <div className="font-serif text-2xl font-extrabold tracking-tight">{summary.pet.name}</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {summary.pet.breed ?? summary.pet.species} · {summary.pet.sex}
                </div>
              </div>
            </div>
            <div className="mt-[18px] flex flex-col">
              <StatRow label="Weight" value={summary.pet.weight != null ? `${summary.pet.weight} ${summary.pet.weightUnit}` : '—'} />
              <StatRow label="Last seen by a vet" value={lastVisit ? format(parseISO(lastVisit.date), 'MMM d') : 'No visits yet'} />
              <StatRow label="Next appointment" value={nextAppointment ? format(parseISO(nextAppointment.dueDate), 'MMM d') : 'None scheduled'} />
              <StatRow label="On medicine" value={summary.activeMedications.length > 0 ? summary.activeMedications.map((m) => m.name).join(', ') : 'None'} last />
            </div>
            {weightBars.length >= 2 && (
              <>
                <div className="mt-3.5 mt-[14px] flex items-end gap-2.5 h-16">
                  {weightBars.map((log, i) => (
                    <div
                      key={log.id}
                      className={cn('flex-1 rounded-t-md', i === weightBars.length - 1 ? 'bg-primary' : 'bg-muted')}
                      style={{ height: `${Math.max(20, (Number(log.weight) / maxWeight) * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[12.5px] text-muted-foreground">
                  <span>{format(new Date(weightBars[0].recordedAt), 'MMM yyyy')}</span>
                  <span className="font-extrabold text-primary">{format(new Date(weightBars[weightBars.length - 1].recordedAt), 'MMM yyyy')}</span>
                </div>
              </>
            )}
            <Link
              href="/profile"
              className="mt-4 h-[42px] flex items-center justify-center rounded-full bg-muted border border-border text-primary text-sm font-extrabold hover:bg-accent transition-colors"
            >
              {summary.pet.name}'s details
            </Link>
          </div>

          <div className="bg-card border border-border rounded-[20px] px-5 pt-2 pb-4">
            <div className="h-[52px] flex items-center justify-between">
              <span className="font-serif text-[17px] font-extrabold">Lately in the file</span>
              <Link href="/records" className="text-sm font-bold text-primary">All records</Link>
            </div>
            {summary.recentRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No records added yet.</p>
            ) : (
              summary.recentRecords.slice(0, 3).map((record) => (
                <div key={record.id} className="flex gap-3 py-3 border-t border-border/60">
                  <span className="w-14 shrink-0 text-sm font-bold text-muted-foreground">{format(parseISO(record.date), 'MMM d')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15.5px] font-bold truncate">{record.title}</div>
                    {record.clinic && <div className="text-sm text-muted-foreground truncate">{record.clinic}</div>}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-muted border border-border rounded-[20px] p-5">
            <div className="font-serif text-[17px] font-extrabold">Noticed something?</div>
            <p className="mt-1.5 mb-[14px] text-sm leading-relaxed text-muted-foreground">
              Describe it and we'll explain what it might mean using {summary.pet.name}'s records. Information, not a diagnosis.
            </p>
            <Link
              href="/insights"
              className="h-11 flex items-center justify-center gap-2 rounded-full bg-foreground text-background text-sm font-bold"
            >
              <MessageCircle size={16} /> Ask about {summary.pet.name}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2.5 border-t border-border/60', last && 'pb-0')}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-[15px] font-bold text-right">{value}</span>
    </div>
  );
}

const TONE_STYLES: Record<'late' | 'today' | 'tomorrow', { label: string; wrap: string; icon: string }> = {
  late: { label: 'Late', wrap: 'bg-destructive/10 border-destructive/20', icon: 'bg-destructive/15 text-destructive' },
  today: { label: 'Today', wrap: 'bg-card border-border', icon: 'bg-primary/10 text-primary' },
  tomorrow: { label: 'Tomorrow', wrap: 'bg-amber-50 border-amber-200', icon: 'bg-amber-100 text-amber-800' },
};

function TriageSection({
  label,
  tone,
  items,
  onComplete,
  onLogDose,
  pending,
}: {
  label: string;
  tone: 'late' | 'today' | 'tomorrow';
  items: UpcomingItem[];
  onComplete: (id: number) => void;
  onLogDose: (id: number) => void;
  pending: boolean;
}) {
  if (items.length === 0) return null;
  const style = TONE_STYLES[tone];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <span className={cn('font-serif text-[13.5px] font-extrabold uppercase tracking-wider', tone === 'late' ? 'text-destructive' : 'text-muted-foreground')}>
          {label}
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>
      {items.map((item) => (
        <div key={`${item.kind}-${item.id}`} className={cn('flex items-center gap-4 px-5 py-4 rounded-[18px] border', style.wrap)}>
          <div className={cn('w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0', style.icon)}>
            <item.icon size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-lg font-extrabold">{item.title}</span>
              {item.suggested && (
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  <Sparkles size={11} /> We worked this out
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</div>
          </div>
          {item.kind === 'reminder' ? (
            <button
              type="button"
              onClick={() => onComplete(item.id)}
              disabled={pending}
              className="h-11 flex items-center gap-2 px-5 rounded-full bg-foreground text-background text-sm font-bold shrink-0 disabled:opacity-50"
            >
              <Check size={15} /> Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onLogDose(item.id)}
              disabled={pending}
              className="h-11 flex items-center gap-2 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0 disabled:opacity-50 shadow-sm shadow-primary/25"
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Given
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function OtherPetNudge({ pet }: { pet: Pet }) {
  const { setActivePetId } = usePetContext();
  const { data: summary } = useGetDashboardSummary(
    { petId: pet.id },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ petId: pet.id }) } },
  );

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const lateReminder = summary?.upcomingReminders.find((r) => r.dueDate < todayStr);

  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-[18px] bg-card border border-border">
      {resolvePetAvatar(null, pet.species) && (
        <img src={resolvePetAvatar(null, pet.species)!} alt={pet.name} className="w-11 h-11 rounded-full bg-muted shrink-0" />
      )}
      <div className="flex-1 text-[15px]">
        {lateReminder ? (
          <>
            <span className="font-bold">{pet.name} has something late too</span>{' '}
            <span className="text-muted-foreground">· {lateReminder.title}, due {format(parseISO(lateReminder.dueDate), 'MMM d')}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{pet.name} is all caught up</span>
        )}
      </div>
      <button type="button" onClick={() => setActivePetId(pet.id)} className="text-sm font-bold text-primary shrink-0">
        Switch to them
      </button>
    </div>
  );
}
