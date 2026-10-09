import { HeartPulse, Check, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

// Mirrors pick-a-plan.tsx's card, but this page is reachable any time (not
// just during onboarding) and reads the account's real stored plan instead
// of a one-time localStorage "did they see the picker" flag.
function PlanCard({
  name,
  price,
  period,
  sub,
  features,
  current,
  comingSoon,
}: {
  name: string;
  price: string;
  period?: string | null;
  sub?: string;
  features: string[];
  current: boolean;
  comingSoon?: boolean;
}) {
  return (
    <Card className={`rounded-3xl ${current ? 'border-primary shadow-md' : 'shadow-sm'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h2 className="text-xl font-serif font-medium text-foreground">{name}</h2>
          {current && (
            <div className="shrink-0 flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 rounded-full px-3 py-1">
              Current plan
            </div>
          )}
          {!current && comingSoon && (
            <div className="shrink-0 flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted rounded-full px-3 py-1">
              <Lock size={12} /> Coming soon
            </div>
          )}
        </div>
        <p className="mt-1">
          <span className="text-3xl font-serif font-bold text-foreground">{price}</span>
          {period && <span className="text-muted-foreground text-sm"> {period}</span>}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="space-y-2.5 mb-6">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-foreground/90">
              <Check size={16} className="text-primary shrink-0 mt-0.5" />
              {feature}
            </li>
          ))}
        </ul>
        {!current && (
          <Button type="button" size="lg" variant="outline" className="w-full rounded-full" disabled>
            Coming soon
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Billing() {
  const { data: session } = useSession();
  // Defaults to "free" while the session is still loading — matches what
  // the account actually is server-side (every account's plan column
  // defaults to "free" until real billing exists to change it).
  const plan = session?.user.plan ?? 'free';

  return (
    <div className="max-w-3xl mx-auto w-full p-6 md:p-10 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <HeartPulse size={20} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-medium text-foreground">Billing</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your plan.</p>
        </div>
      </div>

      {/* Same three tiers, names, prices, and feature copy as the PLANS array
          on the marketing homepage (home.tsx) — kept in sync by hand since
          this page needs session/plan logic the static homepage doesn't. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <PlanCard
          name="Pawlie Lite"
          price="$0"
          sub="Free forever"
          current={plan === 'free'}
          features={['Pawlie AI: 7-day trial, then Pawlie Plus and up', 'Smart Upload: 2 uploads', 'Up to 3 pets', 'All core features']}
        />
        <PlanCard
          name="Pawlie Plus"
          price="$4.99"
          period="/ month"
          sub="or about $44 / year"
          current={plan === 'plus'}
          comingSoon
          features={['Pawlie AI included, with a monthly cap', 'Smart Upload: 5 per month', 'Up to 5 pets', 'All core features']}
        />
        <PlanCard
          name="Pawlie Unleashed"
          price="$9.99"
          period="/ month"
          sub="or about $89 / year"
          current={plan === 'unleashed'}
          comingSoon
          features={['Pawlie AI, unlimited', 'Smart Upload, unlimited', 'Up to 7 pets', 'All core features']}
        />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Paid plans aren't available yet — everyone's on Pawlie Lite for now. Nothing to pay or manage until that changes.
      </p>
    </div>
  );
}
