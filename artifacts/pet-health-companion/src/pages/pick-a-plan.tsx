import { useLocation } from 'wouter';
import { HeartPulse, Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { setPlanSelected } from '@/lib/plan-selection-flag';

interface PlanCardProps {
  name: string;
  price: string;
  period?: string;
  features: string[];
  highlighted?: boolean;
  comingSoon?: boolean;
  onSelect?: () => void;
}

function PlanCard({ name, price, period, features, highlighted, comingSoon, onSelect }: PlanCardProps) {
  return (
    <Card className={`rounded-3xl relative ${highlighted ? 'border-primary shadow-md' : 'shadow-sm'}`}>
      {comingSoon && (
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
        <Button
          type="button"
          size="lg"
          variant={comingSoon ? 'outline' : 'default'}
          className="w-full rounded-full"
          disabled={comingSoon}
          onClick={onSelect}
        >
          {comingSoon ? 'Coming soon' : 'Continue with Free'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PickAPlan() {
  const [, setLocation] = useLocation();

  const handleContinueFree = () => {
    setPlanSelected();
    setLocation('/onboarding');
  };

  return (
    <div className="min-h-[100dvh] bg-background p-6 py-12">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <HeartPulse size={24} strokeWidth={2.5} />
          </div>
          <span className="font-serif text-2xl font-medium text-foreground tracking-tight">Health Hub</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-medium text-foreground">Choose your plan</h1>
          <p className="text-muted-foreground text-sm mt-1">Start free — upgrade later if you want more.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <PlanCard
            name="Free"
            price="$0"
            highlighted
            features={[
              'Up to 3 pets',
              'Health records, medications & reminders',
              'Pawlie AI chat',
              'Smart Document Upload',
              'Sitter/boarding share links',
            ]}
            onSelect={handleContinueFree}
          />
          <PlanCard
            name="Plus"
            price="—"
            comingSoon
            features={[
              'Everything in Free',
              'Unlimited pets',
              'Higher Pawlie & upload limits',
              'Priority support',
            ]}
          />
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Paid plans aren't available yet — everyone's on Free for now.
        </p>
      </div>
    </div>
  );
}
