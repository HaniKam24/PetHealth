import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListConversations,
  getListConversationsQueryKey,
  useListConversationInsights,
  getListConversationInsightsQueryKey,
  useAskInsight,
  useListSymptomLogs,
  getListSymptomLogsQueryKey,
  useCreateSymptomLog,
  useListPets,
  getListPetsQueryKey,
  getGetPetQueryKey,
  getGetDashboardSummaryQueryKey,
  getListRemindersQueryKey,
  useConfirmAiAction,
  useCancelAiAction,
  type Insight,
  type AiAction,
  type EmergencyVetMetadata,
} from '@workspace/api-client-react';
import {
  PawPrint,
  Sparkles,
  X,
  Plus,
  Maximize2,
  Send,
  Loader2,
  Check,
  CheckCircle2,
  ClipboardPlus,
  ShieldAlert,
  Phone,
  Bell,
  Stethoscope,
  Heart,
  Activity,
} from 'lucide-react';
import { usePetContext } from '@/context/pet-context';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// This mirrors (a condensed subset of) the rendering logic in pages/insights.tsx —
// tone styling, the **bold**/heading text renderer, and the action/emergency-vet
// cards. Kept as its own copy rather than importing from insights.tsx so this
// floating widget stays fully independent of that page: nothing here can
// regress the full chat experience, and vice versa. If the two ever need to
// stay in lockstep, pulling these into a shared file would be the next step.

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

const ACTION_TYPE_META: Record<AiAction['actionType'], { label: string; icon: typeof Bell }> = {
  create_reminder: { label: 'New reminder', icon: Bell },
  complete_reminder: { label: 'Mark reminder done', icon: CheckCircle2 },
  update_pet_profile: { label: 'Profile update', icon: Stethoscope },
  log_symptom: { label: 'Symptom log entry', icon: ClipboardPlus },
};

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    const match = part.match(/^\*\*(.*)\*\*$/);
    return match ? <strong key={i}>{match[1]}</strong> : part;
  });
}

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

function EmergencyVetCard({ metadata }: { metadata: EmergencyVetMetadata }) {
  const { toast } = useToast();

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(metadata.script);
      toast({ title: 'Copied', description: 'Script copied — read it when they pick up.' });
    } catch {
      toast({ title: "Couldn't copy", description: 'Your browser blocked clipboard access.', variant: 'destructive' });
    }
  };

  if (metadata.vets.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 mt-1">
      {metadata.vets.map((vet, i) => (
        <div key={i} className="bg-accent/40 border border-border rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="font-serif font-extrabold text-sm truncate">{vet.name}</div>
            {vet.address && <div className="text-xs text-muted-foreground truncate mt-0.5">{vet.address}</div>}
          </div>
          <a
            href={`tel:${vet.phone}`}
            className="shrink-0 h-8 flex items-center gap-1.5 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Phone size={12} /> {vet.phone}
          </a>
        </div>
      ))}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">What to say</div>
        <p className="text-xs leading-relaxed">{metadata.script}</p>
        <button
          type="button"
          onClick={handleCopyScript}
          className="mt-2 h-7 flex items-center gap-1.5 px-3 text-xs font-bold rounded-full border border-border hover:bg-accent transition-colors"
        >
          Copy script
        </button>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  onConfirm,
  onCancel,
  busy,
}: {
  action: AiAction;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const meta = ACTION_TYPE_META[action.actionType];
  const Icon = meta.icon;
  return (
    <div className="bg-accent/40 border border-border rounded-xl p-3 flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {meta.label}
      </div>
      {action.status === 'pending' ? (
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-7 flex items-center gap-1 px-2.5 text-xs font-bold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirm
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-7 flex items-center gap-1 px-2.5 text-xs font-bold rounded-full border border-border hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <X size={12} /> Cancel
          </button>
        </div>
      ) : (
        <span
          className={cn(
            'text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0',
            action.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
          )}
        >
          {action.status === 'confirmed' ? 'Saved' : 'Cancelled'}
        </span>
      )}
    </div>
  );
}

const SUGGESTIONS = ["What's their current medication schedule?", 'Should I worry about bad breath?'];

