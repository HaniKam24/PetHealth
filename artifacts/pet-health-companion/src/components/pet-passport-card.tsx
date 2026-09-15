import { HeartPulse, ShieldCheck, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import type { Pet, Medication, VaccineStatus } from '@workspace/api-client-react';

// Mirrors profile.tsx's computeAgeYearsFromBirthDate, but the passport's
// Vitals card wants "4 yr 2 mo" precision rather than just whole years.
function formatAgeYearsMonths(birthDate: string): string {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '—';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  years = Math.max(years, 0);
  months = Math.max(months, 0);
  return years > 0 ? `${years} yr ${months} mo` : `${months} mo`;
}

const statLabelClass = 'text-[11px] font-bold tracking-wide text-background/60 uppercase';
const identityRowClass = 'flex items-center justify-between gap-3 text-sm';

const VACCINE_STATUS_STYLES: Record<VaccineStatus['status'], { label: string; cls: string }> = {
  current: { label: 'Current', cls: 'text-primary' },
  overdue: { label: 'Overdue', cls: 'text-destructive' },
  never_recorded: { label: 'Not on file', cls: 'text-muted-foreground' },
};

export function PetPassportCard({
  pet,
  activeMedications,
  hasWeightTrend,
  weightDelta,
  lastWeighedAt,
  vaccines,
  onEditAll,
}: {
  pet: Pet;
  activeMedications: Medication[];
  hasWeightTrend: boolean;
  weightDelta: number;
  lastWeighedAt: Date | null;
  vaccines: VaccineStatus[];
  onEditAll: () => void;
}) {
  const avatarSrc = resolvePetAvatar(pet.photoUrl, pet.species);
  const hasVetInfo = !!(pet.vetName || pet.vetClinic || pet.vetPhone);

  return (
    <>
      <div className="bg-foreground text-background rounded-3xl p-7">
        {/* flex-wrap, not a fixed-width sibling next to the name column —
            that's what caused the earlier bug (a rigid-width stats block
            collapsed the name column to 0). Each item below carries its own
            min-width and wraps its own text instead of truncating, so on a
            wide card everything sits on one row (matching the original
            design), and on a narrower one items drop to their own line as
            whole blocks rather than squeezing/cutting text off. */}
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-background/10 overflow-hidden flex items-center justify-center">
              {avatarSrc ? (
                <img src={avatarSrc} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <HeartPulse size={32} className="text-background/60" />
              )}
            </div>
            {pet.microchipId && (
              <div className="mt-2 text-[11px] tracking-wide text-background/60">CHIP {pet.microchipId}</div>
            )}
          </div>

          <div className="min-w-[160px]">
            <div className={cn(statLabelClass, 'flex items-center gap-1.5')}>
              <ShieldCheck size={13} /> Health Hub · Pet Passport
            </div>
            <div className="mt-1 font-serif text-3xl font-extrabold tracking-tight break-words">{pet.name}</div>
            <div className="mt-0.5 text-sm text-background/70 break-words">
              {[pet.breed, pet.sex !== 'unknown' ? pet.sex : null].filter(Boolean).join(' · ') || 'No details yet'}
            </div>
          </div>

          <div className="min-w-[90px]">
            <div className={statLabelClass}>Born</div>
            <div className="mt-0.5 text-sm font-bold break-words">
              {pet.birthDate ? format(new Date(`${pet.birthDate}T00:00:00`), 'd MMM yyyy') : '—'}
            </div>
          </div>
          <div className="min-w-[90px]">
            <div className={statLabelClass}>Weight</div>
            <div className="mt-0.5 text-sm font-bold break-words">
              {pet.weight != null ? `${pet.weight} ${pet.weightUnit}` : '—'}
            </div>
          </div>
          <div className="min-w-[110px]">
            <div className={statLabelClass}>Allergies</div>
            <div className="mt-0.5 text-sm font-bold break-words">{pet.allergies || 'None on file'}</div>
          </div>
          <div className="min-w-[130px]">
            <div className={statLabelClass}>Medicine</div>
            {activeMedications.length === 0 ? (
              <div className="mt-0.5 text-sm font-bold">None</div>
            ) : (
              <ul className="mt-0.5 list-disc pl-4 space-y-0.5">
                {activeMedications.map((m) => (
                  <li key={m.id} className="text-sm font-bold break-words">
                    {m.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {hasVetInfo && (
          <div className="mt-6 pt-5 border-t border-background/15 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={statLabelClass}>Primary vet</div>
              <div className="mt-0.5 text-sm font-bold">
                {[pet.vetName, pet.vetClinic].filter(Boolean).join(' · ')}
              </div>
            </div>
            {pet.vetPhone && (
              <a
                href={`tel:${pet.vetPhone}`}
                className="h-10 px-4 flex items-center gap-1.5 rounded-full bg-background text-foreground text-sm font-bold hover:opacity-90 transition-opacity"
              >
                <Phone size={14} /> {pet.vetPhone}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">What's on the card</div>
        <button type="button" onClick={onEditAll} className="text-sm font-bold text-primary hover:underline">
          Edit all
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-card border border-border rounded-3xl p-6">
          <div className="font-serif text-lg font-extrabold mb-3">Identity</div>
          <dl className="space-y-2.5">
            <div className={identityRowClass}>
              <dt className="text-muted-foreground">Species</dt>
              <dd className="font-bold text-right capitalize">{pet.species}</dd>
            </div>
            <div className={identityRowClass}>
              <dt className="text-muted-foreground">Breed</dt>
              <dd className="font-bold text-right">{pet.breed || '—'}</dd>
            </div>
            <div className={identityRowClass}>
              <dt className="text-muted-foreground">Sex</dt>
              <dd className="font-bold text-right capitalize">{pet.sex}</dd>
            </div>
            <div className={identityRowClass}>
              <dt className="text-muted-foreground">Microchip</dt>
              <dd className="font-bold text-right">{pet.microchipId || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6">
          <div className="font-serif text-lg font-extrabold mb-3">Vitals</div>
          <dl className="space-y-2.5">
            <div className={identityRowClass}>
              <dt className="text-muted-foreground">Birthday</dt>
              <dd className="font-bold text-right">
                {pet.birthDate ? format(new Date(`${pet.birthDate}T00:00:00`), 'd MMMM yyyy') : '—'}
              </dd>
            </div>
            <div className={identityRowClass}>
              <dt className="text-muted-foreground">Age</dt>
              <dd className="font-bold text-right">{pet.birthDate ? formatAgeYearsMonths(pet.birthDate) : '—'}</dd>
            </div>
            <div className={identityRowClass}>
              <dt className="text-muted-foreground">Weight</dt>
              <dd className="font-bold text-right">
                {pet.weight != null ? `${pet.weight} ${pet.weightUnit}` : '—'}
                {hasWeightTrend && weightDelta !== 0 && (
                  <span className={cn('ml-1.5', weightDelta > 0 ? 'text-destructive' : 'text-primary')}>
                    {weightDelta > 0 ? '↑' : '↓'} {Math.abs(weightDelta).toFixed(1)}
                  </span>
                )}
              </dd>
            </div>
            <div className={identityRowClass}>
              <dt className="text-muted-foreground">Last weighed</dt>
              <dd className="font-bold text-right">{lastWeighedAt ? format(lastWeighedAt, 'MMM d') : '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6">
          <div className="font-serif text-lg font-extrabold mb-3">Vaccines</div>
          <dl className="space-y-2.5">
            {vaccines.map((v) => {
              const style = VACCINE_STATUS_STYLES[v.status];
              return (
                <div key={v.key} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{v.label}</dt>
                    <dd className={cn('font-bold text-right', style.cls)}>{style.label}</dd>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {v.lastGivenDate ? `Last given ${format(new Date(`${v.lastGivenDate}T00:00:00`), 'MMM d, yyyy')}` : 'No record yet'}
                  </div>
                </div>
              );
            })}
          </dl>
          {vaccines.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">General guideline — confirm with your vet.</p>
          )}
        </div>
      </div>

      <div className="mt-5 bg-card border border-border rounded-3xl p-6">
        <div className="font-serif text-lg font-extrabold mb-2">Things worth remembering</div>
        <p className="text-[15px]">{pet.notes || <span className="text-muted-foreground">Nothing on file yet.</span>}</p>
      </div>
    </>
  );
}
