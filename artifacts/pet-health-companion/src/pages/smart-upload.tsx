import { useRef, useState } from 'react';
import { usePetContext } from '@/context/pet-context';
import {
  useListDocumentImports,
  getListDocumentImportsQueryKey,
  useCreateDocumentImport,
  useAcceptDocumentImportItem,
  useRejectDocumentImportItem,
  getDocumentImportDocumentUrl,
  getGetPetQueryKey,
  getListPetsQueryKey,
  getGetDashboardSummaryQueryKey,
  ApiError,
  type DocumentImport,
  type DocumentImportItem,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload,
  UploadCloud,
  Loader2,
  FileText,
  Pill,
  Bell,
  Stethoscope,
  Check,
  X,
  Pencil,
  Paperclip,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const RECORD_TYPE_LABELS: Record<string, string> = {
  visit: 'Vet Visit',
  vaccine: 'Vaccine',
  lab: 'Lab Results',
  procedure: 'Procedure',
  note: 'Observation Note',
};

const REMINDER_CATEGORY_LABELS: Record<string, string> = {
  appointment: 'Appointment',
  vaccine: 'Vaccine',
  medication: 'Medication',
  wellness: 'Wellness',
  other: 'Other',
};

const ITEM_TYPE_META: Record<string, { label: string; icon: typeof FileText }> = {
  health_record: { label: 'A visit to add', icon: FileText },
  medication: { label: 'A medicine to add', icon: Pill },
  reminder: { label: 'A reminder to add', icon: Bell },
  // Still tagged "vet_info" server-side (item_type is unchanged) even though
  // it can now also carry weight/breed — kept internal, not user-facing.
  vet_info: { label: 'Profile update', icon: Stethoscope },
};

// breed/weight added alongside the original vet-contact fields — same
// pattern, just a wider set of profile facts a document can update.
const PROFILE_FIELD_LABELS: Record<string, string> = {
  vetName: 'Vet',
  vetClinic: 'Clinic',
  vetPhone: 'Phone',
  vetAddress: 'Address',
  breed: 'Breed',
  weight: 'Weight',
  sex: 'Sex',
};

const SEX_DISPLAY_LABELS: Record<string, string> = {
  female: 'Female',
  male: 'Male',
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function num(v: unknown): string {
  return typeof v === 'number' ? String(v) : '';
}

// Read-only rendering of a proposed item's data — proposedData is loosely
// typed (shape depends on itemType), so fields are pulled defensively.
function ItemSummary({ item }: { item: DocumentImportItem }) {
  const d = item.proposedData as Record<string, unknown>;
  if (item.itemType === 'health_record') {
    return (
      <div className="bg-accent/40 rounded-2xl p-4">
        <div className="font-serif text-lg font-extrabold">{str(d.title)}</div>
        <div className="text-sm text-muted-foreground mt-0.5">
          {RECORD_TYPE_LABELS[str(d.type)] ?? str(d.type)} · {str(d.date).slice(0, 10)}
          {d.clinic ? ` · ${str(d.clinic)}` : ''}
        </div>
        {d.summary ? <p className="text-sm text-muted-foreground mt-2">{str(d.summary)}</p> : null}
      </div>
    );
  }
  if (item.itemType === 'medication') {
    // frequency is already the human-readable form of the schedule (e.g.
    // "Every 12 hours") whenever doseIntervalValue/doseIntervalUnit are set —
    // same convention the real Medications page uses, where those two fields
    // are never rendered as their own text, only used to decide whether dose
    // logging is offered. Appending them here too just repeated the same
    // wording a second time (e.g. "150mg · every 12 hours · every 12 hours").
    return (
      <div className="bg-accent/40 rounded-2xl p-4">
        <div className="font-serif text-lg font-extrabold">{str(d.name)}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{str(d.dose)} · {str(d.frequency)}</div>
        {d.instructions ? <p className="text-sm text-muted-foreground mt-2">{str(d.instructions)}</p> : null}
      </div>
    );
  }
  if (item.itemType === 'vet_info') {
    // Only ever contains the fields that changed — see buildProfileUpdate
    // server-side. Shown as a plain "field: new value" list rather than the
    // title/subtitle shape the other types use, since there's no single
    // natural title (could be just a phone number update, or just a weight).
    const entries = Object.entries(PROFILE_FIELD_LABELS).filter(([key]) => d[key] !== undefined && d[key] !== '');
    return (
      <div className="bg-accent/40 rounded-2xl p-4 space-y-1">
        {entries.map(([key, label]) => (
          <div key={key} className="text-sm">
            <span className="text-muted-foreground">{label}:</span>{' '}
            <span className="font-bold">
              {key === 'weight'
                ? `${str(d.weight)} ${str(d.weightUnit)}`
                : key === 'sex'
                  ? SEX_DISPLAY_LABELS[str(d.sex)] ?? str(d.sex)
                  : str(d[key])}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="bg-accent/40 rounded-2xl p-4">
      <div className="font-serif text-lg font-extrabold">{str(d.title)}</div>
      <div className="text-sm text-muted-foreground mt-0.5">
        {REMINDER_CATEGORY_LABELS[str(d.category)] ?? str(d.category)} · due {str(d.dueDate).slice(0, 10)}
      </div>
      {d.note ? <p className="text-sm text-muted-foreground mt-2">{str(d.note)}</p> : null}
    </div>
  );
}

function FormActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className="h-9 px-3.5 text-sm font-bold rounded-full text-muted-foreground hover:bg-accent transition-colors">
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="h-9 flex items-center gap-1.5 px-4 text-sm font-bold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {saving && <Loader2 size={14} className="animate-spin" />} Save &amp; Accept
      </button>
    </div>
  );
}

// Inline edit form shown in place of ItemSummary — field set depends on
// itemType. Saving calls onSave with a properly-shaped object matching the
// corresponding *Input schema, which the accept endpoint validates.
function ItemEditForm({
  item,
  onSave,
  onCancel,
  saving,
}: {
  item: DocumentImportItem;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const d = item.proposedData as Record<string, unknown>;
  const [fields, setFields] = useState<Record<string, string>>((): Record<string, string> => {
    if (item.itemType === 'health_record') {
      return {
        type: str(d.type) || 'visit',
        title: str(d.title),
        date: str(d.date).slice(0, 10),
        clinic: str(d.clinic),
        summary: str(d.summary),
      };
    }
    if (item.itemType === 'medication') {
      return {
        name: str(d.name),
        dose: str(d.dose),
        frequency: str(d.frequency),
        doseIntervalValue: num(d.doseIntervalValue),
        doseIntervalUnit: str(d.doseIntervalUnit),
        instructions: str(d.instructions),
      };
    }
    if (item.itemType === 'vet_info') {
      return {
        vetName: str(d.vetName),
        vetClinic: str(d.vetClinic),
        vetPhone: str(d.vetPhone),
        vetAddress: str(d.vetAddress),
        breed: str(d.breed),
        weight: num(d.weight),
        weightUnit: str(d.weightUnit) || 'lb',
        sex: str(d.sex),
      };
    }
    return {
      title: str(d.title),
      dueDate: str(d.dueDate).slice(0, 10),
      category: str(d.category) || 'other',
      note: str(d.note),
    };
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    if (item.itemType === 'health_record') {
      onSave({
        type: fields.type,
        title: fields.title,
        date: fields.date,
        clinic: fields.clinic || null,
        summary: fields.summary || null,
      });
    } else if (item.itemType === 'medication') {
      onSave({
        name: fields.name,
        dose: fields.dose,
        frequency: fields.frequency,
        doseIntervalValue: fields.doseIntervalValue ? Number(fields.doseIntervalValue) : null,
        doseIntervalUnit: fields.doseIntervalValue ? fields.doseIntervalUnit || 'days' : null,
        instructions: fields.instructions || null,
        active: true,
      });
    } else if (item.itemType === 'vet_info') {
      // Only non-empty fields are sent — the accept endpoint's schema treats
      // an omitted key as "leave this field alone" (not "clear it"), so a
      // blank input here must be left out of the object entirely, not sent
      // as null/empty-string.
      const update: Record<string, string | number> = {};
      if (fields.vetName.trim()) update.vetName = fields.vetName.trim();
      if (fields.vetClinic.trim()) update.vetClinic = fields.vetClinic.trim();
      if (fields.vetPhone.trim()) update.vetPhone = fields.vetPhone.trim();
      if (fields.vetAddress.trim()) update.vetAddress = fields.vetAddress.trim();
      if (fields.breed.trim()) update.breed = fields.breed.trim();
      // weight and weightUnit always travel together — see updatePetProfile
      // (care-mutations.ts), which writes them as a pair.
      if (fields.weight.trim()) {
        update.weight = Number(fields.weight);
        update.weightUnit = fields.weightUnit || 'lb';
      }
      if (fields.sex === 'female' || fields.sex === 'male') update.sex = fields.sex;
      onSave(update);
    } else {
      onSave({ title: fields.title, dueDate: fields.dueDate, category: fields.category, note: fields.note || null });
    }
  };

  if (item.itemType === 'health_record') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select value={fields.type} onValueChange={(v) => setFields((f) => ({ ...f, type: v }))}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={fields.date} onChange={set('date')} className="h-9" />
        </div>
        <Input placeholder="Title" value={fields.title} onChange={set('title')} className="h-9" />
        <Input placeholder="Clinic (optional)" value={fields.clinic} onChange={set('clinic')} className="h-9" />
        <Textarea placeholder="Summary (optional)" value={fields.summary} onChange={set('summary')} className="min-h-[70px] resize-none" />
        <FormActions onCancel={onCancel} onSave={submit} saving={saving} />
      </div>
    );
  }

  if (item.itemType === 'medication') {
    return (
      <div className="space-y-2">
        <Input placeholder="Medication name" value={fields.name} onChange={set('name')} className="h-9" />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Dose (e.g. 10mg)" value={fields.dose} onChange={set('dose')} className="h-9" />
          <Input placeholder="Frequency (e.g. twice daily)" value={fields.frequency} onChange={set('frequency')} className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={1}
            placeholder="Interval (optional)"
            value={fields.doseIntervalValue}
            onChange={set('doseIntervalValue')}
            className="h-9"
          />
          <Select value={fields.doseIntervalUnit || undefined} onValueChange={(v) => setFields((f) => ({ ...f, doseIntervalUnit: v }))}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              {['hours', 'days', 'weeks', 'months'].map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          placeholder="Instructions (optional)"
          value={fields.instructions}
          onChange={set('instructions')}
          className="min-h-[70px] resize-none"
        />
        <FormActions onCancel={onCancel} onSave={submit} saving={saving} />
      </div>
    );
  }

  if (item.itemType === 'vet_info') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Breed (optional)" value={fields.breed} onChange={set('breed')} className="h-9" />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Weight (optional)"
              value={fields.weight}
              onChange={set('weight')}
              className="h-9"
            />
            <Select value={fields.weightUnit} onValueChange={(v) => setFields((f) => ({ ...f, weightUnit: v }))}>
              <SelectTrigger className="h-9 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lb">lb</SelectItem>
                <SelectItem value="kg">kg</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Select value={fields.sex} onValueChange={(v) => setFields((f) => ({ ...f, sex: v }))}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Sex (optional — leave unset to leave as-is)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="male">Male</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Vet name (optional)" value={fields.vetName} onChange={set('vetName')} className="h-9" />
        <Input placeholder="Clinic (optional)" value={fields.vetClinic} onChange={set('vetClinic')} className="h-9" />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Phone (optional)" value={fields.vetPhone} onChange={set('vetPhone')} className="h-9" />
          <Input placeholder="Address (optional)" value={fields.vetAddress} onChange={set('vetAddress')} className="h-9" />
        </div>
        <p className="text-xs text-muted-foreground">Blank fields are left as-is on the pet's profile — they won't be cleared.</p>
        <FormActions onCancel={onCancel} onSave={submit} saving={saving} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Select value={fields.category} onValueChange={(v) => setFields((f) => ({ ...f, category: v }))}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(REMINDER_CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={fields.dueDate} onChange={set('dueDate')} className="h-9" />
      </div>
      <Input placeholder="Title" value={fields.title} onChange={set('title')} className="h-9" />
      <Textarea placeholder="Note (optional)" value={fields.note} onChange={set('note')} className="min-h-[70px] resize-none" />
      <FormActions onCancel={onCancel} onSave={submit} saving={saving} />
    </div>
  );
}

export default function SmartUpload() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<number, boolean>>({});
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [openingDocId, setOpeningDocId] = useState<number | null>(null);
  // Set only for the pet-name-mismatch upload failure, which gets a centered
  // dialog instead of a toast — it's the one failure that means "you likely
  // grabbed the wrong file for this pet," worth more than a corner notification
  // that's easy to miss. Every other upload failure keeps using toast().
  const [nameMismatchMessage, setNameMismatchMessage] = useState<string | null>(null);

  const invalidate = () => {
    if (activePetId) {
      queryClient.invalidateQueries({ queryKey: getListDocumentImportsQueryKey(activePetId) });
      // An accepted item can change the pet row itself (e.g. a vet-info
      // update) — without these, the profile/dashboard kept showing stale
      // data until an unrelated refetch happened to occur.
      queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(activePetId) });
      queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    }
  };

  const { data, isLoading } = useListDocumentImports(activePetId!, {
    query: {
      enabled: !!activePetId,
      queryKey: activePetId ? getListDocumentImportsQueryKey(activePetId) : ['no-pet', 'document-imports'],
    },
  });

  const uploadMutation = useCreateDocumentImport({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: 'Document analyzed', description: 'Review the proposed items below.' });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.data && 'code' in error.data && error.data.code === 'pet_name_mismatch') {
          setNameMismatchMessage(error.data.error);
          return;
        }
        toast({ title: "Couldn't analyze document", description: error.message, variant: 'destructive' });
      },
    },
  });

  const acceptMutation = useAcceptDocumentImportItem({
    mutation: {
      onSuccess: () => invalidate(),
      onError: (error) => toast({ title: "Couldn't accept item", description: error.message, variant: 'destructive' }),
      onSettled: () => setBusyItemId(null),
    },
  });

  const rejectMutation = useRejectDocumentImportItem({
    mutation: {
      onSuccess: () => invalidate(),
      onError: (error) => toast({ title: "Couldn't reject item", description: error.message, variant: 'destructive' }),
      onSettled: () => setBusyItemId(null),
    },
  });

  if (!activePetId) {
    return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File is too large', description: 'Maximum size is 10MB.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    uploadMutation.mutate(
      { petId: activePetId, data: { file } },
      { onSettled: () => { if (fileInputRef.current) fileInputRef.current.value = ''; } },
    );
  };

  const handleViewSource = async (imp: DocumentImport) => {
    // Open the tab synchronously within the click gesture so browsers don't
    // treat the post-await redirect as a blocked popup.
    const tab = window.open('', '_blank', 'noopener,noreferrer');
    setOpeningDocId(imp.id);
    try {
      const { url } = await getDocumentImportDocumentUrl(activePetId, imp.id);
      if (tab) tab.location.href = url;
    } catch {
      tab?.close();
      toast({ title: 'Error', description: 'Failed to open the document.', variant: 'destructive' });
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleAccept = (imp: DocumentImport, item: DocumentImportItem, proposedData?: Record<string, unknown>) => {
    setBusyItemId(item.id);
    setEditingItemId(null);
    acceptMutation.mutate({ petId: activePetId, importId: imp.id, itemId: item.id, data: proposedData ? { proposedData } : undefined });
  };

  const handleReject = (imp: DocumentImport, item: DocumentImportItem) => {
    setBusyItemId(item.id);
    rejectMutation.mutate({ petId: activePetId, importId: imp.id, itemId: item.id });
  };

  const handleAcceptAll = async (imp: DocumentImport) => {
    for (const item of imp.items.filter((i) => i.status === 'pending')) {
      setBusyItemId(item.id);
      try {
        await acceptMutation.mutateAsync({ petId: activePetId, importId: imp.id, itemId: item.id });
      } catch {
        // Individual failure already toasted by the mutation's onError — keep going with the rest.
      }
    }
    setBusyItemId(null);
  };

  const imports = data?.imports ?? [];
  const quota = data?.quota;

  return (
    <>
    <div className="p-6 md:p-10 max-w-4xl mx-auto pb-16">
      <div className="mb-6">
        <h1 className="font-serif text-[34px] font-extrabold tracking-tight">Vet reports you've sent us</h1>
        <p className="mt-1 text-[16.5px] text-muted-foreground">
          Drop in a PDF or photo and we'll pull out the records, medicines and reminders for you to check.
        </p>
      </div>

      <div className="mb-6 bg-card border-2 border-dashed border-border rounded-3xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-accent text-primary flex items-center justify-center mx-auto mb-4">
          <UploadCloud size={28} />
        </div>
        <div className="font-serif text-xl font-extrabold">Drop a vet report here</div>
        <p className="text-sm text-muted-foreground mt-1.5 mb-4">PDF or photo, up to 10MB and 20 pages. Scans without text won't work.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          onChange={handleFileSelect}
          className="hidden"
          id="smart-upload-file"
        />
        <label
          htmlFor="smart-upload-file"
          className={cn(
            'inline-flex items-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors cursor-pointer',
            uploadMutation.isPending && 'pointer-events-none opacity-70',
          )}
        >
          {uploadMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {uploadMutation.isPending ? 'Analyzing…' : 'Choose a file'}
        </label>

        {quota && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {quota.onboardingRemaining === null ? (
              <span>Onboarding window expired — monthly quota applies</span>
            ) : (
              <span><strong className="text-foreground">{quota.onboardingRemaining} of {quota.onboardingLimit}</strong> free reads left (first 30 days)</span>
            )}
            <span><strong className="text-foreground">{quota.ongoingRemaining} of {quota.ongoingLimit}</strong> left this month</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-card/50 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-16 bg-card border-2 border-dashed border-border rounded-3xl">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <Sparkles size={28} />
          </div>
          <h3 className="font-serif text-xl font-extrabold mb-2">No uploads yet</h3>
          <p className="text-muted-foreground">Upload a vet report above to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {imports.map((imp) => {
            const pendingItems = imp.items.filter((i) => i.status === 'pending');
            const decidedItems = imp.items.filter((i) => i.status !== 'pending');
            const acceptedCount = decidedItems.filter((i) => i.status === 'accepted').length;
            const rejectedCount = decidedItems.filter((i) => i.status === 'rejected').length;
            const duplicateCount = pendingItems.filter((i) => i.duplicateOfType).length;
            const defaultCollapsed = imp.status === 'reviewed';
            const collapsed = collapsedOverrides[imp.id] ?? defaultCollapsed;
            const failed = pendingItems.length === 0 && decidedItems.length === 0 && imp.status !== 'reviewed';

            return (
              <div key={imp.id} className={cn('bg-card border rounded-3xl p-5', failed ? 'border-destructive/30' : 'border-border')}>
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
                      failed ? 'bg-destructive/10 text-destructive' : imp.status === 'reviewed' ? 'bg-accent text-primary' : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {failed ? <AlertTriangle size={20} /> : imp.status === 'reviewed' ? <Check size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[16.5px] font-bold truncate">{imp.documentName}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {failed ? (
                        "We couldn't read this one — it may be a photo of a page rather than a text PDF. This didn't use up one of your reads."
                      ) : imp.status === 'reviewed' ? (
                        `All done · ${acceptedCount} saved to their file${rejectedCount ? `, ${rejectedCount} you said no to` : ''}`
                      ) : (
                        <>
                          Read {format(new Date(imp.analyzedAt), 'MMM d')} at {format(new Date(imp.analyzedAt), 'h:mm a')} · {pendingItems.length} thing{pendingItems.length === 1 ? '' : 's'} still to check
                          {duplicateCount > 0 ? ` · ${duplicateCount} might be a duplicate` : ''}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!failed && (
                      <button
                        onClick={() => handleViewSource(imp)}
                        disabled={openingDocId === imp.id}
                        className="h-9 px-3 text-sm font-bold text-primary flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {openingDocId === imp.id ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} Source
                      </button>
                    )}
                    {pendingItems.length > 1 && (
                      <button
                        onClick={() => handleAcceptAll(imp)}
                        className="h-9 px-4 text-sm font-bold rounded-full bg-accent text-primary hover:bg-accent/70 transition-colors"
                      >
                        Accept all
                      </button>
                    )}
                    {failed ? (
                      <button className="h-9 px-4 text-sm font-bold rounded-full border border-border hover:bg-accent transition-colors">Try again</button>
                    ) : (
                      pendingItems.length > 0 && (
                        <button
                          onClick={() => setCollapsedOverrides((o) => ({ ...o, [imp.id]: !collapsed }))}
                          aria-label={collapsed ? 'Expand' : 'Collapse'}
                          className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent transition-colors"
                        >
                          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {!collapsed && (pendingItems.length > 0 || decidedItems.length > 0) && (
                  <div className="mt-4 space-y-3">
                    {pendingItems.map((item, idx) => {
                      const Icon = ITEM_TYPE_META[item.itemType].icon;
                      const isEditing = editingItemId === item.id;
                      const isBusy = busyItemId === item.id;
                      return (
                        <div key={item.id} className="border border-border rounded-2xl p-4">
                          {pendingItems.length > 1 && (
                            <div className="text-xs font-bold text-muted-foreground mb-2">Step {idx + 1} of {pendingItems.length}</div>
                          )}
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0">
                              <Icon size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                  {ITEM_TYPE_META[item.itemType].label}
                                </span>
                                {item.duplicateOfType && (
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
                                    <AlertTriangle size={11} /> Might already be in the file
                                  </span>
                                )}
                              </div>
                              {isEditing ? (
                                <ItemEditForm
                                  item={item}
                                  saving={isBusy}
                                  onCancel={() => setEditingItemId(null)}
                                  onSave={(editedData) => handleAccept(imp, item, editedData)}
                                />
                              ) : (
                                <>
                                  <ItemSummary item={item} />
                                  {item.duplicateOfType && (
                                    <p className="mt-2 text-xs text-muted-foreground">You already have one saved — compare them in their file.</p>
                                  )}
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => handleAccept(imp, item)}
                                      disabled={isBusy}
                                      className="h-10 flex items-center gap-1.5 px-4 text-sm font-bold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                                    >
                                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Yes, save it
                                    </button>
                                    <button
                                      onClick={() => setEditingItemId(item.id)}
                                      disabled={isBusy}
                                      className="h-10 flex items-center gap-1.5 px-4 text-sm font-bold rounded-full border border-border hover:bg-accent disabled:opacity-60 transition-colors"
                                    >
                                      <Pencil size={14} /> Change something
                                    </button>
                                    <button
                                      onClick={() => handleReject(imp, item)}
                                      disabled={isBusy}
                                      className="h-10 flex items-center gap-1.5 px-4 text-sm font-bold rounded-full border border-border text-destructive hover:bg-destructive/10 disabled:opacity-60 transition-colors"
                                    >
                                      <X size={14} /> No thanks
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {decidedItems.length > 0 && (
                      <div className="pt-1 space-y-2">
                        {decidedItems.map((item) => {
                          const Icon = ITEM_TYPE_META[item.itemType].icon;
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent/40 text-sm text-muted-foreground">
                              <Icon size={14} className="shrink-0" />
                              <span className="flex-1 truncate">{ITEM_TYPE_META[item.itemType].label}</span>
                              <span
                                className={cn(
                                  'text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0',
                                  item.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
                                )}
                              >
                                {item.status === 'accepted' ? 'Accepted' : 'Rejected'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

    <AlertDialog open={!!nameMismatchMessage} onOpenChange={(open) => !open && setNameMismatchMessage(null)}>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500 shrink-0" />
            Wrong pet's report?
          </AlertDialogTitle>
          <AlertDialogDescription>{nameMismatchMessage}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="rounded-full" onClick={() => setNameMismatchMessage(null)}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
