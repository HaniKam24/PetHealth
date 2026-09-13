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
  type HealthRecord,
} from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const recordSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['visit', 'vaccine', 'lab', 'procedure', 'note']),
  date: z.string().min(1, 'Date is required'),
  clinic: z.string().optional(),
  summary: z.string().optional(),
});

type RecordFormValues = z.infer<typeof recordSchema>;
type RecordType = RecordFormValues['type'];

const EMPTY_RECORD: RecordFormValues = {
  title: '',
  type: 'visit',
  date: new Date().toISOString().split('T')[0],
  clinic: '',
  summary: '',
};

const ICON_MAP: Record<RecordType, typeof Stethoscope> = {
  visit: Stethoscope,
  vaccine: Syringe,
  lab: TestTube,
  procedure: Activity,
  note: FileText,
};

const TYPE_LABELS: Record<RecordType, string> = {
  visit: 'Visit',
  vaccine: 'Jab',
  lab: 'Test',
  procedure: 'Procedure',
  note: 'My note',
};

const RECORD_TYPES = Object.keys(TYPE_LABELS) as RecordType[];

const FILTER_CHIPS: { value: RecordType | 'all'; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'visit', label: 'Visits' },
  { value: 'vaccine', label: 'Jabs' },
  { value: 'lab', label: 'Tests' },
  { value: 'procedure', label: 'Procedures' },
  { value: 'note', label: 'My notes' },
];