export function PawlieWidget() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  // null = "new conversation" (either explicitly via New chat, or because this
  // pet has no conversations yet). Defaulted to the most recent conversation
  // the first time the widget opens for a given pet — see effect below.
  const [conversationId, setConversationId] = useState<number | null>(null);
  const didDefaultRef = useRef(false);

  const { data: pets } = useListPets({ query: { enabled: open } });
  const activePet = pets?.find((p) => p.id === activePetId);

  // Conversations are pet-scoped — a conversation picked for one pet is
  // meaningless once the owner switches to another, so drop back to "new
  // conversation" and let the next open re-default from the new pet's list.
  const previousPetIdRef = useRef<number | null>(null);
  useEffect(() => {
    const previousPetId = previousPetIdRef.current;
    previousPetIdRef.current = activePetId;
    if (previousPetId !== null && activePetId !== null && previousPetId !== activePetId) {
      setConversationId(null);
      setQuestion('');
      didDefaultRef.current = false;
    }
  }, [activePetId]);

  const { data: conversationsData } = useListConversations(activePetId!, {
    query: {
      enabled: open && !!activePetId,
      queryKey: activePetId ? getListConversationsQueryKey(activePetId) : ['no-pet', 'conversations'],
    },
  });
  const conversations = conversationsData?.conversations;
  const quota = conversationsData?.quota;
  const quotaExhausted = quota !== undefined && quota.remaining <= 0;

  // Resume the most recent conversation on first open rather than always
  // starting fresh — matches the "always reachable, pick up where you left
  // off" feel a chat widget should have. Only runs once per pet (per the
  // reset effect above), so an explicit "New chat" tap always sticks.
  useEffect(() => {
    if (!open || didDefaultRef.current || !conversations) return;
    didDefaultRef.current = true;
    if (conversations.length > 0) {
      setConversationId(conversations[0].id);
    }
  }, [open, conversations]);

  const { data: threadData, isLoading: threadLoading } = useListConversationInsights(activePetId!, conversationId!, {
    query: {
      enabled: open && !!activePetId && !!conversationId,
      queryKey:
        activePetId && conversationId
          ? getListConversationInsightsQueryKey(activePetId, conversationId)
          : ['no-conversation', 'insights'],
    },
  });
  const insights = threadData?.insights;

  const askInsight = useAskInsight({
    mutation: {
      onSuccess: (data) => {
        if (!activePetId || data.conversation.petId !== activePetId) return;
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey(activePetId) });
        queryClient.invalidateQueries({ queryKey: getListConversationInsightsQueryKey(activePetId, data.conversation.id) });
        setQuestion('');
        setConversationId(data.conversation.id);
      },
      onError: (error) => toast({ title: "Couldn't get AI insight", description: error.message, variant: 'destructive' }),
    },
  });

  const { data: symptomLogs } = useListSymptomLogs(activePetId!, {
    query: { enabled: open && !!activePetId, queryKey: activePetId ? getListSymptomLogsQueryKey(activePetId) : ['no-pet', 'symptom-logs'] },
  });
  const loggedInsightIds = new Set(
    (symptomLogs ?? []).map((log) => log.insightId).filter((id): id is number => id !== null),
  );

  const addToSymptomLog = useCreateSymptomLog({
    mutation: {
      onSuccess: () => {
        if (activePetId) queryClient.invalidateQueries({ queryKey: getListSymptomLogsQueryKey(activePetId) });
        toast({ title: 'Added to symptom log', description: "You'll find it in Health Records." });
      },
      onError: () => toast({ title: 'Error', description: 'Failed to add to symptom log.', variant: 'destructive' }),
    },
  });

  const invalidateAfterAction = () => {
    if (!activePetId || !conversationId) return;
    queryClient.invalidateQueries({ queryKey: getListConversationInsightsQueryKey(activePetId, conversationId) });
    queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey(activePetId) });
    queryClient.invalidateQueries({ queryKey: getListSymptomLogsQueryKey(activePetId) });
    queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(activePetId) });
    queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const confirmAction = useConfirmAiAction({
    mutation: {
      onSuccess: invalidateAfterAction,
      onError: (error) => toast({ title: "Couldn't save that", description: error.message, variant: 'destructive' }),
    },
  });

  const cancelAction = useCancelAiAction({
    mutation: {
      onSuccess: invalidateAfterAction,
      onError: (error) => toast({ title: "Couldn't cancel that", description: error.message, variant: 'destructive' }),
    },
  });

  const handleAddToSymptomLog = (insight: Insight) => {
    if (!activePetId) return;
    addToSymptomLog.mutate({ petId: activePetId, data: { description: insight.question, insightId: insight.id } });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !activePetId || askInsight.isPending || quotaExhausted) return;
    askInsight.mutate({ data: { petId: activePetId, question, conversationId } });
  };

  const handleNewChat = () => {
    setConversationId(null);
    setQuestion('');
  };

  const handleOpenFull = () => {
    setOpen(false);
    setLocation(conversationId ? `/insights/${conversationId}` : '/insights');
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [insights, askInsight.isPending, open]);

  return (
    <>
      {open && (
        <div className="fixed z-40 bottom-24 right-5 md:right-8 w-[calc(100vw-2.5rem)] max-w-sm h-[min(560px,70vh)] bg-card border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          <div className="shrink-0 h-16 px-4 flex items-center gap-3 border-b border-border bg-accent/40">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <PawPrint size={19} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif font-extrabold text-[15px] leading-tight">Pawlie</div>
              <div className="text-xs text-muted-foreground truncate">
                {activePet ? `Chatting about ${activePet.name}` : 'AI pet health chat'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleNewChat}
              title="New chat"
              aria-label="Start a new chat"
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={handleOpenFull}
              title="Open full chat"
              aria-label="Open full chat page"
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <Maximize2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Close"
              aria-label="Close Pawlie chat"
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 min-h-0">
            {!activePetId ? (
              <p className="text-sm text-muted-foreground text-center py-8">Add a pet first to chat with Pawlie.</p>
            ) : threadLoading && conversationId ? (
              <div className="space-y-5">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="w-2/3 h-10 bg-accent rounded-2xl ml-auto mb-3" />
                    <div className="w-5/6 h-20 bg-accent rounded-2xl mr-auto" />
                  </div>
                ))}
              </div>
            ) : !insights || insights.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-2 py-6">
                <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center mb-4 text-primary">
                  <PawPrint size={26} />
                </div>
                <h3 className="font-serif text-lg font-extrabold mb-1.5">Hi, I'm Pawlie.</h3>
                <p className="text-sm text-muted-foreground">
                  Ask me about {activePet?.name ?? 'your pet'} — symptoms, routines, or what's already in their file.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQuestion(s)}
                      className="h-8 px-3 text-xs font-semibold bg-card border border-border rounded-full hover:border-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {insights.map((insight) => {
                  const ToneIcon = toneConfig[insight.tone].icon;
                  return (
                    <div key={insight.id} className="space-y-2.5">
                      {insight.question.trim().length > 0 && (
                        <div className="flex justify-end">
                          <div className="bg-foreground text-background px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]">
                            <p className="text-sm leading-relaxed">{insight.question}</p>
                          </div>
                        </div>
                      )}
                      <div className="bg-accent/30 border border-border rounded-2xl rounded-bl-md p-3.5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', toneConfig[insight.tone].bg, toneConfig[insight.tone].color)}>
                            <ToneIcon size={13} />
                          </div>
                          <div className="text-xs font-bold">{toneLabel[insight.tone]}</div>
                        </div>
                        <div className="prose prose-sm prose-p:leading-relaxed prose-p:text-foreground/90 prose-headings:font-serif prose-strong:text-foreground prose-p:text-[13.5px] max-w-none">
                          {insight.content.split('\n\n').map((block, i) => renderBlock(block, i))}
                        </div>
                        {insight.question.trim().length > 0 && !loggedInsightIds.has(insight.id) && (
                          <button
                            type="button"
                            onClick={() => handleAddToSymptomLog(insight)}
                            disabled={addToSymptomLog.isPending}
                            className="mt-2.5 h-7 px-2.5 flex items-center gap-1 rounded-full border border-border text-xs font-bold hover:bg-accent disabled:opacity-50 transition-colors"
                          >
                            <ClipboardPlus size={12} /> Save to file
                          </button>
                        )}
                      </div>
                      {insight.action && activePetId && (
                        <ActionCard
                          action={insight.action}
                          busy={confirmAction.isPending || cancelAction.isPending}
                          onConfirm={() => confirmAction.mutate({ petId: activePetId, actionId: insight.action!.id })}
                          onCancel={() => cancelAction.mutate({ petId: activePetId, actionId: insight.action!.id })}
                        />
                      )}
                      {insight.kind === 'emergency_vet_result' && insight.metadata && (
                        <EmergencyVetCard metadata={insight.metadata} />
                      )}
                    </div>
                  );
                })}
                {askInsight.isPending && (
                  <>
                    <div className="flex justify-end">
                      <div className="bg-foreground/70 text-background px-4 py-2.5 rounded-2xl rounded-br-md">
                        <p className="text-sm">{question}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-accent/30 border border-border rounded-2xl rounded-bl-md px-4 py-3 w-fit">
                      <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-border p-3 bg-card">
            {quotaExhausted ? (
              <p className="text-xs text-muted-foreground text-center py-1.5">
                You've used all {quota!.limit} AI questions this month.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask Pawlie anything…"
                  disabled={!activePetId}
                  rows={1}
                  className="flex-1 bg-accent/40 border border-border rounded-2xl px-3.5 py-2.5 min-h-[40px] max-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm placeholder:text-muted-foreground disabled:opacity-60"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!question.trim() || !activePetId || askInsight.isPending}
                  aria-label="Send"
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  {askInsight.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            )}
            {quota && !quotaExhausted && (
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                {quota.remaining} of {quota.limit} questions left this month
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pawlie's own paw-print mark (the same glyph used in the chat's empty
          state) plus a small sparkle badge — gives the launcher a bit of
          personality instead of a generic chat-bubble icon. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Pawlie chat' : 'Chat with Pawlie'}
        className="fixed z-40 bottom-5 right-5 md:right-8 w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? (
          <X size={26} />
        ) : (
          <div className="relative w-8 h-8 flex items-center justify-center">
            <PawPrint size={28} />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-primary">
              <Sparkles size={9} className="text-amber-900" />
            </span>
          </div>
        )}
      </button>
    </>
  );
}
