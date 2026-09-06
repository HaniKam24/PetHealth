import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, FileText, Pill, Bell, Sparkles, User, Plus, HeartPulse } from 'lucide-react';
import { usePetContext } from '@/context/pet-context';
import { useListPets } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { resolvePetAvatar } from '@/lib/pet-avatar';

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { activePetId, setActivePetId } = usePetContext();
  const { data: pets } = useListPets();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/records', label: 'Health Records', icon: FileText },
    { href: '/medications', label: 'Medications', icon: Pill },
    { href: '/reminders', label: 'Reminders', icon: Bell },
    { href: '/insights', label: 'AI Insights', icon: Sparkles },
    { href: '/profile', label: 'Pet Profile', icon: User },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-card border-r border-border flex flex-col shrink-0 overflow-y-auto z-10 shadow-sm md:shadow-none">
        <div className="p-6 pb-2">
          <Link href="/" className="flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <HeartPulse size={24} strokeWidth={2.5} />
             </div>
             <span className="font-serif text-2xl font-medium text-foreground tracking-tight">Health Hub</span>
          </Link>

          {pets && pets.length > 0 && (
             <div className="mb-8">
               <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 block px-1">Current Pet</label>
               <div className="flex flex-col gap-2">
                 {pets.map(pet => (
                   <button
                     key={pet.id}
                     onClick={() => setActivePetId(pet.id)}
                     className={cn(
                       "flex items-center gap-3 w-full p-2.5 rounded-xl transition-all duration-300 text-left border",
                       activePetId === pet.id 
                         ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]" 
                         : "bg-background border-border hover:border-primary/30 text-foreground"
                     )}
                   >
                      {resolvePetAvatar(null, pet.species) ? (
                         <img src={resolvePetAvatar(null, pet.species)!} alt={`${pet.species} avatar`} className="w-10 h-10 rounded-full object-cover bg-background" />
                     ) : (
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-serif text-lg font-medium shadow-inner", 
                          activePetId === pet.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {pet.name.charAt(0)}
                        </div>
                     )}
                     <div>
                       <div className="font-medium text-sm">{pet.name}</div>
                       <div className={cn("text-xs opacity-80", activePetId === pet.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{pet.species}</div>
                     </div>
                   </button>
                 ))}
                 <Link href="/profile?new=true" className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-left border border-dashed border-border mt-1">
                   <div className="w-10 h-10 rounded-full flex items-center justify-center bg-background border border-border shadow-sm">
                     <Plus size={16} />
                   </div>
                   <span className="font-medium text-sm">Add another pet</span>
                 </Link>
               </div>
             </div>
          )}

          <nav className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block px-1">Menu</label>
             {navItems.map(item => {
               const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
               return (
                 <Link
                   key={item.href}
                   href={item.href}
                   className={cn(
                     "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                     isActive 
                       ? "bg-primary/10 text-primary" 
                       : "text-muted-foreground hover:bg-accent hover:text-foreground"
                   )}
                 >
                   <item.icon size={18} className={cn(isActive ? "text-primary" : "opacity-70")} />
                   {item.label}
                 </Link>
               );
             })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-0">
           {children}
        </div>
      </main>
    </div>
  );
}
