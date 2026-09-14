import { useState } from 'react';
import { usePetContext } from '@/context/pet-context';
import { OnboardingTutorial } from '@/components/onboarding-tutorial';
import { consumePendingTutorial } from '@/lib/onboarding-tutorial-flag';
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useCompleteReminder,
  useLogMedicationDose,
  useGetPetTrends,
  getGetPetTrendsQueryKey,
  useListDocumentImports,
  getListDocumentImportsQueryKey,
  useListAlerts,
  getListAlertsQueryKey,
  useDismissAlert,
  type Alert,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import {
  FileText,
  Sparkles,
  HeartPulse,
  ArrowRight,
  Syringe,
  Loader2,
  Upload,
  Plus,
  Bell,
  MessageCircle,
  Check,
  X,
  Phone,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isPast, isToday, differenceInYears, differenceInMonths } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;

type UpcomingItem =
  | { kind: 'reminder'; id: number; title: string; when: Date; category: string; suggested: boolean }
  | { kind: 'medication'; id: number; title: string; when: Date; dose: string; suggested: false };

function formatAge(birthDate: string) {
  const born = parseISO(birthDate);
  const years = differenceInYears(new Date(), born);
  const months = differenceInMonths(new Date(), born) % 12;
  if (years === 0) return `${months} mo`;
  return months > 0 ? `${years} yr ${months} mo` : `${years} yr`;
}

