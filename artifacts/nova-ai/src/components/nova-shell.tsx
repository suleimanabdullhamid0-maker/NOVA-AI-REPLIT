import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useLogout } from '@workspace/api-client-react';
import { ArrowUpRight, CreditCard, LogOut, Menu, MessageSquare, Moon, Settings, ShieldCheck, Sun, X } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';

type ShellUser = { name?: string | null; email: string; role?: string; plan?: string; usage?: number; usageLimit?: number };

const navItems = [
  { href: '/chat', label: 'Assistant', icon: MessageSquare },
  { href: '/pricing', label: 'Plans', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('nova-theme') as 'light' | 'dark') || 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('nova-theme', theme);
  }, [theme]);
  return { theme, setTheme };
}

function Initials({ user }: { user?: ShellUser }) {
  const value = user?.name || user?.email || 'N';
  return <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold tracking-tight text-accent-foreground" data-testid="avatar-user">{value.slice(0, 2).toUpperCase()}</span>;
}

export function NovaShell({ children, user }: { children: React.ReactNode; user?: ShellUser }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const logoutMutation = useLogout();

  const handleLogout = () => logoutMutation.mutate(undefined, { onSuccess: () => setLocation('/login') });

  return (
    <div className="nova-noise min-h-[100dvh] bg-background text-foreground">
      <div className="flex min-h-[100dvh]">
        <aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 transition-transform duration-300 md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`} data-testid="sidebar-navigation">
          <div className="flex items-center justify-between px-2">
            <BrandMark />
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X size={17} /></button>
          </div>
          <button onClick={() => { setLocation('/chat'); setMobileOpen(false); }} className="mt-9 flex w-full items-center justify-between rounded-xl bg-sidebar-primary px-3.5 py-3 text-left text-sm font-semibold text-sidebar-primary-foreground shadow-sm hover:-translate-y-0.5" data-testid="button-new-chat">
            <span className="flex items-center gap-2"><span className="text-lg leading-none">+</span> New conversation</span>
            <span className="font-mono text-[10px] opacity-50">⌘ N</span>
          </button>
          <nav className="mt-8 space-y-1" aria-label="Primary navigation">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || (item.href === '/chat' && location.startsWith('/chat'));
              return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid={`link-nav-${item.label.toLowerCase()}`}><Icon size={16} strokeWidth={active ? 2.2 : 1.8} /><span>{item.label}</span>{active && <span className="ml-auto size-1.5 rounded-full bg-accent" />}</Link>;
            })}
            {user?.role === 'ADMIN' && <Link href="/admin" onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${location === '/admin' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid="link-nav-admin"><ShieldCheck size={16} /><span>Admin console</span></Link>}
          </nav>
          <div className="mt-auto">
            <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/55 p-3.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-sidebar-foreground/70">Monthly usage</span>
                <span className="font-mono text-sidebar-foreground/55">{user?.usage ?? 0}/{user?.usageLimit ?? 100}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar-border"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, ((user?.usage ?? 0) / (user?.usageLimit || 100)) * 100)}%` }} /></div>
              <Link href="/pricing" className="mt-3 flex items-center justify-between text-[11px] font-semibold text-sidebar-foreground hover:text-accent" data-testid="link-upgrade-sidebar">See NOVA Pro <ArrowUpRight size={13} /></Link>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
              <Initials user={user} />
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user?.name || 'Your workspace'}</p><p className="truncate text-[11px] text-sidebar-foreground/55">{user?.email}</p></div>
              <button onClick={handleLogout} className="rounded-lg p-2 text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Log out" data-testid="button-logout"><LogOut size={15} /></button>
            </div>
          </div>
        </aside>
        {mobileOpen && <button className="fixed inset-0 z-20 bg-foreground/20 backdrop-blur-[2px] md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu overlay" data-testid="button-menu-overlay" />}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-border/75 bg-background/85 px-5 backdrop-blur-xl md:px-9">
            <button className="rounded-xl border border-border p-2.5 hover:bg-muted md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={18} /></button>
            <div className="hidden md:block"><span className="font-mono text-[10px] uppercase tracking-[0.19em] text-muted-foreground">Personal intelligence / {location === '/chat' ? 'active session' : location.slice(1)}</span></div>
            <div className="flex items-center gap-2">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-xl border border-border p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} data-testid="button-toggle-theme">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
              <div className="hidden h-7 w-px bg-border sm:block" />
              <span className="hidden rounded-full bg-accent/25 px-2.5 py-1 font-mono text-[10px] font-medium text-accent-foreground sm:inline-flex" data-testid="status-plan">{user?.plan === 'PREMIUM' ? 'PRO PLAN' : 'FREE PLAN'}</span>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

export function SurfaceLoader() {
  return <div className="space-y-5 p-6 md:p-10"><div className="nova-skeleton h-5 w-28 rounded" /><div className="nova-skeleton h-12 w-2/3 rounded-xl" /><div className="grid gap-4 md:grid-cols-3"><div className="nova-skeleton h-32 rounded-2xl" /><div className="nova-skeleton h-32 rounded-2xl" /><div className="nova-skeleton h-32 rounded-2xl" /></div><div className="nova-skeleton h-64 rounded-2xl" /></div>;
}