import { Sparkles } from 'lucide-react';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" data-testid="brand-mark">
      <span className="grid size-8 place-items-center rounded-[11px] bg-primary text-primary-foreground shadow-sm">
        <Sparkles size={15} strokeWidth={2.3} />
      </span>
      {!compact && <span className="font-[var(--app-font-serif)] text-[17px] font-semibold tracking-[-0.04em]">NOVA</span>}
    </span>
  );
}