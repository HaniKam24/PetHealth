import { Link, useLocation } from 'wouter';
import { HeartPulse, ChevronDown, Plus, LogOut } from 'lucide-react';
import { usePetContext } from '@/context/pet-context';
import { useListPets } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import { signOut, useSession } from '@/lib/auth-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TopBar() {
  const [location, setLocation] = useLocation();
  const { activePetId, setActivePetId } = usePetContext();
  const { data: pets } = useListPets();
  const { data: session } = useSession();

  const activePet = pets?.find((pet) => pet.id === activePetId);
  const otherPets = (pets ?? []).filter((pet) => pet.id !== activePetId);

  const tabs = [
    { href: '/', label: 'Today' },
    { href: '/records', label: activePet ? `${activePet.name}'s file` : 'Health records' },
    { href: '/medications', label: 'Medicines' },
    { href: '/insights', label: 'Ask a question' },
  ];

  return (
    <div className="h-[72px] px-6 md:px-10 flex items-center justify-between bg-card border-b border-border shrink-0">
      <div className="flex items-center gap-4 md:gap-7 min-w-0">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-[10px] bg-primary text-primary-foreground flex items-center justify-center">
            <HeartPulse size={18} strokeWidth={2.5} />
          </div>
          <span className="hidden sm:inline font-serif text-[19px] font-extrabold tracking-tight text-foreground">
            Health Hub
          </span>
        </Link>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = location === tab.href || (tab.href !== '/' && location.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'h-9 flex items-center px-4 rounded-full text-sm whitespace-nowrap transition-colors',
                  isActive ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground font-semibold hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {pets && pets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-10 flex items-center gap-2 pl-1 pr-3.5 rounded-full bg-muted border border-border hover:border-primary/30 transition-colors"
              >
                {activePet && resolvePetAvatar(null, activePet.species) ? (
                  <img
                    src={resolvePetAvatar(null, activePet.species)!}
                    alt=""
                    className="w-[30px] h-[30px] rounded-full"
                  />
                ) : (
                  <div className="w-[30px] h-[30px] rounded-full bg-accent flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {activePet?.name.charAt(0) ?? '?'}
                  </div>
                )}
                <span className="text-sm font-bold text-foreground">{activePet?.name ?? 'Select a pet'}</span>
                <ChevronDown size={16} className="opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Your pets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {pets.map((pet) => (
                <DropdownMenuItem key={pet.id} onSelect={() => setActivePetId(pet.id)} className="gap-2.5">
                  {resolvePetAvatar(null, pet.species) ? (
                    <img src={resolvePetAvatar(null, pet.species)!} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {pet.name.charAt(0)}
                    </div>
                  )}
                  <span className={cn(pet.id === activePetId && 'font-semibold text-primary')}>{pet.name}</span>
                </DropdownMenuItem>
              ))}
              {pets.length < 3 && (
                <DropdownMenuItem asChild className="gap-2.5">
                  <Link href="/profile?new=true">
                    <Plus size={14} /> Add another pet
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2.5 text-muted-foreground"
                onSelect={() => {
                  void signOut().then(() => setLocation('/login'));
                }}
              >
                <LogOut size={14} />
                <span className="truncate">{session?.user.email ?? 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {otherPets[0] && resolvePetAvatar(null, otherPets[0].species) && (
          <img
            src={resolvePetAvatar(null, otherPets[0].species)!}
            alt={otherPets[0].name}
            className="hidden md:block w-[34px] h-[34px] rounded-full opacity-55"
          />
        )}
      </div>
    </div>
  );
}
