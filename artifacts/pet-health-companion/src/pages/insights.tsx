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
  type Insight,
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Sparkles, Send, Bot, ShieldAlert, Heart, Activity, ClipboardPlus, CheckCircle2, TrendingUp, Scale, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const toneConfig = {
  helpful: { icon: Heart, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  watch: { icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  urgent: { icon: ShieldAlert, color: 'text-destructive', bg: 'bg-destructive/10' },
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
  const insights = data?.insights;
  const quota = data?.quota;
  const quotaExhausted = quota !== undefined && quota.remaining <= 0;

  const askInsight = useAskInsight({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey({ petId: activePetId }) });
        }
        setQuestion('');
        toast({ title: "Insight generated", description: "Scroll down to see the AI response." });
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

  if (!activePetId) return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto flex flex-col h-full min-h-[calc(100vh-2rem)]">
      <div className="shrink-0 mb-8">
        <PageHeader
          title="AI Health Assistant"
          description="Ask questions about symptoms, diet, or behavior. Always consult your vet for real medical advice."
        />
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="inline-flex bg-accent/40 border border-border rounded-xl p-1">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tab === 'chat' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Sparkles size={14} /> Chat
            </button>
            <button
              type="button"
              onClick={() => setTab('trends')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tab === 'trends' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TrendingUp size={14} /> Trends
            </button>
          </div>
          {tab === 'chat' && quota && (
            <div className="bg-card border border-border rounded-2xl px-4 py-2 inline-flex items-baseline gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">AI questions this month</span>
              <span className={cn("text-sm font-serif", quotaExhausted && "text-destructive")}>
                {quota.remaining} of {quota.limit} left
              </span>
            </div>
          )}
        </div>
      </div>

      {tab === 'trends' ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
          <div className="bg-card border border-border rounded-3xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Scale size={18} className="text-primary" />
              <h3 className="font-serif text-xl text-foreground">Weight trend</h3>
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

          <div className="bg-card border border-border rounded-3xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Pill size={18} className="text-primary" />
              <h3 className="font-serif text-xl text-foreground">Medication adherence</h3>
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
                      <span className="text-sm font-medium text-foreground">{med.medicationName}</span>
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
      <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-3xl shadow-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent h-32 pointer-events-none"></div>
        
        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 relative z-10 scroll-smooth">
          {isLoading ? (
            <div className="space-y-8">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse">
                   <div className="w-2/3 h-16 bg-accent rounded-2xl rounded-tr-sm ml-auto mb-4"></div>
                   <div className="w-5/6 h-32 bg-accent rounded-2xl rounded-tl-sm mr-auto"></div>
                </div>
              ))}
            </div>
          ) : !insights || insights.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-70">
               <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
                 <Bot size={40} />
               </div>
               <h3 className="font-serif text-2xl mb-3 text-foreground">How can I help?</h3>
               <p className="text-muted-foreground">Ask about diet changes, strange behaviors, or preventative care. I'll use your pet's health records to give personalized context.</p>
               
               <div className="mt-8 flex flex-wrap justify-center gap-3">
                 <button onClick={() => setQuestion("What are the signs of arthritis?")} className="text-sm bg-background border border-border px-4 py-2 rounded-full hover:border-primary transition-colors">Signs of arthritis?</button>
                 <button onClick={() => setQuestion("How much water should they drink?")} className="text-sm bg-background border border-border px-4 py-2 rounded-full hover:border-primary transition-colors">Water intake?</button>
                 <button onClick={() => setQuestion("Should I worry about bad breath?")} className="text-sm bg-background border border-border px-4 py-2 rounded-full hover:border-primary transition-colors">Bad breath causes?</button>
               </div>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="bg-primary/10 border border-primary/20 text-primary-foreground/90 p-4 rounded-xl text-sm flex gap-3 shadow-inner">
                 <ShieldAlert className="shrink-0 text-primary" size={20} />
                 <p className="text-foreground/80">
                   <strong>Disclaimer:</strong> This AI assistant provides educational information based on general veterinary knowledge and your provided records. It cannot diagnose conditions or prescribe treatments. If your pet is in distress, contact an emergency vet immediately.
                 </p>
              </div>

              {insights.map((insight) => {
                const ToneIcon = toneConfig[insight.tone].icon;
                
                return (
                  <div key={insight.id} className="space-y-6">
                    {/* User Question — omitted for insights with no real question attached (e.g. orphaned rows predating the question field) */}
                    {insight.question.trim().length > 0 && (
                      <div className="flex justify-end">
                        <div className="bg-primary text-primary-foreground px-6 py-4 rounded-3xl rounded-tr-sm max-w-[85%] shadow-sm">
                          <p className="text-lg leading-relaxed">{insight.question}</p>
                          <span className="text-[10px] uppercase tracking-wider opacity-70 mt-2 block">
                            {format(new Date(insight.createdAt), 'h:mm a • MMM d')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* AI Response */}
                    <div className="flex justify-start">
                      <div className="bg-background border border-border px-6 py-6 rounded-3xl rounded-tl-sm max-w-[90%] shadow-sm flex gap-5">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 border", toneConfig[insight.tone].bg, toneConfig[insight.tone].color, "border-current/20")}>
                          <ToneIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                           {insight.kind === 'escalation' && (
                             <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-destructive">
                               <ShieldAlert size={12} />
                               Escalated — contact your vet
                             </div>
                           )}
                           <div className="prose prose-sm md:prose-base prose-p:leading-relaxed prose-p:text-muted-foreground prose-headings:font-serif prose-headings:text-foreground prose-strong:text-foreground max-w-none">
                             {/* Simple markdown parsing for the AI content — rendered as React nodes, never raw HTML */}
                             {insight.content.split('\n\n').map((block, i) => renderBlock(block, i))}
                           </div>
                           
                           <div className="mt-6 pt-4 border-t border-border/50 text-xs text-muted-foreground/70 flex justify-between items-center gap-3">
                             <span>AI Generated • Not medical advice</span>
                             <div className="flex items-center gap-3 shrink-0">
                               {loggedInsightIds.has(insight.id) ? (
                                 <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                   <CheckCircle2 size={14} /> Logged
                                 </span>
                               ) : insight.question.trim().length > 0 ? (
                                 <button
                                   type="button"
                                   onClick={() => handleAddToSymptomLog(insight)}
                                   disabled={addToSymptomLog.isPending}
                                   className="flex items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-50"
                                 >
                                   <ClipboardPlus size={14} /> Add to symptom log
                                 </button>
                               ) : null}
                               <span className="capitalize">{insight.tone} priority</span>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {askInsight.isPending && (
                <div className="flex justify-end">
                  <div className="bg-primary/70 text-primary-foreground px-6 py-4 rounded-3xl rounded-tr-sm shadow-sm">
                    <p className="text-lg">{question}</p>
                  </div>
                </div>
              )}
              {askInsight.isPending && (
                <div className="flex justify-start items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0 animate-pulse">
                     <Bot size={20} className="text-primary" />
                   </div>
                   <div className="bg-background border border-border px-6 py-4 rounded-3xl rounded-tl-sm flex gap-1">
                     <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                     <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                     <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background border-t border-border z-20">
          {quotaExhausted ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              You've used all {quota!.limit} AI questions for this month. Your allowance resets next month.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="relative flex items-end">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Describe symptoms or ask a health question..."
                className="w-full bg-accent/30 border border-border rounded-2xl pl-6 pr-16 py-4 min-h-[60px] max-h-[160px] resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground/70 shadow-inner"
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
                className="absolute right-2 bottom-2 w-11 h-11 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-50 disabled:hover:bg-primary shadow-sm"
              >
                <Send size={18} className="ml-1" />
              </button>
            </form>
          )}
          <div className="text-center mt-3 text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
            Powered by Veterinary AI context
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
