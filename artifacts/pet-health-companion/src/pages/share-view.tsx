import { useRoute } from 'wouter';
import { useGetSitterReport, getGetSitterReportQueryKey } from '@workspace/api-client-react';
import { HeartPulse, Phone, Printer, AlertTriangle } from 'lucide-react';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import { format } from 'date-fns';

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
  const sexLabel = report.sex !== 'unknown' ? report.sex.charAt(0).toUpperCase() + report.sex.slice(1) : null;

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

        {/* Dark hero — same look as the owner's own passport card, minus the
            emergency vet (that lives in its own card below, not the header,
            so the header stays compact). */}
        <div className="relative rounded-3xl overflow-hidden bg-foreground text-background p-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(115deg, currentColor 0, currentColor 2px, transparent 2px, transparent 9px)',
            }}
          />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-background/10 overflow-hidden flex items-center justify-center shrink-0">
              {avatarSrc ? (
                <img src={avatarSrc} alt={report.petName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-serif font-extrabold">{report.petName.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-[28px] font-extrabold tracking-tight truncate">{report.petName}</h1>
              <div className="text-sm text-background/70">
                {[
                  report.species.charAt(0).toUpperCase() + report.species.slice(1),
                  sexLabel,
                  report.weight != null ? `${report.weight} ${report.weightUnit}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Care info'}
              </div>
            </div>
          </div>

          {report.microchipId && (
            <div className="relative mt-5 pt-4 border-t border-background/15">
              <div className="text-[10.5px] font-extrabold tracking-[0.12em] text-background/55">MICROCHIP</div>
              <div className="mt-0.5 font-mono text-sm font-semibold tracking-wider">{report.microchipId}</div>
            </div>
          )}

          {hasVetInfo && (
            <div className="relative mt-5 pt-4 border-t border-background/15">
              <div className="text-[10.5px] font-extrabold tracking-[0.12em] text-background/55">PRIMARY VET</div>
              {(report.vetName || report.vetClinic) && (
                <div className="mt-0.5 text-sm font-bold">
                  {[report.vetName, report.vetClinic].filter(Boolean).join(' · ')}
                </div>
              )}
              {report.vetPhone && (
                <a
                  href={`tel:${report.vetPhone}`}
                  className="mt-2.5 inline-flex h-10 items-center gap-1.5 rounded-full bg-background text-foreground px-4 text-sm font-extrabold hover:opacity-90 transition-opacity"
                >
                  <Phone size={14} /> {report.vetPhone}
                </a>
              )}
              {report.vetAddress && <div className="mt-2 text-xs text-background/60">{report.vetAddress}</div>}
            </div>
          )}

          <div className="relative mt-5 pt-3 border-t border-background/15 text-xs text-background/55">
            Valid through {format(new Date(report.expiresAt), 'MMMM d, yyyy')}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {hasCriticalInfo && (
            <section className="lg:col-span-2 bg-destructive/5 border border-destructive/25 rounded-3xl p-6">
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

          {hasEmergencyVet && (
            <section className="bg-card border border-border rounded-3xl p-6">
              <h2 className="font-serif text-lg font-extrabold mb-1">After-hours &amp; emergencies</h2>
              {report.emergencyVetName && <p className="text-sm font-bold">{report.emergencyVetName}</p>}
              {report.emergencyVetHours && <p className="text-xs text-muted-foreground">{report.emergencyVetHours}</p>}
              {report.emergencyVetPhone && (
                <a
                  href={`tel:${report.emergencyVetPhone}`}
                  className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-destructive text-destructive-foreground px-4 text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <Phone size={14} /> {report.emergencyVetPhone}
                </a>
              )}
            </section>
          )}

          <section className="bg-card border border-border rounded-3xl p-6">
            <h2 className="font-serif text-lg font-extrabold mb-3">Active medications</h2>
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
          </section>

          {report.feedingInstructions && (
            <section className="bg-card border border-border rounded-3xl p-6">
              <h2 className="font-serif text-lg font-extrabold mb-2">Feeding</h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.feedingInstructions}</p>
            </section>
          )}

          {report.whereThingsAre && (
            <section className="bg-card border border-border rounded-3xl p-6">
              <h2 className="font-serif text-lg font-extrabold mb-2">Where things are</h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.whereThingsAre}</p>
            </section>
          )}

          {report.walksAndTriggers && (
            <section className="bg-card border border-border rounded-3xl p-6">
              <h2 className="font-serif text-lg font-extrabold mb-2">Walks &amp; triggers</h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.walksAndTriggers}</p>
            </section>
          )}

          {report.handlingNotes && (
            <section className="bg-card border border-border rounded-3xl p-6">
              <h2 className="font-serif text-lg font-extrabold mb-2">Handling</h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.handlingNotes}</p>
            </section>
          )}

          {report.whatNormalLooksLike && (
            <section className="bg-card border border-border rounded-3xl p-6">
              <h2 className="font-serif text-lg font-extrabold mb-2">What normal looks like</h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.whatNormalLooksLike}</p>
            </section>
          )}

          {report.caretakingPreference && (
            <div className="flex gap-3 items-start p-4 bg-primary/10 rounded-2xl">
              <HeartPulse size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm">{report.caretakingPreference}</p>
            </div>
          )}

          {report.notes && (
            <section className="lg:col-span-2 bg-card border border-border rounded-3xl p-6">
              <h2 className="font-serif text-lg font-extrabold mb-3">Notes</h2>
              <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
