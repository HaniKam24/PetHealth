import { Link } from 'wouter';
import {
  HeartPulse,
  Bell,
  IdCard,
  ShieldCheck,
  Pill,
  FileUp,
  TrendingUp,
  PawPrint,
  Sparkles,
  ShieldAlert,
  ListChecks,
  History,
  CalendarClock,
  Eye,
  Link2Off,
  Share2,
  Check,
} from 'lucide-react';
import { resolvePetAvatar } from '@/lib/pet-avatar';

const NAV_LINKS = [
  { href: '#pawlie', label: 'Pawlie' },
  { href: '#features', label: 'Features' },
  { href: '#sharing', label: 'Sitters' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#pricing', label: 'Pricing' },
];

const FEATURES = [
  {
    icon: IdCard,
    title: 'Pet passport',
    body: "One page with identity, microchip, allergies, vet and vaccine status. Print it or show it on your phone.",
  },
  {
    icon: ShieldCheck,
    title: 'Vaccines & reminders',
    body: "See what's current, due soon or overdue at a glance, and get reminded before the date slips.",
  },
  {
    icon: Pill,
    title: 'Medicines',
    body: 'Track ongoing and as-needed medicines with dose and schedule, so everyone at home knows what was given.',
  },
  {
    icon: FileUp,
    title: 'Smart Upload',
    body: 'Upload a vet document and review the details it found before anything is added to the profile.',
  },
  {
    icon: TrendingUp,
    title: 'Weight trends',
    body: "Log weigh-ins and see the change over time, so gradual gain or loss doesn't go unnoticed.",
  },
  {
    icon: PawPrint,
    title: 'Multi-pet households',
    body: 'Keep all your pets in one account, up to seven on Pawlie Unleashed, and switch between them from the top bar.',
  },
];

const PAWLIE_POINTS = [
  { icon: ShieldAlert, text: 'Flags anything urgent and points you toward care immediately.' },
  { icon: ListChecks, text: 'Can propose a reminder or record update — nothing changes until you approve it.' },
  { icon: History, text: 'Keeps separate conversation threads, so questions never get mixed up.' },
];

const SITTER_POINTS = [
  { icon: CalendarClock, text: 'You choose the date the link expires.' },
  { icon: Eye, text: 'See when it was last opened.' },
  { icon: Link2Off, text: "Revoke it the moment you're home." },
];

const PRIVACY_POINTS = [
  { title: "You decide what's shared", body: "Share links are read-only and only show the care details you've written for sitters." },
  { title: "Links don't last forever", body: 'Every link has an end date, and you can revoke it early.' },
  { title: 'Uploads wait for your OK', body: 'Smart Upload suggests changes. Nothing reaches the profile until you accept it.' },
  { title: 'Delete any time', body: "Remove a pet's profile and its records from the profile page." },
];

const PLANS = [
  {
    name: 'Pawlie Lite',
    price: '$0',
    period: null,
    sub: 'Free forever',
    features: ['Pawlie AI: 7-day trial, then Pawlie Plus and up', 'Smart Upload: 2 uploads', 'Up to 3 pets', 'All core features'],
    cta: 'Sign up free',
    featured: false,
  },
  {
    name: 'Pawlie Plus',
    price: '$4.99',
    period: '/ month',
    sub: 'or about $44 / year',
    features: ['Pawlie AI included, with a monthly cap', 'Smart Upload: 5 per month', 'Up to 5 pets', 'All core features'],
    cta: 'Start with Plus',
    featured: true,
  },
  {
    name: 'Pawlie Unleashed',
    price: '$9.99',
    period: '/ month',
    sub: 'or about $89 / year',
    features: ['Pawlie AI, unlimited', 'Smart Upload, unlimited', 'Up to 7 pets', 'All core features'],
    cta: 'Start with Unleashed',
    featured: false,
  },
] as const;

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
      <div className="w-8 h-8 rounded-[10px] bg-primary flex items-center justify-center text-primary-foreground shrink-0">
        <HeartPulse size={18} strokeWidth={2.5} />
      </div>
      <span className="font-serif text-lg font-extrabold tracking-tight">Health Hub</span>
    </Link>
  );
}

function PillButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
  size?: 'md' | 'lg';
}) {
  const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-full font-bold transition-colors';
  const sizing = size === 'lg' ? 'h-[52px] px-7 text-[16.5px]' : 'h-10 px-5 text-[14.5px]';
  const look =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_10px_24px_-10px_rgba(14,154,141,0.7)]'
      : 'bg-card border border-border text-foreground hover:border-primary/40';
  return (
    <Link href={href} className={`${base} ${sizing} ${look}`}>
      {children}
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="relative min-h-[100dvh] bg-[radial-gradient(ellipse_at_top_right,_rgba(14,154,141,0.08),_transparent_55%)]">
        <header className="max-w-[1160px] mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Brand />
          <nav className="hidden md:flex flex-1 justify-center items-center gap-1 overflow-x-auto">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap h-9 flex items-center px-3 rounded-full text-[14.5px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login" className="whitespace-nowrap h-10 flex items-center px-4 rounded-full text-[14.5px] font-bold text-foreground hover:bg-accent transition-colors">
              Sign in
            </Link>
            <PillButton href="/signup">Sign up free</PillButton>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-[1160px] mx-auto px-6 pt-10 pb-18 grid gap-12 items-center [grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr))]">
          <div>
            <h1 className="font-serif font-black tracking-[-0.035em] leading-[1.02] text-balance text-[40px] sm:text-[52px] lg:text-[64px]">
              Your pet's health, all in one place.
            </h1>
            <p className="mt-5 max-w-[520px] text-[18.5px] leading-relaxed text-muted-foreground text-pretty">
              PetHealth keeps vaccines, medicines, vet details and care notes together, and reminds you before anything is due. When a vet, sitter or boarding kennel asks, you have the answer.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 items-center">
              <PillButton href="/signup" size="lg">Sign up free</PillButton>
              <a
                href="#how"
                className="h-[52px] inline-flex items-center px-6 rounded-full border border-border bg-card text-foreground text-[16.5px] font-bold hover:border-primary/40 transition-colors"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free for up to 3 pets. Paid plans from $4.99/mo.</p>
          </div>

          <div className="relative rounded-[32px] bg-card border border-border p-7 shadow-[0_40px_80px_-40px_rgba(18,48,58,0.35)] grid grid-cols-[minmax(0,210px)_minmax(0,1fr)] gap-4 items-start">
            <div className="relative rounded-[22px] overflow-hidden bg-foreground text-background text-center">
              <div className="relative px-4 pt-5 pb-5 flex flex-col items-center">
                <div className="w-16 h-[9px] rounded-full bg-background/20" />
                <div className="mt-3 text-[9.5px] font-extrabold tracking-[0.16em] text-background/70">PET CARD</div>
                <img src={resolvePetAvatar(null, 'dog') ?? undefined} alt="" className="mt-3 w-[104px] h-[104px] rounded-full" />
                <div className="mt-2.5 font-serif text-[28px] font-extrabold tracking-[-0.025em]">Biscuit</div>
                <div className="text-[12.5px] text-background/75">Golden Retriever · Light gold</div>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-primary/30 text-primary">Vaccines current</span>
                  <span className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-amber-500/25 text-amber-300">Chicken</span>
                </div>
              </div>
              <div className="relative px-4 py-3 border-t border-dashed border-background/20">
                <div className="text-[9px] font-extrabold tracking-[0.14em] text-background/50">MICROCHIP</div>
                <div className="mt-1 font-mono text-[12.5px] font-semibold tracking-wide">985112004567321</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-0">
              <div className="border border-border rounded-[18px] px-4 py-3.5">
                <div className="font-serif text-[14.5px] font-extrabold">Vaccination Status</div>
                {[
                  { name: 'Rabies', due: 'due Mar 2028', status: 'CURRENT' as const },
                  { name: 'DHPP', due: 'due May 2027', status: 'CURRENT' as const },
                  { name: 'Bordetella', due: 'due Oct 2026', status: 'DUE SOON' as const },
                ].map((v) => (
                  <div key={v.name} className="mt-1.5 flex justify-between items-center gap-2 py-1.5 border-t border-border/70">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground">{v.due}</div>
                    </div>
                    <span
                      className={`h-[19px] px-2 rounded-full text-[10px] font-extrabold flex items-center ${
                        v.status === 'CURRENT' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-[18px] px-4 py-3.5 bg-accent border border-border flex gap-3 items-center">
                <div className="w-[34px] h-[34px] rounded-[10px] bg-card border border-border flex items-center justify-center shrink-0 text-primary">
                  <Bell size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold">Simparica Trio tomorrow</div>
                  <div className="text-xs text-muted-foreground">1 chew · monthly</div>
                </div>
              </div>
              <div className="rounded-[18px] px-4 py-3.5 border border-border">
                <div className="flex justify-between items-baseline">
                  <div className="font-serif text-[14.5px] font-extrabold">Weight</div>
                  <div className="text-[13px] font-bold">32.4 lb</div>
                </div>
                <div className="mt-2.5 h-11 flex items-end gap-1.5">
                  {[30, 45, 62, 70, 76, 84].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded ${i === 5 ? 'bg-foreground' : 'bg-primary/30'}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-card border-y border-border">
          <div className="max-w-[1160px] mx-auto px-6 py-20">
            <div className="text-[12.5px] font-extrabold tracking-[0.16em] text-primary">HOW IT WORKS</div>
            <h2 className="mt-2.5 font-serif font-black tracking-[-0.03em] leading-[1.1] text-balance max-w-[640px] text-[30px] sm:text-[36px] lg:text-[42px]">
              Set up in an afternoon. Useful for years.
            </h2>
            <div className="mt-11 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
              {[
                { n: 1, title: 'Add your pet', body: 'Name, species, breed, birthday, microchip and your vet. Use their photo or one of our illustrations.' },
                { n: 2, title: 'Upload their paperwork', body: 'Drop in vet invoices and vaccine certificates. Smart Upload reads them and suggests updates for you to accept.' },
                { n: 3, title: "Stay ahead of what's due", body: 'Reminders for vaccines and doses, a passport you can print, and a link to share when someone else is caring for them.' },
              ].map((step) => (
                <div key={step.n} className="rounded-3xl bg-accent border border-border p-6">
                  <div className="w-10 h-10 rounded-full bg-foreground text-background font-serif text-lg font-black flex items-center justify-center">
                    {step.n}
                  </div>
                  <h3 className="mt-4.5 font-serif text-xl font-extrabold tracking-[-0.02em]">{step.title}</h3>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Meet Pawlie */}
        <section id="pawlie" className="max-w-[1160px] mx-auto px-6 py-22 grid gap-12 items-center [grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr))]">
          <div>
            <div className="text-[12.5px] font-extrabold tracking-[0.16em] text-primary">MEET PAWLIE</div>
            <h2 className="mt-2.5 font-serif font-black tracking-[-0.03em] leading-[1.1] text-balance text-[30px] sm:text-[36px] lg:text-[42px]">
              Ask anything about their health. Get an answer grounded in their actual file.
            </h2>
            <p className="mt-4.5 max-w-[480px] text-[17px] leading-relaxed text-muted-foreground text-pretty">
              Pawlie reads the records you've already saved — vaccines, medicines, vet visits, weight — and answers in plain language. Not a generic chatbot guessing at symptoms; it only ever speaks from what's actually in your pet's file.
            </p>
            <div className="mt-7 grid gap-3.5">
              {PAWLIE_POINTS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex gap-3 items-start">
                  <Icon size={18} className="mt-0.5 shrink-0 text-primary" />
                  <span className="text-[16px] leading-relaxed text-muted-foreground">{text}</span>
                </div>
              ))}
            </div>
            <div className="mt-7">
              <PillButton href="/signup" size="lg">Try Pawlie free for 7 days</PillButton>
            </div>
          </div>

          <div className="rounded-[28px] bg-card border border-border p-5.5 shadow-[0_40px_80px_-40px_rgba(18,48,58,0.35)]">
            <div className="flex items-center gap-2 pb-3.5 border-b border-border">
              <div className="w-[30px] h-[30px] rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="font-serif text-[15px] font-extrabold">Pawlie · Biscuit's file</div>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="max-w-[78%] bg-foreground text-background px-4 py-3 rounded-[18px_18px_4px_18px] text-sm leading-relaxed">
                Is Bordetella due soon?
              </div>
            </div>
            <div className="mt-3 bg-accent border border-border px-4 py-3.5 rounded-[18px_18px_18px_4px] text-sm leading-relaxed">
              Yes — Biscuit's Bordetella is due <strong>October 2026</strong>, about 2 weeks out. Rabies and DHPP are both current. Want me to add a reminder for the week before?
            </div>
            <div className="mt-3 flex gap-2">
              <span className="h-[34px] px-3.5 flex items-center rounded-full bg-primary text-primary-foreground text-[12.5px] font-bold">Yes, remind me</span>
              <span className="h-[34px] px-3.5 flex items-center rounded-full border border-border text-muted-foreground text-[12.5px] font-bold">Not now</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-[1160px] mx-auto px-6 py-22">
          <div className="text-[12.5px] font-extrabold tracking-[0.16em] text-primary">FEATURES</div>
          <h2 className="mt-2.5 font-serif font-black tracking-[-0.03em] leading-[1.1] text-balance max-w-[680px] text-[30px] sm:text-[36px] lg:text-[42px]">
            Everything a vet asks for, kept current.
          </h2>
          <div className="mt-11 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-card border border-border rounded-3xl p-6">
                <div className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center text-primary">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 font-serif text-[19px] font-extrabold">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sitters */}
        <section id="sharing" className="bg-foreground text-background">
          <div className="max-w-[1160px] mx-auto px-6 py-22 grid gap-14 items-center [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
            <div>
              <div className="text-[12.5px] font-extrabold tracking-[0.16em] text-primary">FOR SITTERS &amp; KENNELS</div>
              <h2 className="mt-2.5 font-serif font-black tracking-[-0.03em] leading-[1.1] text-balance text-[30px] sm:text-[36px] lg:text-[42px]">
                Going away? Send one link instead of a long text.
              </h2>
              <p className="mt-4.5 max-w-[500px] text-[17px] leading-relaxed text-background/80 text-pretty">
                Write a sitter brief once: feeding, walks, where the leash lives, what normal looks like and the emergency vet. Then share a read-only link with vet contact, active medicines and notes. Your sitter doesn't need an account to open it.
              </p>
              <div className="mt-7 grid gap-3.5">
                {SITTER_POINTS.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex gap-3 items-start">
                    <Icon size={18} className="mt-0.5 shrink-0 text-primary" />
                    <span className="text-[16px] leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-background text-foreground rounded-[28px] p-6.5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2">
                <Share2 size={18} className="text-primary" />
                <div className="font-serif text-lg font-extrabold">Share care info with a sitter</div>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                A read-only link with Biscuit's vet contact, active medications, and notes — no account needed to view it.
              </p>
              <div className="mt-4 flex gap-2">
                <div className="h-11 flex-1 min-w-0 flex items-center px-3.5 rounded-xl bg-accent border border-border text-sm text-muted-foreground overflow-hidden whitespace-nowrap text-ellipsis">
                  pethealth.app/s/biscuit-7f3k2
                </div>
                <span className="h-11 px-4 flex items-center rounded-xl bg-primary text-primary-foreground text-sm font-bold">Copy</span>
              </div>
              <p className="mt-2.5 text-[12.5px] text-muted-foreground">Active until October 19, 2026 · last viewed Oct 6, 8:12 AM</p>
              <div className="mt-5 pt-4.5 border-t border-border grid grid-cols-2 gap-3.5">
                <div>
                  <div className="text-[11px] font-extrabold tracking-[0.12em] text-muted-foreground">FEEDING</div>
                  <div className="mt-1 text-sm leading-relaxed">2 cups salmon kibble, 7am and 6pm.</div>
                </div>
                <div>
                  <div className="text-[11px] font-extrabold tracking-[0.12em] text-destructive">CRITICAL</div>
                  <div className="mt-1 text-sm leading-relaxed">No chicken · door-dasher</div>
                </div>
                <div>
                  <div className="text-[11px] font-extrabold tracking-[0.12em] text-muted-foreground">WHERE THINGS ARE</div>
                  <div className="mt-1 text-sm leading-relaxed">Leash on the hook by the back door.</div>
                </div>
                <div>
                  <div className="text-[11px] font-extrabold tracking-[0.12em] text-muted-foreground">EMERGENCY VET</div>
                  <div className="mt-1 text-sm leading-relaxed">Open 24h · 12 min away</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="max-w-[1160px] mx-auto px-6 py-22">
          <div className="grid gap-10 items-center [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
            <div>
              <div className="text-[12.5px] font-extrabold tracking-[0.16em] text-primary">PRIVACY &amp; YOUR DATA</div>
              <h2 className="mt-2.5 font-serif font-black tracking-[-0.03em] leading-[1.1] text-balance text-[30px] sm:text-[36px] lg:text-[42px]">
                Your records stay yours.
              </h2>
              <p className="mt-4 max-w-[440px] text-[17px] leading-relaxed text-muted-foreground">
                Your pets' records sit behind your account sign-in. Nothing is shared unless you create a link.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              {PRIVACY_POINTS.map((p) => (
                <div key={p.title} className="bg-card border border-border rounded-[20px] px-5.5 py-5">
                  <div className="font-serif text-[17px] font-extrabold">{p.title}</div>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-card border-t border-border">
          <div className="max-w-[1160px] mx-auto px-6 py-22">
            <div className="text-[12.5px] font-extrabold tracking-[0.16em] text-primary">PRICING</div>
            <h2 className="mt-2.5 font-serif font-black tracking-[-0.03em] leading-[1.1] text-balance max-w-[640px] text-[30px] sm:text-[36px] lg:text-[42px]">
              Free forever for tracking. Upgrade when you want Pawlie in your corner.
            </h2>
            <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted-foreground">
              Every plan includes the passport, vaccine and medicine tracking, reminders and sitter share links. Paid plans unlock ongoing Pawlie AI, more Smart Uploads and room for more pets.
            </p>
            <div className="mt-11 grid gap-5 items-stretch [grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr))]">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-[28px] p-7 ${
                    plan.featured ? 'border-2 border-primary bg-accent' : 'border border-border bg-background'
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-7 h-[26px] px-3 rounded-full bg-primary text-primary-foreground text-xs font-extrabold tracking-wide flex items-center">
                      MOST POPULAR
                    </span>
                  )}
                  <div className="font-serif text-[22px] font-extrabold">{plan.name}</div>
                  <div className="mt-2.5 flex items-baseline gap-1 flex-wrap">
                    <span className="font-serif text-[44px] font-black tracking-[-0.03em] leading-none">{plan.price}</span>
                    {plan.period && <span className="text-[15px] text-muted-foreground">{plan.period}</span>}
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground min-h-5">{plan.sub}</div>
                  <div className="mt-5 pt-5 border-t border-border grid gap-2.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex gap-2.5 items-start text-[15px] leading-snug">
                        <Check size={17} className="mt-0.5 shrink-0 text-primary" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/signup"
                    className={`mt-auto pt-7 h-[50px] flex items-center justify-center rounded-full text-base font-extrabold transition-colors ${
                      plan.featured
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-background border border-border text-foreground hover:border-primary/40'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="max-w-[1160px] mx-auto px-6 py-7 flex justify-between items-center gap-4 flex-wrap text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-[22px] h-[22px] rounded-[7px] bg-primary flex items-center justify-center text-primary-foreground">
                <HeartPulse size={13} strokeWidth={2.5} />
              </div>
              <span className="font-serif font-extrabold text-foreground">Health Hub</span>
            </div>
            <div className="flex gap-5">
              <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
              <Link href="/signup" className="hover:text-foreground transition-colors">Create an account</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
