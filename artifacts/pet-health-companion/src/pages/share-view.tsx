import { useRoute } from 'wouter';
import { useGetSitterReport, getGetSitterReportQueryKey } from '@workspace/api-client-react';
import { HeartPulse, Phone, Printer } from 'lucide-react';
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
  const hasVetInfo = report.vetName || report.vetClinic || report.vetPhone || report.vetAddress;

  return (
    <div className="min-h-[100dvh] bg-background">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
      <div className="max-w-2xl mx-auto p-6 md:p-10 pb-16">
        <div className="no-print flex justify-end mb-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 flex items-center gap-2 px-4 rounded-full bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center overflow-hidden shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-serif font-extrabold">{report.petName.charAt(0)}</span>
            )}
          </div>
          <div>
            <h1 className="font-serif text-[28px] font-extrabold tracking-tight">Care info for {report.petName}</h1>
            <p className="text-sm text-muted-foreground">
              Valid through {format(new Date(report.expiresAt), 'MMMM d, yyyy')}
            </p>
          </div>
        </div>

        {hasVetInfo && (
          <section className="bg-card border border-border rounded-3xl p-6 mb-5">
            <h2 className="font-serif text-lg font-extrabold mb-3">Vet contact</h2>
            <div className="space-y-1 text-sm">
              {report.vetName && <p><span className="text-muted-foreground">Vet:</span> {report.vetName}</p>}
              {report.vetClinic && <p><span className="text-muted-foreground">Clinic:</span> {report.vetClinic}</p>}
              {report.vetAddress && <p><span className="text-muted-foreground">Address:</span> {report.vetAddress}</p>}
              {report.vetPhone && (
                <p>
                  <span className="text-muted-foreground">Phone:</span>{' '}
                  <a href={`tel:${report.vetPhone}`} className="text-primary font-semibold inline-flex items-center gap-1">
                    <Phone size={14} /> {report.vetPhone}
                  </a>
                </p>
              )}
            </div>
          </section>
        )}

        <section className="bg-card border border-border rounded-3xl p-6 mb-5">
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

        <section className="bg-card border border-border rounded-3xl p-6">
          <h2 className="font-serif text-lg font-extrabold mb-3">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{report.notes || 'No additional notes.'}</p>
        </section>
      </div>
    </div>
  );
}
