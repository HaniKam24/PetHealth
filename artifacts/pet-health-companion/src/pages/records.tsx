import { usePetContext } from '@/context/pet-context';
import {
  useListHealthRecords,
  getListHealthRecordsQueryKey,
  useCreateHealthRecord,
  useUpdateHealthRecord,
  useDeleteHealthRecord,
  useUploadHealthRecordDocument,
  getHealthRecordDocumentUrl,
  useListSymptomLogs,
  getListSymptomLogsQueryKey,
  useListPets,
  getGetPetVaccinesQueryKey,
  type HealthRecord,
} from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { format, parseISO } from 'date-fns';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, FileText, Syringe, Stethoscope, TestTube, Activity, X, Pencil, Trash2, Paperclip, Link2, Upload, Loader2, ClipboardList } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const recordSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['visit', 'vaccine', 'lab', 'procedure', 'note']),
  date: z.string().min(1, 'Date is required'),
  clinic: z.string().optional(),
  summary: z.string().optional(),
});

type RecordFormValues = z.infer<typeof recordSchema>;

const EMPTY_RECORD: RecordFormValues = {
  title: '',
  type: 'visit',
  date: new Date().toISOString().split('T')[0],
  clinic: '',
  summary: '',
};

const iconMap = {
  visit: Stethoscope,
  vaccine: Syringe,
  lab: TestTube,
  procedure: Activity,
  note: FileText,
};

const TYPE_LABELS: Record<RecordFormValues['type'], string> = {
  visit: 'Visit',
  vaccine: 'Jab',
  lab: 'Test',
  procedure: 'Procedure',
  note: 'My note',
};

const RECORD_TYPES = Object.keys(TYPE_LABELS) as RecordFormValues['type'][];