export default function Records() {
  const { activePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RecordType | 'all'>('all');
  const [showEarlierYears, setShowEarlierYears] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<HealthRecord | null>(null);
  const [attachMode, setAttachMode] = useState<'link' | 'upload'>('link');
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentPath, setDocumentPath] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentChanged, setDocumentChanged] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: records, isLoading } = useListHealthRecords(
    activePetId!,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getListHealthRecordsQueryKey(activePetId) : ['no-pet', 'records'],
      },
    },
  );

  const { data: symptomLogs } = useListSymptomLogs(
    activePetId!,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getListSymptomLogsQueryKey(activePetId) : ['no-pet', 'symptom-logs'],
      },
    },
  );

  const invalidateRecords = () => {
    if (activePetId) {
      queryClient.invalidateQueries({ queryKey: getListHealthRecordsQueryKey(activePetId) });
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
        toast({ title: 'Record added', description: 'Health record has been saved successfully.' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to save record.', variant: 'destructive' });
      },
    },
  });

  const updateRecord = useUpdateHealthRecord({
    mutation: {
      onSuccess: () => {
        invalidateRecords();
        closeDialog();
        toast({ title: 'Record updated', description: 'Your changes have been saved.' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
      },
    },
  });

  const deleteRecord = useDeleteHealthRecord({
    mutation: {
      onSuccess: () => {
        invalidateRecords();
        setDeletingRecord(null);
        toast({ title: 'Record deleted' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to delete record.', variant: 'destructive' });
      },
    },
  });

  const uploadDocument = useUploadHealthRecordDocument({
    mutation: {
      onSuccess: (result) => {
        setDocumentPath(result.path);
        setDocumentName(result.name);
        setDocumentChanged(true);
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to upload the file.', variant: 'destructive' });
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    },
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

  const hasActiveFilters = Boolean(search || typeFilter !== 'all');
  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
  };

  const filteredRecords = (records ?? [])
    .filter((r) => {
      const query = search.toLowerCase();
      const matchesSearch =
        !query ||
        r.title.toLowerCase().includes(query) ||
        r.summary?.toLowerCase().includes(query) ||
        r.clinic?.toLowerCase().includes(query);
      const matchesType = typeFilter === 'all' || r.type === typeFilter;
      return matchesSearch && matchesType;
    })
    // r.date is an ISO "YYYY-MM-DD" string — lexicographic comparison sorts it correctly
    // without going through Date at all, which would parse it as UTC midnight and risk an
    // off-by-one day shift when compared against other timezone-aware values.
    .sort((a, b) => b.date.localeCompare(a.date));

  const years = Array.from(new Set(filteredRecords.map((r) => r.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
  const visibleYears = showEarlierYears ? years : years.slice(0, 1);

  const isDialogOpen = isNewOpen || !!editingRecord;
  const isSaving = createRecord.isPending || updateRecord.isPending;

  const onSubmit = (data: RecordFormValues) => {
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
      toast({ title: 'File is too large', description: 'Maximum size is 10MB.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    uploadDocument.mutate({ petId: activePetId, data: { file } });
  };

  const handleViewDocument = async (record: HealthRecord) => {
    if (openingDocumentId) return;
    const tab = window.open('', '_blank', 'noopener,noreferrer');
    setOpeningDocumentId(record.id);
    try {
      const { url } = await getHealthRecordDocumentUrl(activePetId!, record.id);
      if (tab) tab.location.href = url;
    } catch {
      tab?.close();
      toast({ title: 'Error', description: 'Failed to open the document.', variant: 'destructive' });
    } finally {
      setOpeningDocumentId(null);
    }
  };

  return (
    <div className="px-6 md:px-10 py-9 pb-16 max-w-[1020px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">The file</h1>
          <p className="mt-2 text-base text-muted-foreground">
            {records ? `Every visit, jab, test and note you've saved — ${records.length} in total.` : 'A complete history of care, visits, and notes.'}
          </p>
        </div>
        <button
          onClick={() => setIsNewOpen(true)}
          className="h-[46px] shrink-0 flex items-center gap-2 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm shadow-primary/30 hover:bg-primary/90 transition-colors"
        >
          <Plus size={17} /> Add a record
        </button>
      </div>

      <div className="mb-6 flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <div className="absolute inset-y-0 left-0 pl-[18px] flex items-center pointer-events-none text-muted-foreground">
            <Search size={17} />
          </div>
          <input
            type="search"
            placeholder="Search the file"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-[15px] text-foreground transition-all"
          />
        </div>
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setTypeFilter(chip.value)}
            className={cn(
              'h-12 flex items-center px-[18px] rounded-full text-sm font-semibold whitespace-nowrap transition-colors',
              typeFilter === chip.value ? 'bg-foreground text-background' : 'bg-card border border-border text-foreground hover:border-primary/30',
            )}
          >
            {chip.label}
          </button>
        ))}
        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} /> Clear
          </button>
        )}
      </div>

      {symptomLogs && symptomLogs.length > 0 && (
        <div className="mb-6 bg-card border border-border rounded-[20px] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-muted text-primary flex items-center justify-center shrink-0">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="font-serif text-lg font-extrabold text-foreground">Symptom log</h3>
              <p className="text-sm text-muted-foreground">Symptoms noted from AI Health Assistant conversations.</p>
            </div>
          </div>
          <div className="space-y-3">
            {[...symptomLogs]
              .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
              .map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-4 bg-background border border-border/50 rounded-2xl px-4 py-3">
                  <p className="text-foreground/90 leading-relaxed">{log.description}</p>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap pt-0.5">
                    {format(new Date(log.loggedAt), 'MMM d, yyyy')}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card/50 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-20 bg-card border-2 border-dashed border-border rounded-[20px]">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <FileText size={28} />
          </div>
          <h3 className="font-serif text-xl font-extrabold mb-2">No records found</h3>
          <p className="text-muted-foreground">
            {hasActiveFilters ? 'No records match your search or filters.' : 'Start building a health history for your pet.'}
          </p>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className="mt-6 text-primary font-bold hover:underline">
              Clear filters
            </button>
          ) : (
            <button onClick={() => setIsNewOpen(true)} className="mt-6 text-primary font-bold hover:underline">
              Add their first record
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {visibleYears.map((year) => {
            const yearRecords = filteredRecords.filter((r) => r.date.startsWith(year));
            return (
              <div key={year}>
                <div className="font-serif text-sm font-extrabold tracking-widest text-muted-foreground mb-3">{year}</div>
                <div className="bg-card border border-border rounded-[20px] overflow-hidden">
                  {yearRecords.map((record, i) => {
                    const Icon = ICON_MAP[record.type] || FileText;
                    return (
                      <div
                        key={record.id}
                        className={cn('group flex items-center gap-[18px] px-5 py-[18px] flex-wrap md:flex-nowrap', i > 0 && 'border-t border-border/60')}
                      >
                        <div className="w-[46px] h-[46px] rounded-2xl bg-muted text-primary flex items-center justify-center shrink-0">
                          <Icon size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[17px] font-bold text-foreground">{record.title}</div>
                          {record.summary && <div className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{record.summary}</div>}
                        </div>
                        <span className="text-[13.5px] font-bold px-3 py-[5px] rounded-2xl bg-muted text-muted-foreground shrink-0">
                          {TYPE_LABELS[record.type]}
                        </span>
                        <span className="w-[150px] shrink-0 text-sm text-muted-foreground text-right">
                          {format(parseISO(record.date), 'MMM d')}{record.clinic ? ` · ${record.clinic}` : ''}
                        </span>
                        <div className="w-[130px] shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(record.documentType === 'upload' || (record.documentType === 'link' && record.documentUrl)) && (
                            <button
                              type="button"
                              onClick={() => handleViewDocument(record)}
                              disabled={openingDocumentId === record.id}
                              aria-label="View document"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-primary transition-colors disabled:opacity-60"
                            >
                              {openingDocumentId === record.id ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                            </button>
                          )}
                          <button
                            onClick={() => setEditingRecord(record)}
                            aria-label="Edit record"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingRecord(record)}
                            aria-label="Delete record"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!showEarlierYears && years.length > 1 && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowEarlierYears(true)}
                className="h-11 flex items-center px-[22px] rounded-full bg-card border border-border text-sm font-bold hover:border-primary/30 transition-colors"
              >
                Show {years[1]} and earlier
              </button>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editingRecord ? 'Edit record' : 'Add a record'}</DialogTitle>
            <DialogDescription>
              {editingRecord ? 'Update the details of this record.' : 'Log a new visit, vaccine, or observation.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Annual Checkup, Rabies Vaccine..." className="h-12 bg-accent/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Record Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 bg-accent/50">
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RECORD_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{TYPE_LABELS[type]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-12 bg-accent/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="clinic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinic / Vet (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Main Street Animal Hospital" className="h-12 bg-accent/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes / Summary (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any details about the visit, recommendations, or how they're feeling..."
                        className="min-h-[120px] resize-none bg-accent/50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <label className="text-sm font-medium leading-none">Attach a Document (Optional)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachMode('link')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                      attachMode === 'link' ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Link2 size={14} /> Paste a link
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachMode('upload')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                      attachMode === 'upload' ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent',
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
                    className="h-12 bg-accent/50"
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
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                    >
                      {uploadDocument.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploadDocument.isPending ? 'Uploading...' : 'Choose file'}
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
                <p className="text-xs text-muted-foreground">PDF or image, up to 10MB.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-6 py-3 font-bold text-foreground hover:bg-accent rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-3 bg-primary text-primary-foreground font-bold rounded-full hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingRecord ? 'Save Changes' : 'Save Record'}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRecord} onOpenChange={(open) => !open && setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRecord && `"${deletingRecord.title}" will be permanently removed. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRecord.isPending}
              onClick={() => {
                if (deletingRecord) {
                  deleteRecord.mutate({ petId: activePetId, recordId: deletingRecord.id });
                }
              }}
            >
              {deleteRecord.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
