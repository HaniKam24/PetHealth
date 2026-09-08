import { usePetContext } from '@/context/pet-context';
import {
  useListHealthRecords,
  getListHealthRecordsQueryKey,
  useCreateHealthRecord,
  useUpdateHealthRecord,
  useDeleteHealthRecord,
  useUploadHealthRecordDocument,
  getHealthRecordDocumentUrl,
  type HealthRecord,
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { format, parseISO } from 'date-fns';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, FileText, Syringe, Stethoscope, TestTube, Activity, X, Pencil, Trash2, Paperclip, Link2, Upload, Loader2 } from 'lucide-react';
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
  visit: 'Vet Visit',
  vaccine: 'Vaccine',
  lab: 'Lab Results',
  procedure: 'Procedure',
  note: 'Observation Note',
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

  const { data: records, isLoading } = useListHealthRecords(
    activePetId!,
    {
      query: {
        enabled: !!activePetId,
        queryKey: activePetId ? getListHealthRecordsQueryKey(activePetId) : ['no-pet', 'records']
      }
    }
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
    <div className="p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <PageHeader
        title="Health Records"
        description="A complete history of care, visits, and notes."
        action={
          <button
            onClick={() => setIsNewOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus size={20} /> Add Record
          </button>
        }
      />

      <div className="mb-4 relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
          <Search size={20} />
        </div>
        <input
          type="search"
          placeholder="Search records by title, clinic, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm text-foreground transition-all"
        />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as RecordFormValues['type'] | 'all')}>
          <SelectTrigger className="h-11 w-full sm:w-48 bg-card border-border">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {RECORD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{TYPE_LABELS[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground shrink-0">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-11 px-3 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground shrink-0">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-11 px-3 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            <X size={16} /> Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-card/50 border border-border rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-20 bg-card border-2 border-dashed border-border rounded-3xl">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <FileText size={28} />
          </div>
          <h3 className="text-xl font-serif mb-2">No records found</h3>
          <p className="text-muted-foreground">
            {hasActiveFilters ? "No records match your search or filters." : "Start building a health history for your pet."}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="mt-6 text-primary font-medium hover:underline"
            >
              Clear filters
            </button>
          ) : (
            <button
              onClick={() => setIsNewOpen(true)}
              className="mt-6 text-primary font-medium hover:underline"
            >
              Add their first record
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[2.25rem] md:before:ml-[2.75rem] before:-translate-x-px md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/80 before:to-transparent">
          {filteredRecords.map(record => {
            const Icon = iconMap[record.type] || FileText;
            return (
              <div key={record.id} className="relative flex items-start gap-6 group">
                <div className="absolute left-[2.25rem] md:left-[2.75rem] top-8 -ml-2 w-4 h-4 rounded-full bg-background border-2 border-primary z-10 group-hover:scale-125 transition-transform duration-300 shadow-sm" />

                <div className="w-16 md:w-20 pt-7 text-right shrink-0 relative z-10">
                  <span className="text-sm font-medium text-muted-foreground block">{format(parseISO(record.date), 'MMM d')}</span>
                  <span className="text-xs text-muted-foreground opacity-70 block">{format(parseISO(record.date), 'yyyy')}</span>
                </div>

                <div className="flex-1 bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md transition-all group-hover:border-primary/30">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div className="flex gap-4">
                      <div className="mt-1 w-12 h-12 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0">
                        <Icon size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium text-foreground mb-1 group-hover:text-primary transition-colors">{record.title}</h3>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80 bg-accent px-2 py-0.5 rounded-md">{TYPE_LABELS[record.type]}</span>
                          {record.clinic && (
                            <span className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-border inline-block"></span>
                              {record.clinic}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => setEditingRecord(record)}
                        aria-label="Edit record"
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingRecord(record)}
                        aria-label="Delete record"
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {record.summary && (
                    <p className="text-muted-foreground mt-4 leading-relaxed bg-background p-4 rounded-2xl border border-border/50">
                      {record.summary}
                    </p>
                  )}

                  {(record.documentType === 'upload' || (record.documentType === 'link' && record.documentUrl)) && (
                    <button
                      type="button"
                      onClick={() => handleViewDocument(record)}
                      disabled={openingDocumentId === record.id}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:opacity-60"
                    >
                      {openingDocumentId === record.id ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                      {record.documentType === 'upload' ? (record.documentName || 'View document') : 'View linked document'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editingRecord ? 'Edit Health Record' : 'Add Health Record'}</DialogTitle>
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
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                      attachMode === 'link' ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <Link2 size={14} /> Paste a link
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachMode('upload')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                      attachMode === 'upload' ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent'
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
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
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
                  className="px-6 py-3 font-medium text-foreground hover:bg-accent rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
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
