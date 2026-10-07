import { useRoute } from 'wouter';
import { useGetSitterReport, getGetSitterReportQueryKey } from '@workspace/api-client-react';
import { HeartPulse, Phone, Printer, AlertTriangle, ShieldAlert, Mars, Venus } from 'lucide-react';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card border border-border rounded-3xl p-6', className)}>
      <h2 className="font-serif text-lg font-extrabold mb-2">{title}</h2>
      {children}
    </section>
  );
}

// The one page in this app rendered for a signed-out visitor (see
// SHARE_PATH_PREFIX handling in App.tsx) — deliberately standalone, no
// Layout/nav/pet-switcher, since a sitter has no account and no other pets.
export default function ShareView() {
  const [, params] = useRoute('/share/:token');
  const token = params?.token ?? '';

  const { data: report, isLoading, isError } = useGetSitterReport(token, {
    query: { enabled: !!token, retry: false, queryKey: getGetSitterReportQueryKey(token) },
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-muted-foreground mx-auto mb-4">
            <HeartPulse size={24} />
          </div>
          <h1 className="font-serif text-xl font-extrabold">This link is no longer available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have expired or been revoked by the owner. Ask them to send a new one.
          </p>
        </div>
      </div>
    );
  }

  const avatarSrc = resolvePetAvatar(report.photoUrl, report.species);
  const hasVetInfo = report.vetName || report.vetClinic || report.vetPhone;
  const hasEmergencyVet = report.emergencyVetName || report.emergencyVetPhone || report.emergencyVetHours;
  const hasCriticalInfo = report.criticalInfoSummary || report.criticalInfoDetails;
  const SexIcon = report.sex === 'male' ? Mars : report.sex === 'female' ? Venus : null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
      <div className="max-w-5xl mx-auto p-6 md:p-10 pb-16">
        <div className="no-print flex justify-end mb-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 flex items-center gap-2 px-4 rounded-full bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>

        {/* Same two-column layout as the owner's own profile page — a pet
            card on the left (sticky, same "passport" look as there), the
            rest of the report stacked in a single column on the right. */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <div className="relative rounded-3xl overflow-hidden bg-foreground text-background shadow-xl shadow-foreground/20">
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
                  <span className="text-[10.5px] font-extrabold tracking-[0.16em] text-background/70">PET CARD</span>
                </div>

                <div className="w-[150px] h-[150px] rounded-full overflow-hidden flex items-center justify-center">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={report.petName} className="w-full h-full object-cover" />
                  ) : (
                    <HeartPulse size={44} className="text-background/60" />
                  )}
                </div>

                <div className="mt-3.5 flex items-center justify-center gap-2">
                  <div className="font-serif text-4xl font-extrabold tracking-tight break-words">{report.petName}</div>
                  {SexIcon && <SexIcon size={22} className="shrink-0 text-background/70" />}
                </div>
                <div className="mt-1 text-sm text-background/75 break-words">
                  {[report.breed, report.color, report.weight != null ? `${report.weight} ${report.weightUnit}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'No details yet'}
                </div>

                {report.allergies && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold bg-amber-500/25 text-amber-400">
                      <ShieldAlert size={13} /> {report.allergies}
                    </span>
                  </div>
                )}
              </div>

              {report.microchipId && (
                <div className="relative px-6 py-4 border-t border-dashed border-background/20 text-center">
                  <div className="text-[10px] font-extrabold tracking-[0.14em] text-background/50">MICROCHIP</div>
                  <div className="mt-1 font-mono text-sm font-semibold tracking-wider">{report.microchipId}</div>
                </div>
              )}

              {hasVetInfo && (
                <div className="relative px-5 py-4 bg-primary/20 border-t border-background/10 text-center">
                  <div className="text-[10px] font-extrabold tracking-[0.12em] text-background/55">PRIMARY VET</div>
                  {(report.vetName || report.vetClinic) && (
                    <div className="mt-0.5">
                      {report.vetName && <div className="text-sm font-bold">{report.vetName}</div>}
                      {report.vetClinic && <div className="text-xs text-background/75 mt-0.5">{report.vetClinic}</div>}
                    </div>
                  )}
                  {report.vetPhone && (
                    <a
                      href={`tel:${report.vetPhone}`}
                      className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-background text-foreground px-3.5 text-[13.5px] font-extrabold hover:opacity-90 transition-opacity"
                    >
                      <Phone size={14} /> {report.vetPhone}
                    </a>
                  )}
                  {report.vetAddress && <div className="mt-2 text-xs text-background/60">{report.vetAddress}</div>}
                </div>
              )}

              <div className="relative px-6 py-3 border-t border-background/15 text-center text-[11px] text-background/55">
                Valid through {format(new Date(report.expiresAt), 'MMMM d, yyyy')}
              </div>
            </div>

            {hasEmergencyVet && (
              <div>
                <h2 className="font-serif text-lg font-extrabold text-destructive mb-2 px-1">Emergency vet</h2>
                <div className="bg-destructive/10 border border-destructive/30 rounded-3xl p-6">
                {report.emergencyVetName && <p className="text-sm font-bold text-destructive">{report.emergencyVetName}</p>}
                {report.emergencyVetHours && <p className="text-xs text-destructive/80">{report.emergencyVetHours}</p>}
                {report.emergencyVetPhone && (
                  <a
                    href={`tel:${report.emergencyVetPhone}`}
                    className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-destructive text-destructive-foreground px-4 text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <Phone size={14} /> {report.emergencyVetPhone}
                  </a>
                )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5 min-w-0">
            {report.caretakingPreference && (
              <h1 className="font-serif text-xl md:text-2xl font-extrabold tracking-tight">
                <span className="text-emerald-600">Report generated for </span>
                <span className="text-foreground">{report.caretakingPreference}</span>
              </h1>
            )}

            {hasCriticalInfo && (
              <section className="bg-destructive/5 border border-destructive/25 rounded-3xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                    <AlertTriangle size={17} />
                  </div>
                  <div>
                    {report.criticalInfoSummary && (
                      <div className="font-bold text-[15px] text-destructive">{report.criticalInfoSummary}</div>
                    )}
                    {report.criticalInfoDetails && (
                      <p className="mt-1.5 text-sm text-destructive/90 whitespace-pre-wrap leading-relaxed">
                        {report.criticalInfoDetails}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            <Card title="Active medications">
              {report.medications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active medications.</p>
              ) : (
                <div className="space-y-3">
                  {report.medications.map((med, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-semibold">{med.name} — {med.dose}, {med.frequency}</p>
                      {med.instructions && <p className="text-muted-foreground">{med.instructions}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {report.whatNormalLooksLike && (
              <Card title="What normal looks like">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.whatNormalLooksLike}</p>
              </Card>
            )}

            {report.feedingInstructions && (
              <Card title="Feeding">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.feedingInstructions}</p>
              </Card>
            )}

            {report.handlingNotes && (
              <Card title="Handling">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.handlingNotes}</p>
              </Card>
            )}

            {report.walksAndTriggers && (
              <Card title="Walks & triggers">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.walksAndTriggers}</p>
              </Card>
            )}

            {report.whereThingsAre && (
              <Card title="Where things are">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.whereThingsAre}</p>
              </Card>
            )}

            {report.notes && (
              <Card title="Notes">
                <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