// Renders an alert's `reasoning` through a fixed template — each item's
// `value` is already plain-language text built by the rule engine itself
// (predictive-monitoring.ts), never model-generated. This component adds
// no interpretation of its own, just structure and styling.
function AlertBanner({
  alert,
  petName,
  vetPhone,
  onDismiss,
  dismissing,
}: {
  alert: Alert;
  petName: string;
  vetPhone: string | null;
  onDismiss: () => void;
  dismissing: boolean;
}) {
  const { toast } = useToast();
  const isRed = alert.severity === 'red';

  const summaryText = [
    `${petName} — ${isRed ? 'worth contacting your vet about' : "worth watching"}:`,
    ...alert.reasoning.map((r) => `- ${r.value}`),
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast({ title: 'Copied', description: 'Summary copied — paste it wherever you need it.' });
    } catch {
      toast({ title: "Couldn't copy", description: 'Your browser blocked clipboard access.', variant: 'destructive' });
    }
  };

  return (
    <div
      className={cn(
        'rounded-3xl p-5 border flex flex-col gap-3',
        isRed ? 'bg-destructive/5 border-destructive/25' : 'bg-amber-50 border-amber-200',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
            isRed ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700',
          )}
        >
          <AlertTriangle size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-lg font-extrabold">
            {isRed ? 'Contact your vet soon' : 'Worth watching'}
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-foreground/90">
            {alert.reasoning.map((r, i) => (
              <li key={i}>• {r.value}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissing}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {isRed && vetPhone && (
          <a
            href={`tel:${vetPhone}`}
            className="h-10 flex items-center gap-1.5 px-4 rounded-full bg-destructive text-destructive-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <Phone size={14} /> Call {petName}'s vet
          </a>
        )}
        {isRed && (
          <button
            type="button"
            onClick={handleCopy}
            className="h-10 flex items-center gap-1.5 px-4 rounded-full border border-border text-sm font-bold hover:bg-accent transition-colors"
          >
            <Copy size={14} /> Copy summary
          </button>
        )}
        <Link
          href={`/insights?ask=${encodeURIComponent(`Can you tell me more about this: ${summaryText}`)}`}
          className="h-10 flex items-center gap-1.5 px-4 rounded-full bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <MessageCircle size={14} /> Ask Pawlie about this
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [showTutorial, setShowTutorial] = useState(() => consumePendingTutorial());
  const tutorial = <OnboardingTutorial open={showTutorial} onOpenChange={setShowTutorial} />;

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

  const { data: importsData } = useListDocumentImports(activePetId!, {
    query: {
      enabled: !!activePetId,
      queryKey: activePetId ? getListDocumentImportsQueryKey(activePetId) : ['no-pet', 'document-imports'],
    },
  });
  const pendingImports = (importsData?.imports ?? []).filter((imp) => imp.status === 'pending_review');
  const pendingItemCount = pendingImports.reduce(
    (sum, imp) => sum + imp.items.filter((item) => item.status === 'pending').length,
    0,
  );

  const invalidateSummary = () => {
    if (activePetId) {
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ petId: activePetId }) });
    }
  };

  const completeReminder = useCompleteReminder({
    mutation: { onSuccess: invalidateSummary },
  });

  const logDose = useLogMedicationDose({
    mutation: { onSuccess: invalidateSummary },
  });

  const { data: alertsData } = useListAlerts(activePetId!, {
    query: {
      enabled: !!activePetId,
      queryKey: activePetId ? getListAlertsQueryKey(activePetId) : ['no-pet', 'alerts'],
    },
  });
  const activeAlert = (alertsData ?? []).find((a) => a.status === 'active') ?? null;

  const dismissAlert = useDismissAlert({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey(activePetId) });
        }
      },
    },
  });

  if (!activePetId) {
    return (
      <>
        {tutorial}
        <div className="min-h-[80vh] flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 rounded-full bg-accent text-primary flex items-center justify-center mx-auto mb-6">
              <HeartPulse size={44} strokeWidth={2} />
            </div>
            <h2 className="font-serif text-[32px] font-extrabold tracking-tight mb-3">Let's start with your pet</h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed mb-7">
              Add their name and a couple of details. You can bring in past vet reports whenever you like — or never.
            </p>
            <Link
              href="/profile?new=true"
              className="inline-flex items-center gap-2.5 h-[54px] px-7 rounded-full bg-primary text-primary-foreground text-[17px] font-extrabold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors"
            >
              Add your pet <ArrowRight size={19} />
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        {tutorial}
        <div className="p-8 max-w-6xl mx-auto animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded-lg w-1/3" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 h-96 bg-muted rounded-3xl" />
            <div className="h-96 bg-muted rounded-3xl" />
          </div>
        </div>
      </>
    );
  }

  if (error || !summary) {
    return (
      <>
        {tutorial}
        <div className="p-8 max-w-6xl mx-auto">
          <div className="text-destructive bg-destructive/10 rounded-2xl border border-destructive/20 text-center py-12">
            Failed to load dashboard. Please try again.
          </div>
        </div>
      </>
    );
  }

  const { pet } = summary;
  const now = Date.now();
  const isDueSoon = (when: Date) => when.getTime() - now <= DUE_SOON_WINDOW_MS;

  const upcomingItems: UpcomingItem[] = [
    ...summary.upcomingReminders.map(
      (r): UpcomingItem => ({
        kind: 'reminder',
        id: r.id,
        title: r.title,
        when: new Date(r.dueDate),
        category: r.category,
        suggested: r.source === 'system',
      }),
    ),
    ...summary.activeMedications
      .filter((m) => m.nextDoseAt)
      .map(
        (m): UpcomingItem => ({
          kind: 'medication',
          id: m.id,
          title: m.name,
          when: new Date(m.nextDoseAt!),
          dose: m.dose,
          suggested: false,
        }),
      ),
  ].sort((a, b) => a.when.getTime() - b.when.getTime());

  const overdue = upcomingItems.filter((i) => isPast(i.when) && !isToday(i.when));
  const dueToday = upcomingItems.filter((i) => isToday(i.when));
  const upcoming = upcomingItems.filter((i) => !isPast(i.when) && !isToday(i.when));

  const subtitle =
    overdue.length > 0
      ? `${overdue.length} thing${overdue.length > 1 ? 's' : ''} need${overdue.length > 1 ? '' : 's'} your attention.`
      : dueToday.length > 0
        ? `${dueToday.length} thing${dueToday.length > 1 ? 's' : ''} due today.`
        : upcoming.length > 0
          ? `All caught up until ${format(upcoming[0].when, 'MMM d')}.`
          : "All caught up — nothing on the horizon.";

  const lastVetVisit = summary.recentRecords.find((r) => r.type === 'visit');
  const nextAppointment = summary.upcomingReminders
    .filter((r) => r.category === 'appointment')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const weightLogs = trends?.weightLogs ?? [];
  const hasWeightTrend = weightLogs.length >= 2;
  const weightDelta = hasWeightTrend
    ? weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight
    : 0;
  const weightMin = hasWeightTrend ? Math.min(...weightLogs.map((w) => w.weight)) : 0;
  const weightMax = hasWeightTrend ? Math.max(...weightLogs.map((w) => w.weight)) : 0;

  const renderItemRow = (item: UpcomingItem, tone: 'overdue' | 'today' | 'upcoming') => {
    const dueSoon = isDueSoon(item.when);
    return (
      <div
        key={`${item.kind}-${item.id}`}
        className={cn(
          'flex items-center gap-4 p-4 rounded-2xl border',
          tone === 'overdue'
            ? 'bg-destructive/5 border-destructive/20'
            : tone === 'today'
              ? 'bg-accent/60 border-border'
              : 'bg-card border-border',
        )}
      >
        <div
          className={cn(
            'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
            tone === 'overdue' ? 'bg-destructive/10 text-destructive' : 'bg-accent text-primary',
          )}
        >
          {item.kind === 'medication' ? <Syringe size={20} /> : <Bell size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-lg font-extrabold truncate">{item.title}</div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap text-sm">
            {item.suggested && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                <Sparkles size={11} /> We suggested this
              </span>
            )}
            <span className="text-muted-foreground">
              {item.kind === 'reminder' ? item.category : item.dose} ·{' '}
              {format(item.when, item.kind === 'medication' ? 'MMM d, h:mm a' : 'MMM d, yyyy')}
            </span>
            {dueSoon && tone !== 'overdue' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">Due soon</span>
            )}
          </div>
        </div>
        {item.kind === 'reminder' ? (
          <button
            onClick={() => completeReminder.mutate({ reminderId: item.id })}
            disabled={completeReminder.isPending}
            className="h-11 px-5 rounded-full bg-foreground text-background text-sm font-bold flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Check size={15} /> Done
          </button>
        ) : (
          <button
            onClick={() => activePetId && logDose.mutate({ petId: activePetId, medicationId: item.id })}
            disabled={logDose.isPending}
            className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {logDose.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Given
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto pb-16">
      {tutorial}
      <div className="flex flex-wrap items-end justify-between gap-5 mb-7">
        <div>
          <div className="text-sm font-bold text-muted-foreground">{format(new Date(), 'EEEE, d MMMM')}</div>
          <h1 className="font-serif text-[34px] font-extrabold tracking-tight mt-1">How is {pet.name} doing?</h1>
          <p className="mt-1 text-[17px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex gap-2.5">
          <Link
            href="/smart-upload"
            className="h-[46px] flex items-center gap-2 px-5 rounded-full bg-card border border-border text-sm font-bold hover:bg-accent transition-colors"
          >
            <Upload size={17} /> Upload a vet report
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-[46px] flex items-center gap-2 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors">
                <Plus size={17} /> Add something
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link href="/records?new=true">Health record</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/medications?new=true">Medicine</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/reminders?new=true">Reminder</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {activeAlert && (
        <div className="mb-5">
          <AlertBanner
            alert={activeAlert}
            petName={pet.name}
            vetPhone={pet.vetPhone}
            onDismiss={() => dismissAlert.mutate({ petId: activePetId, alertId: activeAlert.id })}
            dismissing={dismissAlert.isPending}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <div className="flex flex-col gap-4">
          {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 ? (
            <div className="text-center py-14 border-2 border-dashed border-border rounded-2xl bg-card">
              <p className="text-muted-foreground">Nothing due right now.</p>
              <Link href="/reminders?new=true" className="text-primary font-bold hover:underline mt-2 inline-block">
                Add a reminder
              </Link>
            </div>
          ) : (
            <>
              {overdue.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-serif text-sm font-extrabold uppercase tracking-wide text-destructive">Late</span>
                    <span className="flex-1 h-px bg-destructive/20" />
                  </div>
                  {overdue.map((item) => renderItemRow(item, 'overdue'))}
                </div>
              )}
              {dueToday.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-serif text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Today</span>
                    <span className="flex-1 h-px bg-border" />
                  </div>
                  {dueToday.map((item) => renderItemRow(item, 'today'))}
                </div>
              )}
              {upcoming.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-serif text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Upcoming</span>
                    <span className="flex-1 h-px bg-border" />
                    <Link href="/reminders" className="text-sm font-bold text-primary shrink-0">All reminders</Link>
                  </div>
                  {upcoming.slice(0, 5).map((item) => renderItemRow(item, 'upcoming'))}
                </div>
              )}
            </>
          )}

          {pendingImports.length > 0 && (
            <div className="bg-card border border-border rounded-3xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
              <div className="flex-1">
                <div className="font-serif text-lg font-extrabold">
                  {pendingItemCount} thing{pendingItemCount === 1 ? '' : 's'} from {pendingImports.length === 1 ? 'a vet report are' : 'vet reports are'} waiting
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">Nothing goes in {pet.name}'s file until you say yes.</div>
              </div>
              <Link href="/smart-upload" className="h-11 px-5 rounded-full bg-foreground text-background text-sm font-bold flex items-center shrink-0">
                Check them over
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex items-center gap-3.5">
              {resolvePetAvatar(pet.photoUrl, pet.species) ? (
                <img src={resolvePetAvatar(pet.photoUrl, pet.species)!} alt={pet.name} className="w-[62px] h-[62px] rounded-full bg-accent shrink-0" />
              ) : (
                <div className="w-[62px] h-[62px] rounded-full bg-accent flex items-center justify-center font-serif text-2xl font-extrabold text-primary shrink-0">
                  {pet.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-serif text-2xl font-extrabold tracking-tight truncate">{pet.name}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {[pet.breed, pet.sex !== 'unknown' ? pet.sex : null, pet.birthDate ? formatAge(pet.birthDate) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col">
              {pet.weight != null && (
                <div className="flex items-baseline justify-between gap-3 py-2.5 border-t border-border">
                  <span className="text-sm text-muted-foreground">Weight</span>
                  <span className="text-[15px] font-bold">
                    {pet.weight} {pet.weightUnit}
                    {hasWeightTrend && weightDelta !== 0 && (
                      <span className={cn('ml-2 text-sm font-bold', weightDelta > 0 ? 'text-destructive' : 'text-primary')}>
                        {weightDelta > 0 ? '↑' : '↓'} {Math.abs(weightDelta).toFixed(1)}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {lastVetVisit && (
                <div className="flex items-baseline justify-between gap-3 py-2.5 border-t border-border">
                  <span className="text-sm text-muted-foreground">Last vet visit</span>
                  <span className="text-[15px] font-bold">{format(parseISO(lastVetVisit.date), 'MMM d')}</span>
                </div>
              )}
              {nextAppointment && (
                <div className="flex items-baseline justify-between gap-3 py-2.5 border-t border-border">
                  <span className="text-sm text-muted-foreground">Next appointment</span>
                  <span className="text-[15px] font-bold">{format(new Date(nextAppointment.dueDate), 'MMM d')}</span>
                </div>
              )}
              {summary.activeMedications.length > 0 && (
                <div className="flex items-baseline justify-between gap-3 py-2.5 border-t border-border">
                  <span className="text-sm text-muted-foreground">On medicine</span>
                  <span className="text-[15px] font-bold truncate max-w-[60%] text-right">
                    {summary.activeMedications.map((m) => m.name).join(', ')}
                  </span>
                </div>
              )}
            </div>

            {hasWeightTrend && (
              <>
                <div className="mt-3 flex items-end gap-2 h-16">
                  {weightLogs.slice(-4).map((log, i, arr) => (
                    <div
                      key={log.id}
                      className={cn('flex-1 rounded-t', i === arr.length - 1 ? 'bg-primary' : 'bg-accent')}
                      style={{
                        height: `${weightMax === weightMin ? 60 : 30 + ((log.weight - weightMin) / (weightMax - weightMin)) * 70}%`,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {weightDelta === 0
                    ? 'Weight has held steady.'
                    : `${weightDelta > 0 ? 'Up' : 'Down'} ${Math.abs(weightDelta).toFixed(1)} ${weightLogs[0].weightUnit} since ${format(new Date(weightLogs[0].recordedAt), 'MMM yyyy')}.`}
                </p>
              </>
            )}

            <Link
              href="/profile"
              className="mt-4 h-[42px] flex items-center justify-center rounded-full bg-accent text-primary text-sm font-extrabold hover:bg-accent/70 transition-colors"
            >
              {pet.name}'s details
            </Link>
          </div>

          {summary.recentRecords.length > 0 && (
            <div className="bg-card border border-border rounded-3xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-serif text-[17px] font-extrabold">Lately in {pet.name}'s file</span>
                <Link href="/records" className="text-sm font-bold text-primary">All {summary.stats.recordCount}</Link>
              </div>
              {summary.recentRecords.slice(0, 3).map((record) => (
                <div key={record.id} className="flex gap-3 py-2.5 border-t border-border">
                  <span className="w-14 shrink-0 text-sm font-bold text-muted-foreground">{format(parseISO(record.date), 'MMM d')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15.5px] font-bold truncate">{record.title}</div>
                    <div className="text-sm text-muted-foreground capitalize">{record.type}{record.clinic ? ` · ${record.clinic}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-accent/60 border border-border rounded-3xl p-5">
            <div className="font-serif text-[17px] font-extrabold">Noticed something?</div>
            <p className="mt-1.5 mb-3.5 text-sm leading-relaxed text-muted-foreground">
              {summary.recentInsights.length > 0
                ? `Last asked about: "${summary.recentInsights[0].title}"`
                : `Describe it and we'll explain what it might mean using ${pet.name}'s records. Information, not a diagnosis.`}
            </p>
            <Link
              href="/insights"
              className="h-11 flex items-center justify-center gap-2 rounded-full bg-foreground text-background text-sm font-bold"
            >
              <MessageCircle size={16} /> Ask about {pet.name}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
