import { usePetContext } from '@/context/pet-context';
import {
  useGetPet,
  getGetPetQueryKey,
  useUpdatePet,
  useCreatePet,
  useDeletePet,
  useUploadPetPhoto,
  useRemovePetPhoto,
  useGetShareLink,
  getGetShareLinkQueryKey,
  useCreateShareLink,
  useRevokeShareLink,
  getListPetsQueryKey,
  type Pet,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2, HeartPulse, Check, Camera, Loader2, Share2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';

const ALLOWED_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  species: z.enum(['dog', 'cat', 'bird', 'rabbit', 'other']),
  breed: z.string().optional().nullable(),
  sex: z.enum(['female', 'male', 'unknown']),
  birthDate: z.string().optional().nullable(),
  weight: z.coerce.number().optional().nullable(),
  weightUnit: z.enum(['lb', 'kg']),
  photoUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  vetName: z.string().optional().nullable(),
  vetClinic: z.string().optional().nullable(),
  vetPhone: z.string().optional().nullable(),
  vetAddress: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type BreedOption = {
  value: string;
  label: string;
};

const BREEDS_BY_SPECIES: Record<ProfileFormValues['species'], readonly BreedOption[]> = {
  dog: [
    'Mixed breed',
    'Labrador Retriever',
    'Golden Retriever',
    'German Shepherd',
    'French Bulldog',
    'Bulldog',
    'Poodle',
    'Beagle',
    'Rottweiler',
    'Dachshund',
    'Yorkshire Terrier',
    'Boxer',
    'Australian Shepherd',
    'Siberian Husky',
    'Great Dane',
    'Cavalier King Charles Spaniel',
    'Doberman Pinscher',
    'Cane Corso',
    'Miniature Schnauzer',
    'Shih Tzu',
    'Boston Terrier',
    'Pomeranian',
    'Havanese',
    'Bernese Mountain Dog',
    'Chihuahua',
    'Pug',
    'Cocker Spaniel',
    'Border Collie',
    'Maltese',
    'Akita',
    'Newfoundland',
    'Basset Hound',
    'Rhodesian Ridgeback',
    'Weimaraner',
    'Vizsla',
    'Australian Cattle Dog',
    'Jack Russell Terrier',
    'West Highland White Terrier',
    'Bichon Frise',
    'Mastiff',
    'Saint Bernard',
    'English Springer Spaniel',
    'Irish Setter',
    'Whippet',
    'Greyhound',
    'Papillon',
    'Shetland Sheepdog',
    'Collie',
    'Staffordshire Bull Terrier',
    'Other / Not listed',
  ].map((breed) => ({ value: breed, label: breed })),
  cat: [
    'Domestic Shorthair',
    'Domestic Longhair',
    'Domestic Medium Hair',
    'Mixed breed',
    'Abyssinian',
    'American Shorthair',
    'Bengal',
    'Birman',
    'British Shorthair',
    'Burmese',
    'Burmilla',
    'Chartreux',
    'Cornish Rex',
    'Devon Rex',
    'Egyptian Mau',
    'Himalayan',
    'Maine Coon',
    'Manx',
    'Norwegian Forest Cat',
    'Ocicat',
    'Oriental Shorthair',
    'Persian',
    'Ragdoll',
    'Russian Blue',
    'Savannah',
    'Scottish Fold',
    'Siamese',
    'Siberian',
    'Singapura',
    'Snowshoe',
    'Somali',
    'Sphynx',
    'Tonkinese',
    'Toyger',
    'Turkish Angora',
    'Other / Not listed',
  ].map((breed) => ({ value: breed, label: breed })),
  bird: [
    'Budgerigar / Parakeet',
    'Cockatiel',
    'African Grey Parrot',
    'Amazon Parrot',
    'Blue-and-Gold Macaw',
    'Scarlet Macaw',
    'Cockatoo',
    'Conure',
    'Eclectus Parrot',
    'Lovebird',
    'Finch',
    'Canary',
    'Dove',
    'Pigeon',
    'Quaker Parrot',
    'Parrotlet',
    'Mynah',
    'Chicken',
    'Duck',
    'Goose',
    'Other / Not listed',
  ].map((breed) => ({ value: breed, label: breed })),
  rabbit: [
    'Mixed breed',
    'American',
    'Angora',
    'Belgian Hare',
    'Beveren',
    'Britannia Petite',
    'Californian',
    'Champagne d’Argent',
    'Checkered Giant',
    'Chinchilla',
    'Dutch',
    'Dwarf Hotot',
    'English Lop',
    'English Spot',
    'Flemish Giant',
    'Holland Lop',
    'Jersey Wooly',
    'Lionhead',
    'Mini Lop',
    'Mini Rex',
    'Netherland Dwarf',
    'New Zealand',
    'Polish',
    'Rex',
    'Satin',
    'Silver Fox',
    'Other / Not listed',
  ].map((breed) => ({ value: breed, label: breed })),
  other: [
    'Mixed breed',
    'Unknown',
    'Other / Not listed',
  ].map((breed) => ({ value: breed, label: breed })),
};

// Standalone card, not part of the profile form — creating/revoking a link
// takes effect immediately, same reasoning as the delete-pet action, rather
// than being staged behind "Save changes".
function ShareLinkCard({ petId, petName }: { petId: number; petName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [endDate, setEndDate] = useState('');

  const { data: shareLink, isLoading } = useGetShareLink(petId, {
    query: { queryKey: getGetShareLinkQueryKey(petId) },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetShareLinkQueryKey(petId) });

  const createLink = useCreateShareLink({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEndDate('');
        toast({ title: 'Share link created' });
      },
      onError: (error) => toast({ title: "Couldn't create link", description: error.message, variant: 'destructive' }),
    },
  });

  const revokeLink = useRevokeShareLink({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: 'Share link revoked' });
      },
      onError: (error) => toast({ title: "Couldn't revoke link", description: error.message, variant: 'destructive' }),
    },
  });

  const handleCreate = () => {
    if (!endDate) return;
    createLink.mutate({ petId, data: { expiresAt: new Date(`${endDate}T23:59:59`).toISOString() } });
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink.url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: "Couldn't copy", description: 'Your browser blocked clipboard access.', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Share2 size={18} className="text-primary" />
        <div className="font-serif text-lg font-extrabold">Share care info with a sitter</div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        A read-only link with {petName}'s vet contact, active medications, and notes — no account needed to view it.
      </p>

      {isLoading ? null : shareLink ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareLink.url}
              className="flex-1 h-11 px-3.5 rounded-xl bg-accent/40 border border-border text-sm truncate"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="h-11 px-4 flex items-center gap-1.5 rounded-xl border border-border text-sm font-bold hover:bg-accent transition-colors shrink-0"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Active until {format(new Date(shareLink.expiresAt), 'MMMM d, yyyy')} ·{' '}
            {shareLink.lastViewedAt
              ? `last viewed ${format(new Date(shareLink.lastViewedAt), 'MMM d, h:mm a')}`
              : 'not yet opened'}
          </p>
          <button
            type="button"
            onClick={() => revokeLink.mutate({ petId })}
            disabled={revokeLink.isPending}
            className="self-start text-sm font-bold text-destructive hover:underline disabled:opacity-50"
          >
            Revoke link
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 px-3.5 rounded-xl bg-accent/40 border border-border text-sm"
            aria-label="Share link valid through"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!endDate || createLink.isPending}
            className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Create link
          </button>
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { activePetId, setActivePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  // wouter's useLocation() returns only the pathname, never the query
  // string — the "new=true" flag has to come from useSearch() instead.
  const isNew = new URLSearchParams(search).get('new') === 'true';

  const { data: pet, isLoading } = useGetPet(
    activePetId!,
    {
      query: {
        enabled: !!activePetId && !isNew,
        queryKey: activePetId ? getGetPetQueryKey(activePetId) : ['no-pet']
      }
    }
  );

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      species: 'dog',
      breed: '',
      sex: 'unknown',
      birthDate: '',
      weight: null,
      weightUnit: 'lb',
      photoUrl: '',
      notes: '',
      vetName: '',
      vetClinic: '',
      vetPhone: '',
      vetAddress: '',
    },
  });

  // Guarded by isDirty rather than a one-shot "have we ever synced" flag —
  // the latter meant that once this page had synced the form once, a pet
  // update accepted from *elsewhere* (e.g. a Smart Document Upload proposal
  // accepted from that page) never showed up here even though the
  // underlying query had genuinely refetched fresh data, because the form
  // was never told to re-read it. isDirty still protects an in-progress
  // edit from being clobbered by an unrelated background refetch.
  useEffect(() => {
    if (pet && !isNew && !form.formState.isDirty) {
      form.reset({
        name: pet.name,
        species: pet.species,
        breed: pet.breed || '',
        sex: pet.sex,
        birthDate: pet.birthDate ? pet.birthDate.split('T')[0] : '',
        weight: pet.weight,
        weightUnit: pet.weightUnit,
         photoUrl: pet.photoUrl?.startsWith('preset:') ? '' : pet.photoUrl || '',
        notes: pet.notes || '',
        vetName: pet.vetName || '',
        vetClinic: pet.vetClinic || '',
        vetPhone: pet.vetPhone || '',
        vetAddress: pet.vetAddress || '',
      });
    }
  }, [pet, isNew, form]);

  // Reset form when entering 'new' mode
  useEffect(() => {
    if (isNew) {
      form.reset({
        name: '', species: 'dog', breed: '', sex: 'unknown', birthDate: '',
        weight: null, weightUnit: 'lb', photoUrl: '', notes: '',
        vetName: '', vetClinic: '', vetPhone: '', vetAddress: '',
      });
    }
  }, [isNew, form]);


  const updatePet = useUpdatePet({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(data.id) });
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        toast({ title: "Profile updated successfully" });
      },
      onError: (error) => {
        toast({ title: "Couldn't save changes", description: error.message, variant: "destructive" });
      },
    }
  });

  const createPet = useCreatePet({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        setActivePetId(data.id);
        setLocation('/profile');
        toast({ title: "Welcome to the family!", description: `${data.name} has been added.` });
      },
      onError: (error) => {
        toast({ title: "Couldn't add pet", description: error.message, variant: "destructive" });
      },
    }
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deletePet = useDeletePet({
    mutation: {
      onSuccess: async (_data, variables) => {
        const deletedPetName = pet?.name;
        // This page only ever deletes the pet currently being viewed
        // (activePetId), so it's always responsible for picking the next
        // one. `await` here — not fire-and-forget — so the list is
        // genuinely refetched before we read it; PetProvider's own effect
        // deliberately doesn't do this correction itself (see its comment)
        // since it can't tell a stale list from a fresh one.
        await queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        const remaining = (queryClient.getQueryData<Pet[]>(getListPetsQueryKey()) ?? []).filter(
          (p) => p.id !== variables.petId,
        );
        setActivePetId(remaining.length > 0 ? remaining[0].id : null);
        setIsDeleteDialogOpen(false);
        setLocation('/');
        toast({ title: "Profile deleted", description: deletedPetName ? `${deletedPetName} has been removed.` : undefined });
      },
      onError: (error) => {
        setIsDeleteDialogOpen(false);
        toast({ title: "Couldn't delete profile", description: error.message, variant: "destructive" });
      },
    }
  });

  const photoInputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = useUploadPetPhoto({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetPetQueryKey(updated.id), updated);
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        toast({ title: "Photo updated" });
      },
      onError: (error) => {
        toast({ title: "Couldn't upload photo", description: error.message, variant: "destructive" });
      },
    },
  });

  const removePhoto = useRemovePetPhoto({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetPetQueryKey(updated.id), updated);
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        toast({ title: "Photo removed" });
      },
      onError: (error) => {
        toast({ title: "Couldn't remove photo", description: error.message, variant: "destructive" });
      },
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activePetId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Photo is too large', description: 'Maximum size is 10MB.', variant: 'destructive' });
      return;
    }
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.type)) {
      toast({ title: 'Unsupported file type', description: 'Use a JPEG, PNG, WEBP, or HEIC image.', variant: 'destructive' });
      return;
    }
    uploadPhoto.mutate({ petId: activePetId, data: { file } });
  };

  const onSubmit = (data: ProfileFormValues) => {
    const payload = {
      ...data,
      photoUrl: pet?.photoUrl ?? null,
      birthDate: data.birthDate || null,
      breed: data.breed || null,
      notes: data.notes || null,
      vetName: data.vetName || null,
      vetClinic: data.vetClinic || null,
      vetPhone: data.vetPhone || null,
      vetAddress: data.vetAddress || null,
    };

    if (isNew) {
      createPet.mutate({ data: payload });
    } else if (activePetId) {
      updatePet.mutate({ petId: activePetId, data: payload });
    }
  };

  if (isLoading && !isNew) return <div className="p-10 animate-pulse text-center text-muted-foreground">Loading profile...</div>;

  const name = form.watch('name');
  const selectedSpecies = form.watch('species');
  const currentPhotoSrc = resolvePetAvatar(isNew ? null : pet?.photoUrl ?? null, selectedSpecies);
  const hasUploadedPhoto = !isNew && !!pet?.photoUrl && !pet.photoUrl.startsWith('preset:');
  const savedBreed = form.watch('breed');
  const breedOptions = BREEDS_BY_SPECIES[selectedSpecies] ?? [];
  const visibleBreedOptions =
    savedBreed && !breedOptions.some((breed) => breed.value === savedBreed)
      ? [{ value: savedBreed, label: `${savedBreed} (saved)` }, ...breedOptions]
      : breedOptions;

  const fieldClass = 'h-12 rounded-2xl bg-accent/40';

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-16">
      <h1 className="font-serif text-[34px] font-extrabold tracking-tight">
        {isNew ? "Let's add your pet" : `${pet?.name ?? 'Pet'}'s details`}
      </h1>
      <p className="mt-1 mb-6 text-[16.5px] text-muted-foreground">
        {isNew ? 'Tell us about your furry, feathered, or scaly friend.' : 'The bits a vet always asks for. Keep them current and everything else gets smarter.'}
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="bg-card border border-border rounded-3xl p-7 flex items-center gap-6">
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={isNew || uploadPhoto.isPending}
                onClick={() => photoInputRef.current?.click()}
                className={cn(
                  'w-24 h-24 rounded-full bg-accent flex items-center justify-center text-primary overflow-hidden',
                  !isNew && 'cursor-pointer',
                )}
                aria-label="Change pet photo"
              >
                {currentPhotoSrc ? (
                  <img src={currentPhotoSrc} alt="Pet avatar" className="w-full h-full object-cover" />
                ) : name ? (
                  <span className="text-4xl font-serif font-extrabold">{name.charAt(0)}</span>
                ) : (
                  <HeartPulse size={40} />
                )}
                {uploadPhoto.isPending && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 size={24} className="text-white animate-spin" />
                  </div>
                )}
              </button>
              {!isNew && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-card pointer-events-none">
                  <Camera size={14} />
                </div>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-muted-foreground">Name</div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        placeholder="Pet's Name"
                        className="w-full mt-0.5 text-[32px] font-serif font-extrabold tracking-tight bg-transparent border-b-2 border-border focus:border-primary focus:outline-none pb-1 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="text-sm shrink-0 hidden sm:flex flex-col items-end gap-1 text-right">
              {isNew ? (
                <span className="text-muted-foreground">Using the {selectedSpecies} illustration</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadPhoto.isPending}
                    className="text-primary font-bold hover:underline disabled:opacity-50"
                  >
                    {hasUploadedPhoto ? 'Change photo' : 'Add a photo'}
                  </button>
                  {hasUploadedPhoto && (
                    <button
                      type="button"
                      onClick={() => activePetId && removePhoto.mutate({ petId: activePetId })}
                      disabled={removePhoto.isPending}
                      className="text-muted-foreground hover:underline disabled:opacity-50"
                    >
                      Remove photo
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-3xl p-6">
              <div className="font-serif text-lg font-extrabold mb-4">The basics</div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="species"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Species</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('breed', '', { shouldDirty: true });
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className={fieldClass}>
                            <SelectValue placeholder="Species" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dog">Dog</SelectItem>
                          <SelectItem value="cat">Cat</SelectItem>
                          <SelectItem value="bird">Bird</SelectItem>
                          <SelectItem value="rabbit">Rabbit</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sex</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={fieldClass}>
                            <SelectValue placeholder="Sex" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-3">
                <FormField
                  control={form.control}
                  name="breed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breed (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger className={fieldClass}>
                            <SelectValue placeholder={`Select a ${selectedSpecies} breed`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {visibleBreedOptions.map((breed) => (
                            <SelectItem key={breed.value} value={breed.value}>
                              {breed.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{breedOptions.length} {selectedSpecies} breeds listed, or type your own.</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6">
              <div className="font-serif text-lg font-extrabold mb-4">Vitals</div>
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birthday or gotcha day</FormLabel>
                    <FormControl>
                      <Input type="date" className={fieldClass} {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-3">
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Weight</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0.0" className={fieldClass} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weightUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={fieldClass}>
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="lb">lbs</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="font-serif text-lg font-extrabold mb-4">Their vet</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vetName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vet</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Jamie Rivera" className={fieldClass} {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vetClinic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinic</FormLabel>
                    <FormControl>
                      <Input placeholder="Harbor Veterinary Clinic" className={fieldClass} {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vetPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(555) 123-4567" className={fieldClass} {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vetAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Harbor St, Portland, ME" className={fieldClass} {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-serif text-lg font-extrabold">Things worth remembering</FormLabel>
                  <p className="text-sm text-muted-foreground mb-1">Microchip number, allergies, what frightens them, where they hide.</p>
                  <FormControl>
                    <Textarea
                      placeholder="Allergies, microchip number, favorite hiding spots, fears..."
                      className="resize-none rounded-2xl bg-accent/40 min-h-[130px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            {!isNew ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="h-[50px] px-5 flex items-center gap-2 rounded-full border border-destructive/30 text-destructive font-bold hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={17} /> Delete {pet?.name ?? 'pet'} and everything in their file
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={updatePet.isPending || createPet.isPending}
              className="h-[52px] px-7 flex items-center gap-2.5 rounded-full bg-primary text-primary-foreground font-extrabold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Check size={19} />
              {isNew ? 'Create profile' : 'Save changes'}
            </button>
          </div>
        </form>
      </Form>

      {!isNew && activePetId && (
        <div className="mt-5">
          <ShareLinkCard petId={activePetId} petName={pet?.name ?? 'your pet'} />
        </div>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pet?.name || 'this'} profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {pet?.name || 'this pet'} and all of their health records, medications, reminders, and uploaded documents. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deletePet.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePet.isPending}
              onClick={() => {
                if (activePetId) {
                  deletePet.mutate({ petId: activePetId });
                }
              }}
            >
              {deletePet.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
