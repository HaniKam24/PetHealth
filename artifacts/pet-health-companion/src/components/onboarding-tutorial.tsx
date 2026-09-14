import { useEffect, useState } from 'react';
import { HeartPulse, ClipboardList, Upload, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

const SLIDES = [
  {
    icon: HeartPulse,
    title: 'Your daily home base',
    body: "\"Today\" is where you land every time you open the app — upcoming reminders, medication doses, and a quick look at each pet's info, all in one place.",
  },
  {
    icon: ClipboardList,
    title: 'Everything about them, in one file',
    body: 'Records, Medicines, and Reminders keep the full history. The Symptom Journal lets you log how they\'re doing day to day — and if a pattern is worth a second look, you\'ll see a heads-up right on Today.',
  },
  {
    icon: Upload,
    title: 'Skip the retyping',
    body: 'Got a vet report? Upload it under "Uploads" any time and we\'ll propose the records, medications, and reminders to add — you review and confirm before anything is saved.',
  },
  {
    icon: MessageCircle,
    title: 'Meet Pawlie',
    body: "Pawlie is your AI assistant — ask it anything about a pet, grounded in their actual file, not generic advice. It can even make changes for you, like adding a reminder, but never without you confirming first.",
  },
] as const;

export function OnboardingTutorial({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on('select', () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  const isLast = current === SLIDES.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-0 gap-0">
        <DialogTitle className="sr-only">Welcome to Health Hub</DialogTitle>
        <Carousel setApi={setApi} className="w-full overflow-hidden rounded-t-3xl">
          <CarouselContent>
            {SLIDES.map((slide, i) => {
              const Icon = slide.icon;
              return (
                <CarouselItem key={i}>
                  <div className="p-8 flex flex-col items-center text-center min-h-[280px]">
                    <div className="w-16 h-16 rounded-2xl bg-accent text-primary flex items-center justify-center mb-5">
                      <Icon size={30} strokeWidth={2} />
                    </div>
                    <h2 className="font-serif text-2xl font-extrabold tracking-tight mb-2">{slide.title}</h2>
                    <p className="text-[15.5px] text-muted-foreground leading-relaxed">{slide.body}</p>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        <div className="px-6 pb-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i === current ? 'bg-primary' : 'bg-border',
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 px-4 rounded-full text-sm font-bold text-muted-foreground hover:bg-accent transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => (isLast ? onOpenChange(false) : api?.scrollNext())}
              className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/90 transition-colors"
            >
              {isLast ? "Let's go" : 'Next'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
