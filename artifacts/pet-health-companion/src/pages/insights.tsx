import { usePetContext } from '@/context/pet-context';
import { useListInsights, getListInsightsQueryKey, useAskInsight } from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Sparkles, Send, Bot, ShieldAlert, Heart, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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

export default function Insights() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const { toast } = useToast();

  const { data: insights, isLoading } = useListInsights(
    activePetId ? { petId: activePetId } : undefined,
    { query: { enabled: !!activePetId, queryKey: activePetId ? getListInsightsQueryKey({ petId: activePetId }) : ['no-pet', 'insights'] } }
  );

  const askInsight = useAskInsight({
    mutation: {
      onSuccess: () => {
        if (activePetId) {
          queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey({ petId: activePetId }) });
        }
        setQuestion('');
        toast({ title: "Insight generated", description: "Scroll down to see the AI response." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to get AI insight.", variant: "destructive" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !activePetId || askInsight.isPending) return;
    askInsight.mutate({ data: { petId: activePetId, question } });
  };

  if (!activePetId) return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto flex flex-col h-full min-h-[calc(100vh-2rem)]">
      <div className="shrink-0 mb-8">
        <PageHeader 
          title="AI Health Assistant" 
          description="Ask questions about symptoms, diet, or behavior. Always consult your vet for real medical advice."
        />
      </div>

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
                    {/* User Question */}
                    <div className="flex justify-end">
                      <div className="bg-primary text-primary-foreground px-6 py-4 rounded-3xl rounded-tr-sm max-w-[85%] shadow-sm">
                        <p className="text-lg leading-relaxed">{insight.question}</p>
                        <span className="text-[10px] uppercase tracking-wider opacity-70 mt-2 block">
                          {format(new Date(insight.createdAt), 'h:mm a • MMM d')}
                        </span>
                      </div>
                    </div>

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
                             {insight.content.split('\n\n').map((paragraph, i) => (
                               <p key={i}>{renderFormattedText(paragraph)}</p>
                             ))}
                           </div>
                           
                           <div className="mt-6 pt-4 border-t border-border/50 text-xs text-muted-foreground/70 flex justify-between items-center">
                             <span>AI Generated • Not medical advice</span>
                             <span className="capitalize">{insight.tone} priority</span>
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
          <div className="text-center mt-3 text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
            Powered by Veterinary AI context
          </div>
        </div>
      </div>
    </div>
  );
}
