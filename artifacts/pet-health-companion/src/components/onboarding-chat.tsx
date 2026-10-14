import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreatePet,
  useUpdatePet,
  useUploadPetPhoto,
  useCreateDocumentImport,
  useAcceptDocumentImportItem,
  useAskInsight,
  getGetPetQueryKey,
  getListPetsQueryKey,
  getListDocumentImportsQueryKey,
  getListMedicationsQueryKey,
  getListHealthRecordsQueryKey,
  getListRemindersQueryKey,
  getGetPetVaccinesQueryKey,
  getGetDashboardSummaryQueryKey,
  ApiError,
  type Pet,
  type PetInput,
  type DocumentImportItem,
  type Insight,
} from '@workspace/api-client-react';
import { PawPrint, Paperclip, Send, ArrowRight, Check, FileText, Pill, Bell, Stethoscope, Heart, Activity, ShieldAlert, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import { SPECIES_OPTIONS, BREEDS_BY_SPECIES } from '@/lib/pet-species';
import { cn } from '@/lib/utils';

// Mirrors (a condensed subset of) pawlie-widget.tsx's tone styling and
// **bold**-text renderer — kept as its own copy for the same reason that
// file gives for not importing insights.tsx's version: this chat is its own
// self-contained flow, so nothing here can regress (or be regressed by) the
// main chat experience.
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
function renderFormattedText(text: string) {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    const match = part.match(/^\*\*(.*)\*\*$/);
    return match ? <strong key={i}>{match[1]}</strong> : part;
  });
}

const ITEM_TYPE_META: Record<DocumentImportItem['itemType'], { icon: typeof FileText; label: (d: Record<string, unknown>) => string; sub: (d: Record<string, unknown>) => string }> = {
  health_record: { icon: FileText, label: (d) => String(d.title ?? 'Health record'), sub: (d) => String(d.type ?? '') },
  medication: { icon: Pill, label: (d) => String(d.name ?? 'Medication'), sub: (d) => [d.dose, d.frequency].filter(Boolean).join(' · ') },
  reminder: { icon: Bell, label: (d) => String(d.title ?? 'Reminder'), sub: (d) => String(d.dueDate ?? '') },
  vet_info: { icon: Stethoscope, label: () => 'Vet contact', sub: (d) => String(d.vetClinic ?? d.vetName ?? '') },
};

const MEDICATION_DOSE_PLACEHOLDER = 'Not stated in document';
const MEDICATION_FREQUENCY_PLACEHOLDER = 'Not stated in document — please confirm';
function medicationNeedsDoseInfo(item: DocumentImportItem): boolean {
  if (item.itemType !== 'medication') return false;
  const d = item.proposedData as Record<string, unknown>;
  return d.dose === MEDICATION_DOSE_PLACEHOLDER || d.frequency === MEDICATION_FREQUENCY_PLACEHOLDER;
}

// Same check profile.tsx uses for its own photo upload input — kept as its
// own copy here rather than shared, matching this file's existing
// convention (see ITEM_TYPE_META above) of each onboarding flow owning its
// small lookups independently.
const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

type StepKey = 'name' | 'species' | 'photo' | 'offer-upload' | 'breed' | 'birthday' | 'weight' | 'health' | 'vet';
const QUEUE: StepKey[] = ['name', 'species', 'photo', 'offer-upload', 'breed', 'birthday', 'weight', 'health', 'vet'];

// Omit<Msg, 'id'> doesn't distribute cleanly over a discriminated union (it
// collapses to the shared keys only) — defined as a separate MsgBody union
// plus an `& { id }` intersection instead, so push() below can accept any
// variant's full shape without TS losing the discrimination.
type MsgBody =
  | { from: 'user'; kind: 'text'; text: string }
  | { from: 'user'; kind: 'file'; text: string }
  | { from: 'user'; kind: 'photo'; photoUrl: string }
  | { from: 'pawlie'; kind: 'text'; text: string }
  | { from: 'pawlie'; kind: 'found'; text: string; importId: number; items: DocumentImportItem[]; resolved: 'pending' | 'saved' | 'skipped' }
  | { from: 'pawlie'; kind: 'insight'; insight: Insight }
  | { from: 'pawlie'; kind: 'cta'; text: string };
