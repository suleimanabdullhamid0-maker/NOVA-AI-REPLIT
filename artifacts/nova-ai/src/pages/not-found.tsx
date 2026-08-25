import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="nova-noise grid min-h-[100dvh] place-items-center bg-background px-6 text-foreground">
      <div className="max-w-[470px] text-center nova-rise">
        <div className="mx-auto grid size-16 place-items-center rounded-[22px] border border-border bg-card shadow-sm"><Compass size={25} className="text-accent-foreground" /></div>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">NOVA / signal lost</p>
        <h1 className="mt-3 font-[var(--app-font-serif)] text-5xl font-semibold tracking-[-.07em]">This thought<br /><span className="text-muted-foreground">isn’t here.</span></h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">The page you’re looking for may have moved, or it may never have been part of this thread.</p>
        <Link href="/chat" className="mx-auto mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground hover:-translate-y-0.5" data-testid="link-return-chat"><ArrowLeft size={14} /> Return to NOVA</Link>
      </div>
    </div>
  );
}