export default function Records() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RecordFormValues['type'] | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<HealthRecord | null>(null);
  const [attachMode, setAttachMode] = useState<'link' | 'upload'>('link');
  const [documentUrl, setDocumentUrl] = useState('');
  // Storage path from an upload this session — never the record's existing
  // path, which isn't exposed to the client (only a fresh signed URL is,
  // fetched on demand via handleViewDocument).
  const [documentPath, setDocumentPath] = useState('');
  const [documentName, setDocumentName] = useState('');
  // Only true once the owner actually touches the attachment control this
  // edit session — lets onSubmit omit document* fields entirely when
  // untouched, so an unrelated edit (e.g. fixing a typo in notes) never
  // clears an existing attachment whose real value isn't loaded into state.
  const [documentChanged, setDocumentChanged] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: pets } = useListPets();
  const activePet = pets?.find((p) => p.id === activePetId);

  const { data: records, isLoading } = useListHealthRecords(
    activePetId!,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getListHealthRecordsQueryKey(activePetId) : ['no-pet', 'records']
      }
    }
  );

  const { data: symptomLogs } = useListSymptomLogs(
    activePetId!,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getListSymptomLogsQueryKey(activePetId) : ['no-pet', 'symptom-logs']
      }
    }
  );

  const invalidateRecords = () => {
    if (activePetId) {
      queryClient.invalidateQueries({ queryKey: getListHealthRecordsQueryKey(activePetId) });
      // A record of type "vaccine" can change which vaccines are current/
      // overdue — cheaper to always invalidate than to check the type here.
      queryClient.invalidateQueries({ queryKey: getGetPetVaccinesQueryKey(activePetId) });
    }
  };

  const closeDialog = () => {
    setIsNewOpen(false);
    setEditingRecord(null);
    setAttachMode('link');
    setDocumentUrl('');
    setDocumentPath('');
    setDocumentName('');
    setDocumentChanged(false);
    form.reset(EMPTY_RECORD);
  };

  const createRecord = useCreateHealthRecord({
    mutation: {
      onSuccess: () => {
        invalidateRecords();
        closeDialog();
        toast({ title: "Record added", description: "Health record has been saved successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save record.", variant: "destructive" });
      }
    }
  });

  const updateRecord = useUpdateHealthRecord({
    mutation: {
      onSuccess: () => {
        invalidateRecords();
        closeDialog();
        toast({ title: "Record updated", description: "Your changes have been saved." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update record.", variant: "destructive" });
      }
    }
  });

  const deleteRecord = useDeleteHealthRecord({
    mutation: {
      onSuccess: () => {
        invalidateRecords();
        setDeletingRecord(null);
        toast({ title: "Record deleted" });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
      }
    }
  });

  const uploadDocument = useUploadHealthRecordDocument({
    mutation: {
      onSuccess: (result) => {
        setDocumentPath(result.path);
        setDocumentName(result.name);
        setDocumentChanged(true);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to upload the file.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  });

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: EMPTY_RECORD,
  });

  useEffect(() => {
    if (editingRecord) {
      form.reset({
        title: editingRecord.title,
        type: editingRecord.type,
        date: editingRecord.date.split('T')[0],
        clinic: editingRecord.clinic || '',
        summary: editingRecord.summary || '',
      });
      setAttachMode(editingRecord.documentType === 'upload' ? 'upload' : 'link');
      setDocumentUrl(editingRecord.documentType === 'link' ? editingRecord.documentUrl || '' : '');
      setDocumentPath('');
      setDocumentName(editingRecord.documentType === 'upload' ? editingRecord.documentName || '' : '');
      setDocumentChanged(false);
    }
  }, [editingRecord, form]);

  if (!activePetId) {
    return <div className="p-10 text-center text-muted-foreground mt-20">Please select or add a pet first.</div>;
  }

  const hasActiveFilters = Boolean(search || typeFilter !== 'all' || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const filteredRecords = records?.filter(r => {
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      r.title.toLowerCase().includes(query) ||
      r.summary?.toLowerCase().includes(query) ||
      r.clinic?.toLowerCase().includes(query);
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    // r.date is an ISO "YYYY-MM-DD" string — lexicographic comparison works directly.
    const matchesDateFrom = !dateFrom || r.date >= dateFrom;
    const matchesDateTo = !dateTo || r.date <= dateTo;
    return matchesSearch && matchesType && matchesDateFrom && matchesDateTo;
  // r.date is an ISO "YYYY-MM-DD" string — lexicographic comparison sorts it correctly
  // without going through Date at all, which would parse it as UTC midnight and risk an
  // off-by-one day shift when compared against other timezone-aware values.
  }).sort((a, b) => b.date.localeCompare(a.date)) || [];

  // Group already-sorted (desc) records by calendar year, for the mockup's
  // year-header treatment — a pure display grouping, filtering/sort untouched.
  const recordsByYear: { year: string; records: HealthRecord[] }[] = [];
  for (const record of filteredRecords) {
    const year = record.date.slice(0, 4);
    const bucket = recordsByYear[recordsByYear.length - 1];
    if (bucket && bucket.year === year) bucket.records.push(record);
    else recordsByYear.push({ year, records: [record] });
  }

  const isDialogOpen = isNewOpen || !!editingRecord;
  const isSaving = createRecord.isPending || updateRecord.isPending;

  const onSubmit = (data: RecordFormValues) => {
    // Omit document* fields entirely when the attachment wasn't touched this
    // session (edit only) — a PATCH with these keys absent leaves the
    // existing attachment untouched, rather than clearing it using empty
    // client-side state that was never loaded with the real value.
    const documentFields =
      !editingRecord || documentChanged
        ? attachMode === 'link'
          ? {
              documentUrl: documentUrl || null,
              documentType: (documentUrl ? 'link' : null) as 'link' | null,
              documentStoragePath: null,
              documentName: null,
            }
          : {
              documentStoragePath: documentPath || null,
              documentType: (documentPath ? 'upload' : null) as 'upload' | null,
              documentName: documentPath ? documentName || null : null,
              documentUrl: null,
            }
        : {};
    const payload = { ...data, ...documentFields };
    if (editingRecord) {
      updateRecord.mutate({ petId: activePetId, recordId: editingRecord.id, data: payload });
    } else {
      createRecord.mutate({ petId: activePetId, data: payload });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File is too large", description: "Maximum size is 10MB.", variant: "destructive" });
      e.target.value = '';
      return;
    }
    uploadDocument.mutate({ petId: activePetId, data: { file } });
  };

  const handleViewDocument = async (record: HealthRecord) => {
    if (openingDocumentId) return;
    // Open the tab synchronously within the click gesture so browsers don't
    // treat the post-await redirect as a blocked popup.
    const tab = window.open('', '_blank', 'noopener,noreferrer');
    setOpeningDocumentId(record.id);
    try {
      const { url } = await getHealthRecordDocumentUrl(activePetId!, record.id);
      if (tab) tab.location.href = url;
    } catch {
      tab?.close();
      toast({ title: "Error", description: "Failed to open the document.", variant: "destructive" });
    } finally {
      setOpeningDocumentId(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto pb-16">
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="font-serif text-[34px] font-extrabold tracking-tight">{activePet ? `${activePet.name}'s file` : 'Health records'}</h1>
          <p className="mt-1 text-[16.5px] text-muted-foreground">
            Every visit, jab, test and note you've saved{records ? ` — ${records.length} in total` : ''}.
          </p>
        </div>
        <button
          onClick={() => setIsNewOpen(true)}
          className="h-[46px] shrink-0 flex items-center gap-2 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors"
        >
          <Plus size={17} /> Add a record
        </button>
      </div>

      <div className="mb-4 relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground">
          <Search size={18} />
        </div>
        <input
          type="search"
          placeholder={`Search ${activePet?.name ?? "your pet"}'s file`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-primary text-[15px] text-foreground"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter('all')}
          className={cn(
            'h-11 px-4 rounded-full text-sm font-bold transition-colors',
            typeFilter === 'all' ? 'bg-foreground text-background' : 'bg-card border border-border text-foreground hover:bg-accent',
          )}
        >
          Everything
        </button>
        {RECORD_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={cn(
              'h-11 px-4 rounded-full text-sm font-semibold transition-colors',
              typeFilter === type ? 'bg-foreground text-background' : 'bg-card border border-border text-foreground hover:bg-accent',
            )}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}

        <div className="flex items-center gap-1.5 ml-auto text-sm">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-2.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {symptomLogs && symptomLogs.length > 0 && (
        <div className="mb-6 bg-card border border-border rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-accent text-primary flex items-center justify-center shrink-0">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="font-serif text-lg font-extrabold">Symptom log</h3>
              <p className="text-sm text-muted-foreground">Noted from AI chat conversations.</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {[...symptomLogs]
              .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
              .map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-4 bg-background border border-border/60 rounded-2xl px-4 py-3">
                  <p className="text-foreground/90 leading-relaxed text-sm">{log.description}</p>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap pt-0.5">
                    {format(new Date(log.loggedAt), 'MMM d, yyyy')}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card/50 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-16 bg-card border-2 border-dashed border-border rounded-3xl">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <FileText size={28} />
          </div>
          <h3 className="font-serif text-xl font-extrabold mb-2">No records found</h3>
          <p className="text-muted-foreground">
            {hasActiveFilters ? "No records match your search or filters." : "Start building a health history."}
          </p>
          <button
            onClick={() => (hasActiveFilters ? clearFilters() : setIsNewOpen(true))}
            className="mt-5 text-primary font-bold hover:underline"
          >
            {hasActiveFilters ? 'Clear filters' : 'Add their first record'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {recordsByYear.map(({ year, records: yearRecords }) => (
            <div key={year}>
              <div className="font-serif text-sm font-extrabold tracking-wide text-muted-foreground mb-2.5">{year}</div>
              <div className="bg-card border border-border rounded-3xl overflow-hidden">
                {yearRecords.map((record, i) => {
                  const Icon = iconMap[record.type] || FileText;
                  return (
                    <div
                      key={record.id}
                      className={cn('flex items-center gap-4 p-5 group', i > 0 && 'border-t border-border')}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-accent text-primary flex items-center justify-center shrink-0">
                        <Icon size={21} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16.5px] font-bold truncate">{record.title}</div>
                        {record.summary && <div className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{record.summary}</div>}
                      </div>
                      <span className="hidden sm:inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-background text-muted-foreground shrink-0">
                        {TYPE_LABELS[record.type]}
                      </span>
                      <span className="hidden md:block w-36 shrink-0 text-sm text-muted-foreground text-right">
                        {format(parseISO(record.date), 'MMM d')}{record.clinic ? ` · ${record.clinic}` : ''}
                      </span>
                      {(record.documentType === 'upload' || (record.documentType === 'link' && record.documentUrl)) && (
                        <button
                          type="button"
                          onClick={() => handleViewDocument(record)}
                          disabled={openingDocumentId === record.id}
                          className="hidden lg:flex items-center gap-1.5 text-sm font-bold text-primary shrink-0 disabled:opacity-60"
                        >
                          {openingDocumentId === record.id ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                          {record.documentType === 'upload' ? (record.documentName || 'File') : 'Link'}
                        </button>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => setEditingRecord(record)}
                          aria-label="Edit record"
                          className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingRecord(record)}
                          aria-label="Delete record"
                          className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-extrabold">{editingRecord ? 'Edit this record' : `Add to ${activePet?.name ?? "their"} file`}</DialogTitle>
            <DialogDescription>
              {editingRecord ? 'Update the details of this record.' : 'A visit, a jab, a test result, or just something you noticed.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What kind of thing is it?</FormLabel>
                    <div className="grid grid-cols-5 gap-2">
                      {RECORD_TYPES.map((type) => {
                        const Icon = iconMap[type];
                        const selected = field.value === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => field.onChange(type)}
                            className={cn(
                              'flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-colors',
                              selected ? 'border-primary bg-accent text-primary' : 'border-border text-muted-foreground hover:bg-accent/50',
                            )}
                          >
                            <Icon size={19} />
                            <span className="text-xs font-bold">{TYPE_LABELS[type]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Give it a title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Annual checkup, rabies vaccine…" className="h-12 rounded-2xl bg-accent/40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>When was it?</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-12 rounded-2xl bg-accent/40" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clinic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Where? (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Harbor Veterinary Clinic" className="h-12 rounded-2xl bg-accent/40" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What happened? (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any details about the visit, recommendations, or how they're feeling…"
                        className="min-h-[110px] resize-none rounded-2xl bg-accent/40"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2.5">
                <label className="text-sm font-bold leading-none">Attach the paperwork (optional)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachMode('link')}
                    className={cn(
                      'flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold border transition-colors',
                      attachMode === 'link' ? 'bg-accent border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <Link2 size={14} /> Paste a link
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachMode('upload')}
                    className={cn(
                      'flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold border transition-colors',
                      attachMode === 'upload' ? 'bg-accent border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <Upload size={14} /> Upload a file
                  </button>
                </div>

                {attachMode === 'link' ? (
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={documentUrl}
                    onChange={(e) => {
                      setDocumentUrl(e.target.value);
                      setDocumentChanged(true);
                    }}
                    className="h-12 rounded-2xl bg-accent/40"
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="record-document-upload"
                    />
                    <label
                      htmlFor="record-document-upload"
                      className="flex items-center gap-2 px-4 h-10 rounded-full border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                    >
                      {uploadDocument.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploadDocument.isPending ? 'Uploading…' : 'Choose file'}
                    </label>
                    {documentName && !uploadDocument.isPending && (
                      <span className="flex items-center gap-1.5 text-sm text-foreground">
                        <Paperclip size={14} className="text-muted-foreground" />
                        {documentName}
                        <button
                          type="button"
                          onClick={() => {
                            setDocumentPath('');
                            setDocumentName('');
                            setDocumentChanged(true);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">A PDF or a photo, up to 10MB. Only you can open it.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="h-12 px-6 font-bold text-muted-foreground hover:bg-accent rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-12 px-7 bg-primary text-primary-foreground font-bold rounded-full hover:bg-primary/90 transition-colors shadow-md shadow-primary/25 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : editingRecord ? 'Save changes' : 'Save to their file'}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRecord} onOpenChange={(open) => !open && setDeletingRecord(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRecord && `"${deletingRecord.title}" will be permanently removed. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRecord.isPending}
              onClick={() => {
                if (deletingRecord) {
                  deleteRecord.mutate({ petId: activePetId, recordId: deletingRecord.id });
                }
              }}
            >
              {deleteRecord.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
