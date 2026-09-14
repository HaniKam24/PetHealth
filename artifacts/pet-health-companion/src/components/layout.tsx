import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { HeartPulse, ChevronDown, Plus, LogOut } from 'lucide-react';
import { usePetContext } from '@/context/pet-context';
import { useListPets } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';
import { signOut, useSession } from '@/lib/auth-client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  { href: '/', label: 'Today' },
  { href: '/records', label: 'Records' },
  { href: '/medications', label: 'Medicines' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/insights', label: 'Pawlie' },
  { href: '/smart-upload', label: 'Uploads' },
  { href: '/profile', label: 'Profile' },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { activePetId, setActivePetId } = usePetContext();
  const { data: pets } = useListPets();
  const { data: session } = useSession();

  const activePet = pets?.find((pet) => pet.id === activePetId) ?? null;
  const otherPet = pets?.find((pet) => pet.id !== activePetId) ?? null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="h-[72px] shrink-0 px-6 md:px-10 flex items-center justify-between bg-card border-b border-border">
        <div className="flex items-center gap-4 md:gap-7 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-[10px] bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <HeartPulse size={18} strokeWidth={2.5} />
            </div>
            <span className="font-serif text-lg font-extrabold tracking-tight hidden sm:inline">Health Hub</span>
          </Link>

          <nav className="flex gap-1.5 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'h-9 flex items-center px-4 rounded-full text-[14.5px] font-semibold whitespace-nowrap transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-10 flex items-center gap-2 pl-1 pr-3.5 rounded-full bg-accent border border-border hover:border-primary/30 transition-colors">
                {activePet && resolvePetAvatar(null, activePet.species) ? (
                  <img
                    src={resolvePetAvatar(null, activePet.species)!}
                    alt=""
                    className="w-[30px] h-[30px] rounded-full bg-background"
                  />
                ) : (
                  <div className="w-[30px] h-[30px] rounded-full bg-muted flex items-center justify-center font-serif text-sm font-semibold text-muted-foreground">
                    {activePet?.name.charAt(0) ?? '?'}
                  </div>
                )}
                <span className="text-[14.5px] font-semibold max-w-24 truncate">{activePet?.name ?? 'Add a pet'}</span>
                <ChevronDown size={16} className="opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {pets && pets.length > 0 && (
                <>
                  <DropdownMenuLabel>Your pets</DropdownMenuLabel>
                  {pets.map((pet) => (
                    <DropdownMenuItem
                      key={pet.id}
                      onSelect={() => setActivePetId(pet.id)}
                      className="gap-2.5 py-2"
                    >
                      {resolvePetAvatar(null, pet.species) ? (
                        <img src={resolvePetAvatar(null, pet.species)!} alt="" className="w-7 h-7 rounded-full bg-muted shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                          {pet.name.charAt(0)}
                        </div>
                      )}
                      <span className="flex-1 truncate">{pet.name}</span>
                      {pet.id === activePetId && <span className="text-xs font-semibold text-primary">Showing</span>}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {(!pets || pets.length < 3) && (
                <DropdownMenuItem onSelect={() => setLocation('/profile?new=true')} className="gap-2.5">
                  <Plus size={16} />
                  Add another pet
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void signOut().then(() => setLocation('/login'));
                }}
                className="gap-2.5 text-muted-foreground"
              >
                <LogOut size={16} />
                <span className="truncate">{session?.user.email ?? 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {otherPet && (
            <button onClick={() => setActivePetId(otherPet.id)} className="shrink-0 opacity-55 hover:opacity-90 transition-opacity" title={`Switch to ${otherPet.name}`}>
              {resolvePetAvatar(null, otherPet.species) ? (
                <img src={resolvePetAvatar(null, otherPet.species)!} alt={otherPet.name} className="w-[34px] h-[34px] rounded-full bg-muted" />
              ) : (
                <div className="w-[34px] h-[34px] rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                  {otherPet.name.charAt(0)}
                </div>
              )}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 min-w-0 overflow-y-auto relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-0">{children}</div>
      </main>
    </div>
  );
}
