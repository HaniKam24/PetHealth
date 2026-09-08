import { useRef, useState } from 'react';
import { usePetContext } from '@/context/pet-context';
import {
  useListDocumentImports,
  getListDocumentImportsQueryKey,
  useCreateDocumentImport,
  useAcceptDocumentImportItem,
  useRejectDocumentImportItem,
  getDocumentImportDocumentUrl,
  type DocumentImport,
  type DocumentImportItem,
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Upload,
  Loader2,
  FileText,
  Pill,
  Bell,
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
  health_record: { label: 'Health Record', icon: FileText },
  medication: { label: 'Medication', icon: Pill },
  reminder: { label: 'Reminder', icon: Bell },
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
      <div>
        <div className="font-medium">{str(d.title)}</div>
        <div className="text-sm text-muted-foreground">
          {RECORD_TYPE_LABELS[str(d.type)] ?? str(d.type)} · {str(d.date).slice(0, 10)}
          {d.clinic ? ` · ${str(d.clinic)}` : ''}
        </div>
        {d.summary ? <p className="text-sm text-muted-foreground mt-1">{str(d.summary)}</p> : null}
      </div>
    );
  }
  if (item.itemType === 'medication') {
    return (
      <div>
        <div className="font-medium">{str(d.name)}</div>
        <div className="text-sm text-muted-foreground">
          {str(d.dose)} · {str(d.frequency)}
          {d.doseIntervalValue ? ` · every ${num(d.doseIntervalValue)} ${str(d.doseIntervalUnit)}` : ''}
        </div>
        {d.instructions ? <p className="text-sm text-muted-foreground mt-1">{str(d.instructions)}</p> : null}
      </div>
    );
  }
  return (
    <div>
      <div className="font-medium">{str(d.title)}</div>
      <div className="text-sm text-muted-foreground">
        {REMINDER_CATEGORY_LABELS[str(d.category)] ?? str(d.category)} · due {str(d.dueDate).slice(0, 10)}
      </div>
      {d.note ? <p className="text-sm text-muted-foreground mt-1">{str(d.note)}</p> : null}
    </div>
  );
}

function FormActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-accent transition-colors">
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
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

  const invalidate = () => {
    if (activePetId) {
      queryClient.invalidateQueries({ queryKey: getListDocumentImportsQueryKey(activePetId) });
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
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <PageHeader
        title="Smart Document Upload"
        description="Upload a vet report and let AI propose records, medications, and reminders for you to review."
      />

      {quota && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Onboarding imports</div>
            {quota.onboardingRemaining === null ? (
              <div className="text-sm text-muted-foreground pt-1">Window expired — ongoing quota applies</div>
            ) : (
              <div className="text-2xl font-serif">
                {quota.onboardingRemaining}{' '}
                <span className="text-sm text-muted-foreground font-sans">of {quota.onboardingLimit} left (first 30 days)</span>
              </div>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Ongoing imports (this month)</div>
            <div className="text-2xl font-serif">
              {quota.ongoingRemaining} <span className="text-sm text-muted-foreground font-sans">of {quota.ongoingLimit} left</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 bg-card border-2 border-dashed border-border rounded-3xl p-8 text-center">
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
            'inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all active:scale-95 cursor-pointer',
            uploadMutation.isPending && 'pointer-events-none opacity-70',
          )}
        >
          {uploadMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
          {uploadMutation.isPending ? 'Analyzing…' : 'Upload a vet report'}
        </label>
        <p className="text-sm text-muted-foreground mt-3">PDF or image, up to 10MB and 20 pages.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-card/50 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-20 bg-card border-2 border-dashed border-border rounded-3xl">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <Sparkles size={28} />
          </div>
          <h3 className="text-xl font-serif mb-2">No uploads yet</h3>
          <p className="text-muted-foreground">Upload a vet report above to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {imports.map((imp) => {
            const pendingItems = imp.items.filter((i) => i.status === 'pending');
            const decidedItems = imp.items.filter((i) => i.status !== 'pending');
            const defaultCollapsed = imp.status === 'reviewed';
            const collapsed = collapsedOverrides[imp.id] ?? defaultCollapsed;

            return (
              <div key={imp.id} className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText size={18} className="text-primary shrink-0" />
                      <span className="font-medium truncate">{imp.documentName}</span>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                          imp.status === 'reviewed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600',
                        )}
                      >
                        {imp.status === 'reviewed' ? 'Reviewed' : `${pendingItems.length} to review`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Analyzed {format(new Date(imp.analyzedAt), 'MMM d, yyyy · h:mm a')} ·{' '}
                      {imp.lane === 'onboarding' ? 'Onboarding' : 'Ongoing'} lane
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleViewSource(imp)}
                      disabled={openingDocId === imp.id}
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {openingDocId === imp.id ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} Source
                    </button>
                    {pendingItems.length > 1 && (
                      <button
                        onClick={() => handleAcceptAll(imp)}
                        className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        Accept all
                      </button>
                    )}
                    <button
                      onClick={() => setCollapsedOverrides((o) => ({ ...o, [imp.id]: !collapsed }))}
                      aria-label={collapsed ? 'Expand' : 'Collapse'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                    >
                      {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>

                {!collapsed && (
                  <div className="space-y-3">
                    {pendingItems.map((item) => {
                      const Icon = ITEM_TYPE_META[item.itemType].icon;
                      const isEditing = editingItemId === item.id;
                      const isBusy = busyItemId === item.id;
                      return (
                        <div key={item.id} className="border border-border rounded-2xl p-4 bg-background">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
                              <Icon size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                {ITEM_TYPE_META[item.itemType].label}
                              </div>
                              {item.duplicateOfType && (
                                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-500/10 rounded-lg px-2 py-1 mb-2 w-fit">
                                  <AlertTriangle size={12} /> Possible duplicate of an existing{' '}
                                  {ITEM_TYPE_META[item.duplicateOfType].label.toLowerCase()}
                                </div>
                              )}
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
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => handleAccept(imp, item)}
                                      disabled={isBusy}
                                      className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                                    >
                                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Accept
                                    </button>
                                    <button
                                      onClick={() => setEditingItemId(item.id)}
                                      disabled={isBusy}
                                      className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-60 transition-colors"
                                    >
                                      <Pencil size={14} /> Edit
                                    </button>
                                    <button
                                      onClick={() => handleReject(imp, item)}
                                      disabled={isBusy}
                                      className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60 transition-colors"
                                    >
                                      <X size={14} /> Reject
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
                            <div key={item.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-accent/40 text-sm text-muted-foreground">
                              <Icon size={14} className="shrink-0" />
                              <span className="flex-1 truncate">{ITEM_TYPE_META[item.itemType].label}</span>
                              <span
                                className={cn(
                                  'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
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

                    {pendingItems.length === 0 && decidedItems.length === 0 && (
                      <p className="text-sm text-muted-foreground">No items were proposed from this document.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
