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
  features,
  current,
  comingSoon,
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  current: boolean;
  comingSoon?: boolean;
}) {
  return (
    <Card className={`rounded-3xl relative ${current ? 'border-primary shadow-md' : 'shadow-sm'}`}>
      {current && (
        <div className="absolute top-4 right-4 flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 rounded-full px-3 py-1">
          Current plan
        </div>
      )}
      {!current && comingSoon && (
        <div className="absolute top-4 right-4 flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted rounded-full px-3 py-1">
          <Lock size={12} /> Coming soon
        </div>
      )}
      <CardHeader className="pb-2">
        <h2 className="text-xl font-serif font-medium text-foreground">{name}</h2>
        <p className="mt-1">
          <span className="text-3xl font-serif font-bold text-foreground">{price}</span>
          {period && <span className="text-muted-foreground text-sm"> {period}</span>}
        </p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <PlanCard
          name="Free"
          price="$0"
          current={plan === 'free'}
          features={[
            'Up to 3 pets',
            'Health records, medications & reminders',
            'Pawlie AI chat',
            'Smart Document Upload',
            'Sitter/boarding share links',
          ]}
        />
        <PlanCard
          name="Plus"
          price="—"
          current={plan === 'plus'}
          comingSoon
          features={[
            'Everything in Free',
            'Unlimited pets',
            'Higher Pawlie & upload limits',
            'Priority support',
          ]}
        />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Paid plans aren't available yet — everyone's on Free for now. Nothing to pay or manage until that changes.
      </p>
    </div>
  );
}
