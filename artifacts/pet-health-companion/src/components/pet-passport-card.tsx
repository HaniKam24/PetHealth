import { HeartPulse, Phone, ShieldCheck, AlertTriangle, IdCard, Pill, ImagePlus } from 'lucide-react';
import { Link } from 'wouter';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import type { Pet, Medication, VaccineStatus } from '@workspace/api-client-react';

// Mirrors profile.tsx's computeAgeYearsFromBirthDate, but the passport's
// About card wants "4 yr 2 mo" precision rather than just whole years.
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

// A vaccine within this many days of its due date reads as "Due soon"
// (destructive-toned, like overdue) rather than "Current" — mirrors the
// design's Bordetella tile, which is due in a few weeks but not yet overdue.
const DUE_SOON_WINDOW_DAYS = 30;

const SPAY_NEUTER_STATUS_LABELS: Record<Pet['spayNeuterStatus'], string> = {
  spayed_neutered: 'Spayed/Neutered',
  intact: 'Intact',
  unknown: 'Unknown',
};

const rowClass = 'flex items-center justify-between gap-3 py-2.5 border-t border-border/70 text-sm';

function AboutRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={rowClass}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-right">{value}</span>
    </div>
  );
}

export function PetPassportCard({
  pet,
  activeMedications,
  hasWeightTrend,
  weightDelta,
  lastWeighedAt,
  vaccines,
  onEditAll,
  onChangePhoto,
  isUploadingPhoto,
}: {
  pet: Pet;
  activeMedications: Medication[];
  hasWeightTrend: boolean;
  weightDelta: number;
  lastWeighedAt: Date | null;
  vaccines: VaccineStatus[];
  onEditAll: () => void;
  onChangePhoto: () => void;
  isUploadingPhoto: boolean;
}) {
  const avatarSrc = resolvePetAvatar(pet.photoUrl, pet.species);
  const hasVetInfo = !!(pet.vetName || pet.vetClinic || pet.vetPhone);
  const hasOverdueVaccine = vaccines.some((v) => v.status === 'overdue');
  const hasAnyVaccineRecord = vaccines.some((v) => v.status !== 'never_recorded');

  const sexLabel = pet.sex !== 'unknown' ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : 'Unknown sex';
  const spayNeuterLabel = pet.spayNeuterStatus !== 'unknown' ? SPAY_NEUTER_STATUS_LABELS[pet.spayNeuterStatus] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
      {/* Badge */}
      <div className="flex flex-col items-center gap-4 lg:sticky lg:top-6">
        <div className="w-14 h-5 rounded-md bg-border" />
        <div className="w-3.5 h-6 border-x-2 border-border -mt-4" />

        <div className="relative w-full rounded-3xl overflow-hidden bg-foreground text-background shadow-xl shadow-foreground/20">
          {/* Faint passport-style watermark texture — pure CSS, no image asset. */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(115deg, currentColor 0, currentColor 2px, transparent 2px, transparent 9px)',
            }}
          />

          <div className="relative pt-4 flex justify-center">
            <div className="w-[86px] h-3 rounded-full bg-background/20" />
          </div>

          <div className="relative px-6 pt-4 pb-6 flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                <HeartPulse size={12} strokeWidth={2.5} />
              </div>
              <span className="text-[10.5px] font-extrabold tracking-[0.16em] text-background/70">
                PET CARD
              </span>
            </div>

            <div className="w-[150px] h-[150px] rounded-full overflow-hidden flex items-center justify-center">
              {avatarSrc ? (
                <img src={avatarSrc} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <HeartPulse size={44} className="text-background/60" />
              )}
            </div>

            <div className="mt-3.5 font-serif text-4xl font-extrabold tracking-tight break-words">{pet.name}</div>
            <div className="mt-1 text-sm text-background/75 break-words">
              {[pet.breed, sexLabel, spayNeuterLabel].filter(Boolean).join(' · ') || 'No details yet'}
            </div>

            {(hasAnyVaccineRecord || pet.allergies) && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {hasAnyVaccineRecord && (
                  <span
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold',
                      hasOverdueVaccine ? 'bg-destructive/25 text-destructive' : 'bg-primary/25 text-primary',
                    )}
                  >
                    {hasOverdueVaccine ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
                    {hasOverdueVaccine ? 'Vaccine overdue' : 'Vaccines current'}
                  </span>
                )}
                {pet.allergies && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold bg-destructive/25 text-destructive">
                    <AlertTriangle size={13} /> {pet.allergies}
                  </span>
                )}
              </div>
            )}
          </div>

          {pet.microchipId && (
            <div className="relative px-6 py-4 border-t border-dashed border-background/20 text-center">
              <div className="text-[10px] font-extrabold tracking-[0.14em] text-background/50">MICROCHIP</div>
              <div className="mt-1 font-mono text-sm font-semibold tracking-wider">{pet.microchipId}</div>
            </div>
          )}

          {hasVetInfo && (
            <div className="relative px-5 py-4 bg-primary/20 border-t border-background/10 text-center">
              <div className="text-[10px] font-extrabold tracking-[0.12em] text-background/55">PRIMARY VET</div>
              {(pet.vetName || pet.vetClinic) && (
                <div className="mt-0.5">
                  {pet.vetName && <div className="text-sm font-bold">{pet.vetName}</div>}
                  {pet.vetClinic && <div className="text-xs text-background/75 mt-0.5">{pet.vetClinic}</div>}
                </div>
              )}
              {pet.vetPhone && (
                <a
                  href={`tel:${pet.vetPhone}`}
                  className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-background text-foreground px-3.5 text-[13.5px] font-extrabold hover:opacity-90 transition-opacity"
                >
                  <Phone size={14} /> {pet.vetPhone}
                </a>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onChangePhoto}
          disabled={isUploadingPhoto}
          className="text-[13px] font-bold text-primary flex items-center gap-1.5 hover:underline disabled:opacity-50"
        >
          <ImagePlus size={15} /> {isUploadingPhoto ? 'Uploading…' : 'Change badge photo'}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4">
        <div className="bg-card border border-border rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-[26px] h-[26px] rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <IdCard size={15} />
              </div>
              <div className="font-serif text-base font-extrabold">About {pet.name}</div>
            </div>
            <button type="button" onClick={onEditAll} className="text-[13px] font-bold text-primary hover:underline shrink-0">
              Edit
            </button>
          </div>
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-9">
            <AboutRow label="Species" value={<span className="capitalize">{pet.species}</span>} />
            <AboutRow
              label="Birthday"
              value={pet.birthDate ? format(new Date(`${pet.birthDate}T00:00:00`), 'd MMM yyyy') : '—'}
            />
            <AboutRow label="Breed" value={pet.breed || '—'} />
            <AboutRow label="Age" value={pet.birthDate ? formatAgeYearsMonths(pet.birthDate) : '—'} />
            <AboutRow label="Sex" value={[sexLabel, spayNeuterLabel].filter(Boolean).join(' · ')} />
            <AboutRow
              label="Weight"
              value={
                <>
                  {pet.weight != null ? `${pet.weight} ${pet.weightUnit}` : '—'}
                  {hasWeightTrend && weightDelta !== 0 && (
                    <span className={cn('ml-1.5', weightDelta > 0 ? 'text-destructive' : 'text-primary')}>
                      {weightDelta > 0 ? '↑' : '↓'}
                      {Math.abs(weightDelta).toFixed(1)}
                    </span>
                  )}
                </>
              }
            />
            <AboutRow label="Microchip" value={pet.microchipId || '—'} />
            <AboutRow label="Last weighed" value={lastWeighedAt ? format(lastWeighedAt, 'MMM d') : '—'} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-[26px] h-[26px] rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck size={15} />
              </div>
              <div className="font-serif text-base font-extrabold">Vaccines</div>
            </div>
            <Link href="/records?new=true" className="text-[13px] font-bold text-primary hover:underline shrink-0">
              Add record
            </Link>
          </div>
          {vaccines.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No vaccine records yet.</p>
          ) : (
            <>
              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {vaccines.map((v) => {
                  const daysUntilDue = v.dueDate
                    ? differenceInCalendarDays(new Date(`${v.dueDate}T00:00:00`), new Date())
                    : null;
                  const dueSoon = v.status === 'current' && daysUntilDue !== null && daysUntilDue <= DUE_SOON_WINDOW_DAYS;
                  const urgent = v.status === 'overdue' || dueSoon;
                  const label = v.status === 'overdue' ? 'Overdue' : dueSoon ? 'Due soon' : v.status === 'current' ? 'Current' : 'Not on file';
                  return (
                    <div
                      key={v.key}
                      className={cn(
                        'rounded-2xl border p-3.5',
                        urgent ? 'border-destructive/30 bg-destructive/5' : 'border-border/70 bg-accent/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-bold">{v.label}</span>
                        <span
                          className={cn(
                            'h-[22px] px-2.5 rounded-full text-[11.5px] font-extrabold flex items-center whitespace-nowrap',
                            urgent ? 'bg-destructive/15 text-destructive' : v.status === 'current' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {label.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[13.5px] text-muted-foreground">
                        {v.lastGivenDate
                          ? `Given ${format(new Date(`${v.lastGivenDate}T00:00:00`), 'MMM d, yyyy')}`
                          : 'No record yet'}
                        {v.dueDate ? ` · due ${format(new Date(`${v.dueDate}T00:00:00`), 'MMM yyyy')}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">General guideline — confirm with your vet.</p>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-[26px] h-[26px] rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Pill size={15} />
              </div>
              <div className="font-serif text-base font-extrabold">Medication</div>
            </div>
            <Link href="/medications?new=true" className="text-[13px] font-bold text-primary hover:underline shrink-0">
              Add medicine
            </Link>
          </div>
          {activeMedications.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">None on file.</p>
          ) : (
            <div className="mt-1 flex flex-col">
              {activeMedications.map((m, i) => {
                const isOngoing = m.doseIntervalValue != null && m.doseIntervalUnit != null;
                return (
                  <div
                    key={m.id}
                    className={cn('flex items-center gap-3.5 py-3', i > 0 && 'border-t border-border/70')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[15.5px] font-bold truncate">{m.name}</div>
                      <div className="text-[13.5px] text-muted-foreground truncate">
                        {[m.dose, m.frequency].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'h-[26px] px-2.5 rounded-full text-[12px] font-extrabold flex items-center shrink-0 whitespace-nowrap',
                        isOngoing ? 'bg-primary/15 text-primary' : 'bg-accent border border-border text-muted-foreground',
                      )}
                    >
                      {isOngoing ? 'ONGOING' : 'AS NEEDED'}
                    </span>
                    {isOngoing && m.nextDoseAt && (
                      <span className="text-[13.5px] text-muted-foreground shrink-0 text-right whitespace-nowrap">
                        Next {format(parseISO(m.nextDoseAt), 'MMM d')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-3xl p-5">
          <div className="font-serif text-base font-extrabold">Things worth remembering</div>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Shows on the back of the badge when you share it.</p>
          <p className="mt-2.5 text-[15px] whitespace-pre-wrap leading-relaxed">
            {pet.notes || <span className="text-muted-foreground">Nothing on file yet.</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
