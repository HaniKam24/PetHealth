import { usePetContext } from '@/context/pet-context';
import {
  useListInsights,
  getListInsightsQueryKey,
  useAskInsight,
  useListSymptomLogs,
  getListSymptomLogsQueryKey,
  useCreateSymptomLog,
  useGetPetTrends,
  getGetPetTrendsQueryKey,
  useListPets,
  type Insight,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, PawPrint, ShieldAlert, Heart, Activity, ClipboardPlus, CheckCircle2, TrendingUp, Scale, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const toneConfig = {
  helpful: { icon: Heart, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  watch: { icon: Activity, color: 'text-amber-700', bg: 'bg-amber-100' },
  urgent: { icon: ShieldAlert, color: 'text-destructive', bg: 'bg-destructive/10' },
};

const toneLabel = {
  helpful: 'Helpful to know',
  watch: 'Worth keeping an eye on',
  urgent: 'Needs attention',
};

// Renders **bold** spans as real React nodes instead of injecting HTML, so AI-generated
// content can never carry an XSS payload through to the DOM.
function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    const match = part.match(/^\*\*(.*)\*\*$/);
    return match ? <strong key={i}>{match[1]}</strong> : part;
  });
}

// Renders a `\n\n`-delimited block as a heading when its first line starts with
// #/##/###, otherwise as a paragraph — same "React nodes only" rule as
// renderFormattedText. Only the first line is checked (not matched end-to-end)
// since a heading block often has further lines, e.g. a list, underneath it.
function renderBlock(block: string, key: number) {
  const newlineIndex = block.indexOf('\n');
  const firstLine = newlineIndex === -1 ? block : block.slice(0, newlineIndex);
  const heading = firstLine.match(/^(#{1,3})\s+(.*)$/);
  if (!heading) {
    return <p key={key}>{renderFormattedText(block)}</p>;
  }

  const headingContent = renderFormattedText(heading[2]);
  const headingNode =
    heading[1].length === 1 ? <h1>{headingContent}</h1> :
    heading[1].length === 2 ? <h2>{headingContent}</h2> :
    <h3>{headingContent}</h3>;
  const rest = newlineIndex === -1 ? '' : block.slice(newlineIndex + 1).trim();
  return (
    <div key={key}>
      {headingNode}
      {rest && <p>{renderFormattedText(rest)}</p>}
    </div>
  );
}

const weightChartConfig: ChartConfig = {
  weight: { label: 'Weight', color: 'hsl(var(--primary))' },
};

export default function Insights() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [tab, setTab] = useState<'chat' | 'trends'>('chat');
  const { toast } = useToast();

  const { data: pets } = useListPets();
  const activePet = pets?.find((p) => p.id === activePetId);

  const { data: trends, isLoading: trendsLoading } = useGetPetTrends(activePetId!, {
    query: {
      enabled: !!activePetId && tab === 'trends',
      queryKey: activePetId ? getGetPetTrendsQueryKey(activePetId) : ['no-pet', 'trends'],
    },
  });

  const { data, isLoading } = useListInsights(
    activePetId ? { petId: activePetId } : undefined,
    { query: { enabled: !!activePetId, queryKey: activePetId ? getListInsightsQueryKey({ petId: activePetId }) : ['no-pet', 'insights'] } }
  );
  // The API returns newest-first (so a "recent activity" list elsewhere
  // could use it as-is) — a chat thread reads top-to-bottom oldest-first,
  // so flip it for display here rather than changing the API's own order.
  const insights = data?.insights ? [...data.insights].reverse() : data?.insights;
  const quota = data?.quota;
  const quotaExhausted = quota !== undefined && quota.remaining <= 0;

  const askInsight = useAskInsight({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey({ petId: activePetId }) });
        }
        setQuestion('');
        // No success toast — the answer lands directly in the chat thread
        // (now auto-scrolled into view), so announcing it separately was
        // redundant. Still toast on error below, since a failure isn't
        // otherwise visible in the thread.
      },
      onError: (error) => {
        toast({ title: "Couldn't get AI insight", description: error.message, variant: "destructive" });
      }
    }
  });

  const { data: symptomLogs } = useListSymptomLogs(
    activePetId!,
    { query: { enabled: !!activePetId, queryKey: activePetId ? getListSymptomLogsQueryKey(activePetId) : ['no-pet', 'symptom-logs'] } }
  );
  const loggedInsightIds = new Set(
    (symptomLogs ?? []).map((log) => log.insightId).filter((id): id is number => id !== null)
  );

  const addToSymptomLog = useCreateSymptomLog({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListSymptomLogsQueryKey(activePetId) });
        }
        toast({ title: "Added to symptom log", description: "You'll find it in Health Records." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to add to symptom log.", variant: "destructive" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !activePetId || askInsight.isPending || quotaExhausted) return;
    askInsight.mutate({ data: { petId: activePetId, question } });
  };

  const handleAddToSymptomLog = (insight: Insight) => {
    if (!activePetId) return;
    addToSymptomLog.mutate({ petId: activePetId, data: { description: insight.question, insightId: insight.id } });
  };

  // Keeps the latest message in view — without this, a new answer (or the
  // "typing" indicator while one's pending) landed at the bottom of the
  // scrollable list but the viewport itself didn't follow it there, so it
  // could render off-screen above the fold instead of where the thread
  // visually continues.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [insights, askInsight.isPending, tab]);

  if (!activePetId) return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto flex flex-col h-full min-h-[calc(100vh-2rem)]">
      <div className="shrink-0 mb-6">
        <h1 className="font-serif text-[34px] font-extrabold tracking-tight">Pawlie</h1>
        <p className="mt-1 text-[16.5px] text-muted-foreground">
          Ask anything about {activePet?.name ?? 'your pet'} — symptoms, routines, or just how they're doing. Grounded in their actual file, not generic advice.
        </p>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="inline-flex bg-card border border-border rounded-full p-1">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className={cn(
                'flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-bold transition-colors',
                tab === 'chat' ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Sparkles size={14} /> Chat
            </button>
            <button
              type="button"
              onClick={() => setTab('trends')}
              className={cn(
                'flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-bold transition-colors',
                tab === 'trends' ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TrendingUp size={14} /> Trends
            </button>
          </div>
          {tab === 'chat' && quota && (
            <div className="bg-card border border-border rounded-full px-4 h-9 inline-flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">This month</span>
              <span className={cn("text-sm font-bold", quotaExhausted && "text-destructive")}>
                {quota.remaining} of {quota.limit} left
              </span>
            </div>
          )}
        </div>
      </div>

      {tab === 'trends' ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5">
          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><Scale size={17} /></div>
              <h3 className="font-serif text-lg font-extrabold">Weight trend</h3>
            </div>
            {trendsLoading ? (
              <div className="h-64 bg-accent/30 rounded-2xl animate-pulse" />
            ) : !trends || trends.weightLogs.length < 2 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Not enough weight history yet — this fills in automatically as you update this pet's weight on their profile.
              </p>
            ) : (
              <ChartContainer config={weightChartConfig} className="h-64 w-full">
                <LineChart data={trends.weightLogs.map((log) => ({ ...log, dateLabel: format(new Date(log.recordedAt), 'MMM d') }))}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    unit={trends.weightLogs[trends.weightLogs.length - 1]?.weightUnit}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            )}
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><Pill size={17} /></div>
              <h3 className="font-serif text-lg font-extrabold">Medication adherence</h3>
              <span className="text-xs text-muted-foreground">(last 30 days)</span>
            </div>
            {trendsLoading ? (
              <div className="h-24 bg-accent/30 rounded-2xl animate-pulse" />
            ) : !trends || trends.medicationAdherence.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No active medications with a structured schedule to track adherence for yet.
              </p>
            ) : (
              <div className="space-y-4">
                {trends.medicationAdherence.map((med) => (
                  <div key={med.medicationId}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-sm font-bold">{med.medicationName}</span>
                      <span className="text-sm text-muted-foreground">
                        {med.adherencePercent}% <span className="text-xs">({med.dosesLogged}/{med.dosesExpected} doses)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-accent rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', med.adherencePercent >= 80 ? 'bg-emerald-500' : med.adherencePercent >= 50 ? 'bg-amber-500' : 'bg-destructive')}
                        style={{ width: `${med.adherencePercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 mb-4 flex gap-2.5 items-start bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
            <ShieldAlert size={19} className="shrink-0 mt-0.5 text-amber-700" />
            <p className="text-sm leading-relaxed text-amber-900">
              <strong>Pawlie isn't a vet.</strong> This is general information, plus context from {activePet?.name ?? 'your pet'}'s records. If they're in distress, ring an emergency vet now — don't wait for an answer here.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 py-1">
            {isLoading ? (
              <div className="space-y-8">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="w-2/3 h-16 bg-accent rounded-3xl ml-auto mb-4" />
                    <div className="w-5/6 h-32 bg-accent rounded-3xl mr-auto" />
                  </div>
                ))}
              </div>
            ) : !insights || insights.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-10">
                <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mb-6 text-primary">
                  <PawPrint size={40} />
                </div>
                <h3 className="font-serif text-2xl font-extrabold mb-2.5">Hi, I'm Pawlie.</h3>
                <p className="text-muted-foreground">Ask me about symptoms, routines, or what's already in {activePet?.name ?? 'their'} file — I'll answer using their actual records, not generic advice.</p>
                <div className="mt-7 flex flex-wrap justify-center gap-2.5">
                  <button onClick={() => setQuestion("What's their current medication schedule?")} className="h-9 px-4 text-sm font-semibold bg-card border border-border rounded-full hover:border-primary transition-colors">Current med schedule?</button>
                  <button onClick={() => setQuestion("What are the signs of arthritis?")} className="h-9 px-4 text-sm font-semibold bg-card border border-border rounded-full hover:border-primary transition-colors">Signs of arthritis?</button>
                  <button onClick={() => setQuestion("Should I worry about bad breath?")} className="h-9 px-4 text-sm font-semibold bg-card border border-border rounded-full hover:border-primary transition-colors">Bad breath causes?</button>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {insights.map((insight) => {
                  const ToneIcon = toneConfig[insight.tone].icon;
                  return (
                    <div key={insight.id} className="space-y-4">
                      {insight.question.trim().length > 0 && (
                        <div className="flex justify-end">
                          <div className="bg-foreground text-background px-5 py-4 rounded-3xl rounded-br-md max-w-[78%]">
                            <p className="text-[16.5px] leading-relaxed">{insight.question}</p>
                            <span className="block mt-1.5 text-xs opacity-60">{format(new Date(insight.createdAt), 'h:mm a · MMM d')}</span>
                          </div>
                        </div>
                      )}

                      <div className="bg-card border border-border rounded-3xl rounded-bl-md p-6">
                        <div className="flex items-center gap-3 mb-3.5">
                          <div className={cn('w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0', toneConfig[insight.tone].bg, toneConfig[insight.tone].color)}>
                            <ToneIcon size={19} />
                          </div>
                          <div>
                            <div className="font-serif text-[17px] font-extrabold">{toneLabel[insight.tone]}</div>
                            {insight.kind === 'escalation' && (
                              <div className="text-xs font-bold text-destructive">Escalated — contact your vet</div>
                            )}
                          </div>
                        </div>
                        <div className="prose prose-sm md:prose-base prose-p:leading-relaxed prose-p:text-foreground/90 prose-headings:font-serif prose-strong:text-foreground max-w-none">
                          {insight.content.split('\n\n').map((block, i) => renderBlock(block, i))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center gap-3">
                          <span className="text-sm text-muted-foreground">Written by AI · not medical advice</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {loggedInsightIds.has(insight.id) ? (
                              <span className="flex items-center gap-1.5 text-sm text-primary font-bold">
                                <CheckCircle2 size={14} /> Logged
                              </span>
                            ) : insight.question.trim().length > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleAddToSymptomLog(insight)}
                                disabled={addToSymptomLog.isPending}
                                className="h-9 px-3.5 flex items-center gap-1.5 rounded-full border border-border text-sm font-bold hover:bg-accent disabled:opacity-50 transition-colors"
                              >
                                <ClipboardPlus size={14} /> Save this to their file
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {askInsight.isPending && (
                  <>
                    <div className="flex justify-end">
                      <div className="bg-foreground/70 text-background px-5 py-4 rounded-3xl rounded-br-md">
                        <p className="text-[16.5px]">{question}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-card border border-border rounded-3xl rounded-bl-md px-5 py-4 w-fit">
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 mt-4 bg-card border border-border rounded-3xl p-5">
            {quotaExhausted ? (
              <div className="text-center text-sm text-muted-foreground py-2">
                You've used all {quota!.limit} AI questions for this month. Your allowance resets next month.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-end gap-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask Pawlie anything…"
                  className="flex-1 bg-accent/40 border border-border rounded-2xl px-4 py-3 min-h-[56px] max-h-[160px] resize-none focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-[15.5px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!question.trim() || askInsight.isPending}
                  className="h-[46px] px-5 shrink-0 flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Send size={16} /> Ask
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