type Msg = MsgBody & { id: number };

const EMPTY_PET_INPUT: PetInput = {
  name: '',
  species: 'dog',
  sex: 'unknown',
  spayNeuterStatus: 'unknown',
  weightUnit: 'lb',
  breed: null,
  birthDate: null,
  weight: null,
  photoUrl: null,
  notes: null,
  vetName: null,
  vetClinic: null,
  vetPhone: null,
  vetAddress: null,
};

function stepQuestion(step: StepKey, petName: string): string {
  switch (step) {
    case 'name':
      return "Hi, I'm Pawlie. Let's set up your pet's file together — a few quick questions, then you can ask me anything about them. What's your pet's name?";
    case 'species':
      return `Nice to meet ${petName}! What kind of animal are they?`;
    case 'photo':
      return `Want to add a photo of ${petName}? It goes on their pet card, and you can change it any time.`;
    case 'offer-upload':
      return `Got a recent vet report for ${petName}? Drop it in and I'll fill in the rest — or we can keep chatting.`;
    case 'breed':
      return `What breed is ${petName}?`;
    case 'birthday':
      return `How old is ${petName}? A birthday works too.`;
    case 'weight':
      return 'Roughly how much do they weigh?';
    case 'health':
      return `Anything I should know about ${petName}'s health? Allergies, conditions, medicines…`;
    case 'vet':
      return `Last one: who's ${petName}'s vet? I'll use it for reminders later.`;
  }
}

function stepChips(step: StepKey, species: PetInput['species']): string[] {
  switch (step) {
    case 'species':
      return SPECIES_OPTIONS.map((s) => s.label);
    case 'photo':
      return ['Add a photo', 'Skip for now'];
    case 'offer-upload':
      return ['Upload a vet report', "I'll just answer"];
    case 'breed':
      return [...BREEDS_BY_SPECIES[species].slice(0, 4).map((b) => b.label), 'Not sure'];
    case 'birthday':
      return ['Not sure'];
    case 'weight':
      return ['Not sure'];
    case 'health':
      return ['Nothing right now'];
    case 'vet':
      return ['Skip for now'];
    default:
      return [];
  }
}

function stepPlaceholder(step: StepKey): string {
  switch (step) {
    case 'name':
      return "Your pet's name";
    case 'species':
      return 'Or type it';
    case 'photo':
      return 'Or type a reply';
    case 'offer-upload':
      return 'Or type a reply';
    case 'breed':
      return 'Type a breed';
    case 'birthday':
      return 'e.g. 4 years, or 2022-03-14';
    case 'weight':
      return 'e.g. 62 lb';
    case 'health':
      return 'Tell me in your own words';
    case 'vet':
      return 'Clinic or vet name';
  }
}

// A loose YYYY-MM-DD (or slash-separated) check — good enough to decide
// "does this look like a real date" without pulling in a date library for
// one onboarding question. Anything else folds into notes instead of being
// silently dropped.
function tryParseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function tryParseWeight(text: string): { weight: number; weightUnit: 'lb' | 'kg' } | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(lb|lbs|kg|kgs)?/i);
  if (!m) return null;
  const weight = Number(m[1]);
  if (!Number.isFinite(weight)) return null;
  const weightUnit = /kg/i.test(m[2] ?? '') ? 'kg' : 'lb';
  return { weight, weightUnit };
}

function appendNote(notes: string | null | undefined, line: string): string {
  return notes ? `${notes}\n${line}` : line;
}

