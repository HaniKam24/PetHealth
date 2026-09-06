import { usePetContext } from '@/context/pet-context';
import { useGetPet, getGetPetQueryKey, useUpdatePet, useCreatePet, getListPetsQueryKey } from '@workspace/api-client-react';
import { PageHeader } from '@/components/page-header';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Trash2, HeartPulse } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';

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

export default function Profile() {
  const { activePetId, setActivePetId } = usePetContext();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  const isNew = location.includes('new=true');

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
    },
  });

  const initializedRef = useRef(false);

  useEffect(() => {
    if (pet && !isNew && !initializedRef.current) {
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
      });
      initializedRef.current = true;
    }
  }, [pet, isNew, form]);

  // Reset form when entering 'new' mode
  useEffect(() => {
    if (isNew) {
      form.reset({
        name: '', species: 'dog', breed: '', sex: 'unknown', birthDate: '', 
        weight: null, weightUnit: 'lb', photoUrl: '', notes: ''
      });
      initializedRef.current = false;
    }
  }, [isNew, form]);


  const updatePet = useUpdatePet({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(data.id) });
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        toast({ title: "Profile updated successfully" });
      }
    }
  });

  const createPet = useCreatePet({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });
        setActivePetId(data.id);
        setLocation('/profile');
        toast({ title: "Welcome to the family!", description: `${data.name} has been added.` });
      }
    }
  });

  const onSubmit = (data: ProfileFormValues) => {
    const payload = {
      ...data,
      photoUrl: data.photoUrl || null,
      birthDate: data.birthDate || null,
      breed: data.breed || null,
      notes: data.notes || null,
    };
    
    if (isNew) {
      createPet.mutate({ data: payload });
    } else if (activePetId) {
      updatePet.mutate({ petId: activePetId, data: payload });
    }
  };

  if (isLoading && !isNew) return <div className="p-10 animate-pulse text-center">Loading profile...</div>;

  const currentPhoto = form.watch('photoUrl');
  const name = form.watch('name');
  const selectedSpecies = form.watch('species');
  const currentPhotoSrc = resolvePetAvatar(currentPhoto, selectedSpecies);
  const savedBreed = form.watch('breed');
  const breedOptions = BREEDS_BY_SPECIES[selectedSpecies] ?? [];
  const visibleBreedOptions =
    savedBreed && !breedOptions.some((breed) => breed.value === savedBreed)
      ? [{ value: savedBreed, label: `${savedBreed} (saved)` }, ...breedOptions]
      : breedOptions;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <PageHeader 
        title={isNew ? "Add a Pet" : `${pet?.name || 'Pet'}'s Profile`}
        description={isNew ? "Tell us about your furry, feathered, or scaly friend." : "Keep their vital details up to date."}
      />

      <div className="bg-card border border-border rounded-3xl p-6 md:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary/10 to-transparent"></div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="relative z-10">
            
            {/* Header / Avatar Area */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-12">
               <div className="relative">
                 <div className="w-32 h-32 rounded-full border-4 border-background shadow-lg overflow-hidden bg-accent flex items-center justify-center text-primary text-4xl font-serif">
                    {currentPhotoSrc ? (
                      <img src={currentPhotoSrc} alt="Pet avatar" className="w-full h-full object-cover" />
                   ) : (
                     name ? name.charAt(0) : <HeartPulse size={40} />
                   )}
                 </div>
               </div>
               
               <div className="flex-1 w-full space-y-4">
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <input 
                            placeholder="Pet's Name" 
                            className="text-4xl md:text-5xl font-serif font-medium bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted w-full border-b-2 border-transparent focus:border-primary transition-colors pb-2" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pet photo</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/50 p-3">
                            <img
                              src={currentPhotoSrc ?? ''}
                              alt=""
                              className="h-16 w-16 rounded-xl object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {field.value ? 'Custom pet photo' : `${selectedSpecies[0].toUpperCase()}${selectedSpecies.slice(1)} default`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                The default image updates automatically when you change species.
                              </p>
                            </div>
                            {field.value && (
                              <button
                                type="button"
                                onClick={() => field.onChange('')}
                                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                              >
                                Use default
                              </button>
                            )}
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Custom photo uploads will be available with private owner accounts.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
              
              <div className="space-y-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Basic Info</h3>
                
                <div className="grid grid-cols-2 gap-4">
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
                            <SelectTrigger className="bg-accent/30 h-12">
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
                            <SelectTrigger className="bg-accent/30 h-12">
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

                <FormField
                  control={form.control}
                  name="breed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breed (Optional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ''}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-accent/30 h-12">
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
              </div>

              <div className="space-y-8">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Vitals</h3>
                
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birth Date / Gotcha Day</FormLabel>
                      <FormControl>
                        <Input type="date" className="bg-accent/30 h-12" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-3">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Weight</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="0.0" className="bg-accent/30 h-12" {...field} value={field.value || ''} />
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
                            <SelectTrigger className="bg-accent/30 h-12">
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

            <div className="mt-10 pt-8 border-t border-border/50">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-serif">Important Notes & Quirks</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Allergies, microchip number, favorite hiding spots, fears..." 
                        className="resize-none bg-accent/20 min-h-[150px] text-lg p-6 rounded-2xl" 
                        {...field}
                        value={field.value || ''} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-12 flex items-center justify-between">
              {!isNew && (
                <button type="button" className="text-destructive hover:bg-destructive/10 px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2">
                  <Trash2 size={18} /> Delete Profile
                </button>
              )}
              <div className={cn("flex gap-4", isNew && "w-full justify-end")}>
                <button 
                  type="submit" 
                  disabled={updatePet.isPending || createPet.isPending}
                  className="bg-primary text-primary-foreground px-10 py-4 rounded-xl font-medium shadow-md hover:shadow-lg hover:bg-primary/90 transition-all flex items-center gap-3 ml-auto text-lg"
                >
                  <Save size={20} />
                  {isNew ? 'Create Profile' : 'Save Changes'}
                </button>
              </div>
            </div>
            
          </form>
        </Form>
      </div>
    </div>
  );
}