function TypingBubble() {
  return (
    <div className="flex items-center gap-1.5 bg-accent/30 border border-border rounded-2xl rounded-bl-md px-4 py-3 w-fit">
      {[0, 150, 300].map((d) => (
        <span key={d} className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}

export function OnboardingChat({
  onUseFormInstead,
  onDone,
}: {
  onUseFormInstead: (pet: PetInput, petId: number | null) => void;
  onDone: (pet: Pet) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<'setup' | 'ask' | 'answered'>('setup');
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [pet, setPet] = useState<PetInput>(EMPTY_PET_INPUT);
  const [petId, setPetId] = useState<number | null>(null);
  const [reportHandled, setReportHandled] = useState(false);

  const msgId = useRef(0);
  const push = (m: MsgBody) => setMsgs((prev) => [...prev, { ...m, id: ++msgId.current }]);

  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [msgs, typing]);

  const askedFirst = useRef(false);
  useEffect(() => {
    if (askedFirst.current) return;
    askedFirst.current = true;
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      push({ from: 'pawlie', kind: 'text', text: stepQuestion('name', '') });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPet = useCreatePet({
    mutation: {
      onError: (error) => toast({ title: "Couldn't add your pet", description: error.message, variant: 'destructive' }),
    },
  });
  const updatePet = useUpdatePet({
    mutation: {
      onError: (error) => toast({ title: "Couldn't save that", description: error.message, variant: 'destructive' }),
    },
  });
  const uploadPhoto = useUploadPetPhoto({
    mutation: {
      onError: (error) => toast({ title: "Couldn't upload photo", description: error.message, variant: 'destructive' }),
    },
  });
  const createImport = useCreateDocumentImport();
  const acceptItem = useAcceptDocumentImportItem();
  const askInsight = useAskInsight();

  const invalidateAfterSave = () => {
    if (!petId) return;
    queryClient.invalidateQueries({ queryKey: getListDocumentImportsQueryKey(petId) });
    queryClient.invalidateQueries({ queryKey: getListMedicationsQueryKey(petId) });
    queryClient.invalidateQueries({ queryKey: getListHealthRecordsQueryKey(petId) });
    queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey(petId) });
    queryClient.invalidateQueries({ queryKey: getGetPetVaccinesQueryKey(petId) });
    queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(petId) });
    queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const advance = (nextPet: PetInput, delayMs = 700, customIntro?: string) => {
    const next = stepIndex + 1;
    setPet(nextPet);
    setStepIndex(next);
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      if (next < QUEUE.length) {
        const question = stepQuestion(QUEUE[next], nextPet.name);
        push({ from: 'pawlie', kind: 'text', text: customIntro ? `${customIntro} ${question}` : question });
      } else {
        setMode('ask');
        push({
          from: 'pawlie',
          kind: 'text',
          text: `${nextPet.name}'s file is ready. Now try me — ask anything about ${nextPet.name} and I'll answer using what you just told me.`,
        });
      }
    }, delayMs);
  };

  // Shared by the dedicated "photo" chat step and the always-tappable
  // avatar (side panel) — only the former pushes a chat bubble and
  // advances the conversation; tapping the avatar later is a silent
  // profile update, same as profile.tsx's own photo control.
  const handlePhotoFile = (file: File) => {
    if (!petId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Photo is too large', description: 'Maximum size is 10MB.', variant: 'destructive' });
      return;
    }
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.type)) {
      toast({ title: 'Unsupported file type', description: 'Use a JPEG, PNG, WEBP, or HEIC image.', variant: 'destructive' });
      return;
    }
    const atPhotoStep = mode === 'setup' && QUEUE[stepIndex] === 'photo';
    uploadPhoto.mutate(
      { petId, data: { file } },
      {
        onSuccess: (updated) => {
          if (atPhotoStep) {
            push({ from: 'user', kind: 'photo', photoUrl: updated.photoUrl ?? '' });
            advance({ ...pet, photoUrl: updated.photoUrl }, 700, `Look at that face! I've added it to ${pet.name}'s card.`);
          } else {
            setPet((p) => ({ ...p, photoUrl: updated.photoUrl }));
            toast({ title: 'Photo updated' });
          }
        },
      },
    );
  };

  const handleUpload = (file: File) => {
    if (!petId) return;
    push({ from: 'user', kind: 'file', text: file.name });
    setTyping(true);
    createImport.mutate(
      { petId, data: { file } },
      {
        onSuccess: (data) => {
          setTyping(false);
          push({
            from: 'pawlie',
            kind: 'found',
            text: `Here's what I found in ${file.name}. Want me to add it all to ${pet.name}'s file?`,
            importId: data.import.id,
            items: data.import.items,
            resolved: 'pending',
          });
        },
        onError: (error) => {
          setTyping(false);
          const message =
            error instanceof ApiError && error.data && typeof error.data === 'object' && 'error' in error.data
              ? String((error.data as { error: unknown }).error)
              : error.message;
          push({ from: 'pawlie', kind: 'text', text: `I couldn't read that one — ${message} You can keep answering instead, or try a different file any time.` });
        },
      },
    );
  };

  const resolveFound = (msg: Extract<Msg, { kind: 'found' }>, save: boolean) => {
    setMsgs((prev) => prev.map((m) => (m.id === msg.id ? { ...m, resolved: save ? 'saved' : 'skipped' } : m)));
    setReportHandled(true);
    if (!save) {
      push({ from: 'user', kind: 'text', text: 'Not now' });
      setTyping(true);
      window.setTimeout(() => {
        setTyping(false);
        push({ from: 'pawlie', kind: 'text', text: 'No problem, you can upload it later from Uploads.' });
        if (stepIndex < QUEUE.length) advance(pet, 400);
      }, 500);
      return;
    }
    push({ from: 'user', kind: 'text', text: 'Save all' });
    if (!petId) return;
    const pending = msg.items.filter((i) => i.status === 'pending');
    setTyping(true);
    Promise.all(pending.map((item) => acceptItem.mutateAsync({ petId, importId: msg.importId, itemId: item.id }))).then(() => {
      invalidateAfterSave();
      setTyping(false);
      const counts = pending.reduce<Record<string, number>>((acc, i) => {
        acc[i.itemType] = (acc[i.itemType] ?? 0) + 1;
        return acc;
      }, {});
      const parts: string[] = [];
      if (counts.health_record) parts.push(`${counts.health_record} health record${counts.health_record > 1 ? 's' : ''}`);
      if (counts.medication) parts.push(`${counts.medication} medicine${counts.medication > 1 ? 's' : ''}`);
      if (counts.reminder) parts.push(`${counts.reminder} reminder${counts.reminder > 1 ? 's' : ''}`);
      if (counts.vet_info) parts.push('your vet\'s contact');
      const needsDose = pending.some(medicationNeedsDoseInfo);
      push({
        from: 'pawlie',
        kind: 'text',
        text: `Done — I added ${parts.join(', ') || 'everything I found'}.${needsDose ? " One medicine's dose wasn't stated in the report — you can fill it in from the Medications page." : ''}`,
      });
      if (stepIndex < QUEUE.length) advance(pet, 600);
    });
  };

  const answerStep = (text: string) => {
    const step = QUEUE[stepIndex];
    push({ from: 'user', kind: 'text', text });

    if (step === 'name') {
      const name = text.replace(/^\w/, (c) => c.toUpperCase());
      advance({ ...pet, name });
      return;
    }

    if (step === 'species') {
      const matched = SPECIES_OPTIONS.find((s) => s.label.toLowerCase() === text.toLowerCase());
      const species = matched?.value ?? 'other';
      const next: PetInput = { ...pet, species };
      setTyping(true);
      createPet.mutate(
        { data: next },
        {
          onSuccess: (created) => {
            setPetId(created.id);
            const { id: _id, ...rest } = created;
            advance(rest as PetInput);
          },
          onError: () => setTyping(false),
        },
      );
      return;
    }

    if (step === 'photo') {
      if (!/skip|no|later/i.test(text)) {
        document.getElementById('onboarding-chat-photo-input')?.click();
        return;
      }
      advance(pet);
      return;
    }

    if (step === 'offer-upload') {
      if (/upload/i.test(text) && !/just answer/i.test(text)) {
        document.getElementById('onboarding-chat-file-input')?.click();
        return;
      }
      advance(pet);
      return;
    }

    if (step === 'breed') {
      const next = { ...pet, breed: text === 'Not sure' ? null : text };
      if (!petId) return advance(next);
      setTyping(true);
      updatePet.mutate({ petId, data: next }, { onSettled: () => advance(next) });
      return;
    }

    if (step === 'birthday') {
      const parsed = text === 'Not sure' ? null : tryParseDate(text);
      const next: PetInput =
        text === 'Not sure'
          ? pet
          : parsed
            ? { ...pet, birthDate: parsed }
            : { ...pet, notes: appendNote(pet.notes, `Age: ${text}`) };
      if (!petId) return advance(next);
      setTyping(true);
      updatePet.mutate({ petId, data: next }, { onSettled: () => advance(next) });
      return;
    }

    if (step === 'weight') {
      const parsedWeight = text === 'Not sure' ? null : tryParseWeight(text);
      const next: PetInput =
        text === 'Not sure'
          ? pet
          : parsedWeight
            ? { ...pet, weight: parsedWeight.weight, weightUnit: parsedWeight.weightUnit }
            : { ...pet, notes: appendNote(pet.notes, `Weight: ${text}`) };
      if (!petId) return advance(next);
      setTyping(true);
      updatePet.mutate({ petId, data: next }, { onSettled: () => advance(next) });
      return;
    }

    if (step === 'health') {
      const next = text === 'Nothing right now' ? pet : { ...pet, notes: appendNote(pet.notes, text) };
      if (!petId) return advance(next);
      setTyping(true);
      updatePet.mutate({ petId, data: next }, { onSettled: () => advance(next) });
      return;
    }

    if (step === 'vet') {
      const next = { ...pet, vetClinic: text === 'Skip for now' ? null : text };
      if (!petId) return advance(next);
      setTyping(true);
      updatePet.mutate({ petId, data: next }, { onSettled: () => advance(next) });
      return;
    }
  };

  const askQuestion = (text: string) => {
    if (!petId) return;
    push({ from: 'user', kind: 'text', text });
    setTyping(true);
    askInsight.mutate(
      { data: { petId, question: text, conversationId: null } },
      {
        onSuccess: (data) => {
          setTyping(false);
          setMode('answered');
          push({ from: 'pawlie', kind: 'insight', insight: data.insight });
          window.setTimeout(() => {
            push({ from: 'pawlie', kind: 'cta', text: `That's what I'm here for, any time. Upload ${pet.name}'s vet records later and I'll use those too.` });
          }, 500);
        },
        onError: (error) => {
          setTyping(false);
          push({ from: 'pawlie', kind: 'text', text: `Sorry, I couldn't answer that — ${error.message}` });
        },
      },
    );
  };

  const send = () => {
    const text = draft.trim();
    if (!text || typing) return;
    setDraft('');
    if (mode === 'setup') answerStep(text);
    else askQuestion(text);
  };

  const handlePick = (label: string) => {
    if (typing) return;
    if (mode === 'setup') answerStep(label);
    else askQuestion(label);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File is too large', description: 'Maximum size is 10MB.', variant: 'destructive' });
      return;
    }
    handleUpload(file);
  };

  const handlePhotoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handlePhotoFile(file);
  };

  const currentStep = mode === 'setup' ? QUEUE[stepIndex] : null;
  const chips = currentStep ? stepChips(currentStep, pet.species) : [];
  const placeholder = currentStep ? stepPlaceholder(currentStep) : 'Ask Pawlie anything…';
  const canAttach = mode === 'setup' && !!petId && !reportHandled;
  const avatarSrc = resolvePetAvatar(pet.photoUrl, pet.species);

  const profileRows: { label: string; value: string; filled: boolean }[] = [
    { label: 'Species', value: SPECIES_OPTIONS.find((s) => s.value === pet.species)?.label ?? pet.species, filled: !!petId },
    { label: 'Breed', value: pet.breed ?? '—', filled: !!pet.breed },
    { label: 'Birthday', value: pet.birthDate ?? '—', filled: !!pet.birthDate },
    { label: 'Weight', value: pet.weight ? `${pet.weight} ${pet.weightUnit}` : '—', filled: !!pet.weight },
    { label: 'Vet', value: pet.vetClinic ?? '—', filled: !!pet.vetClinic },
  ];

  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-6 px-4 md:px-8 py-6">
      <div className="flex-1 min-w-0 flex flex-col bg-card border border-border rounded-3xl overflow-hidden">
        <div className="shrink-0 h-16 px-4 flex items-center gap-3 border-b border-border bg-accent/40">
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <PawPrint size={19} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif font-extrabold text-[15px] leading-tight">Pawlie</div>
            <div className="text-xs text-muted-foreground">Let's set up your pet's file</div>
          </div>
          <button
            type="button"
            onClick={() => onUseFormInstead(pet, petId)}
            className="h-8 px-3 rounded-full border border-border bg-card text-xs font-bold text-muted-foreground hover:bg-accent transition-colors"
          >
            Use the form instead
          </button>
        </div>

        <div ref={chatRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3.5">
          {msgs.map((m) => (
            <div key={m.id}>
              {m.kind === 'text' && m.from === 'user' && (
                <div className="flex justify-end">
                  <div className="bg-foreground text-background px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-sm leading-relaxed">{m.text}</div>
                </div>
              )}
              {m.kind === 'file' && (
                <div className="flex justify-end">
                  <div className="flex items-center gap-2.5 bg-foreground text-background px-3.5 py-2.5 rounded-2xl rounded-br-md max-w-[85%]">
                    <FileText size={16} />
                    <span className="text-sm font-semibold truncate">{m.text}</span>
                  </div>
                </div>
              )}
              {m.kind === 'photo' && (
                <div className="flex justify-end">
                  <div className="bg-foreground p-1 rounded-2xl rounded-br-md">
                    <img src={m.photoUrl} alt="Pet photo" className="block w-28 h-28 object-cover rounded-xl rounded-br-sm" />
                  </div>
                </div>
              )}
              {m.kind === 'text' && m.from === 'pawlie' && (
                <div className="flex items-end gap-2 max-w-[88%]">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <PawPrint size={13} />
                  </div>
                  <div className="bg-accent/30 border border-border rounded-2xl rounded-bl-md px-3.5 py-3 text-sm leading-relaxed">{m.text}</div>
                </div>
              )}
              {m.kind === 'found' && (
                <div className="bg-accent/20 border border-border rounded-2xl rounded-bl-md p-3.5 max-w-[92%]">
                  <div className="text-sm leading-relaxed mb-2.5">{m.text}</div>
                  <div className="flex flex-col gap-1.5">
                    {m.items.map((item) => {
                      const meta = ITEM_TYPE_META[item.itemType];
                      const Icon = meta.icon;
                      const d = item.proposedData as Record<string, unknown>;
                      return (
                        <div key={item.id} className="flex items-center gap-2.5 bg-card rounded-xl px-2.5 py-2">
                          <div className="w-7 h-7 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
                            <Icon size={13} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold truncate">{meta.label(d)}</div>
                            <div className="text-xs text-muted-foreground truncate">{meta.sub(d)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {m.resolved === 'pending' && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => resolveFound(m, true)}
                        className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-[13.5px] font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                      >
                        <Check size={14} /> Save all to {pet.name}'s file
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveFound(m, false)}
                        className="h-9 px-3.5 rounded-full border border-border bg-card text-[13.5px] font-bold hover:bg-accent transition-colors"
                      >
                        Not now
                      </button>
                    </div>
                  )}
                  {m.resolved === 'saved' && (
                    <span className="inline-block mt-2.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Saved</span>
                  )}
                  {m.resolved === 'skipped' && (
                    <span className="inline-block mt-2.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Not now</span>
                  )}
                </div>
              )}
              {m.kind === 'insight' && (() => {
                const tone = toneConfig[m.insight.tone];
                const ToneIcon = tone.icon;
                return (
                  <div className="bg-accent/30 border border-border rounded-2xl rounded-bl-md p-3.5 max-w-[92%]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', tone.bg, tone.color)}>
                        <ToneIcon size={13} />
                      </div>
                      <div className="text-xs font-bold">{toneLabel[m.insight.tone]}</div>
                    </div>
                    <div className="text-[13.5px] leading-relaxed space-y-2">
                      {m.insight.content.split('\n\n').map((block, i) => (
                        <p key={i}>{renderFormattedText(block)}</p>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {m.kind === 'cta' && (
                <div className="bg-card border border-primary rounded-2xl p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px] text-sm text-muted-foreground leading-relaxed">{m.text}</div>
                  <button
                    type="button"
                    onClick={() => petId && onDone({ ...pet, id: petId } as Pet)}
                    className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-[15px] font-extrabold flex items-center gap-2 hover:bg-primary/90 transition-colors"
                  >
                    Open {pet.name}'s file <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {typing && <TypingBubble />}
        </div>

        <input id="onboarding-chat-photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoInputChange} />

        <div className="shrink-0 border-t border-border p-3 bg-card">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handlePick(c)}
                  className="h-8 px-3 text-xs font-semibold bg-card border border-border rounded-full hover:border-primary transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            {canAttach && (
              <>
                <input id="onboarding-chat-file-input" type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileInput} />
                <button
                  type="button"
                  aria-label="Upload a vet report"
                  title="Upload a vet report"
                  onClick={() => document.getElementById('onboarding-chat-file-input')?.click()}
                  className="h-10 w-10 shrink-0 rounded-full border border-border bg-card text-muted-foreground flex items-center justify-center hover:text-primary hover:border-primary transition-colors"
                >
                  <Paperclip size={16} />
                </button>
              </>
            )}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={placeholder}
              disabled={typing}
              className="flex-1 min-w-0 h-10 bg-accent/40 border border-border rounded-2xl px-3.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || typing}
              aria-label="Send"
              className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="lg:w-80 shrink-0 flex flex-col gap-3 lg:justify-center">
        <div className="text-xs font-bold tracking-wide text-muted-foreground text-center">BUILDING AS YOU CHAT</div>
        <div className="rounded-3xl overflow-hidden bg-foreground text-background">
          <div className="p-5 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => petId && document.getElementById('onboarding-chat-photo-input')?.click()}
              disabled={!petId}
              title={pet.photoUrl ? 'Change photo' : 'Add a photo'}
              aria-label={pet.photoUrl ? 'Change photo' : 'Add a photo'}
              className="relative w-20 h-20 rounded-full disabled:cursor-default"
            >
              <span className="block w-20 h-20 rounded-full overflow-hidden bg-background/10">
                {avatarSrc && <img src={avatarSrc} alt="" className="w-full h-full object-cover" />}
              </span>
              {!!petId && (
                <span className="absolute right-0 bottom-0 w-6 h-6 rounded-full bg-primary text-primary-foreground border-2 border-foreground flex items-center justify-center">
                  <Camera size={12} />
                </span>
              )}
            </button>
            <div className="mt-3 font-serif text-2xl font-extrabold">{pet.name || 'Your pet'}</div>
            {pet.breed && <div className="mt-0.5 text-sm text-background/75">{pet.breed}</div>}
          </div>
          <div className="px-5 pb-4 pt-1 border-t border-dashed border-background/20">
            {profileRows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 py-2 border-b border-background/10 text-[13.5px] last:border-0">
                <span className="flex items-center gap-2 text-background/60">
                  <span className={cn('w-1.5 h-1.5 rounded-full', r.filled ? 'bg-primary' : 'bg-background/30')} />
                  {r.label}
                </span>
                <span className="font-bold truncate max-w-[140px]">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">Everything stays editable from their profile later.</p>
      </div>
    </div>
  );
}
