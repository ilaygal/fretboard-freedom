import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Big, high-contrast choice button, easy to hit while holding a guitar. */
export function Chip({
  selected,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'min-h-12 shrink-0 rounded-2xl border px-4 text-base font-semibold transition-colors active:scale-[0.97]',
        selected ? 'border-spot bg-spot text-stage' : 'border-line bg-surface text-ink hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'min-h-14 rounded-2xl bg-spot px-6 text-lg font-bold text-stage active:scale-[0.98] disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'min-h-14 rounded-2xl border border-line bg-surface px-6 text-lg font-semibold text-ink active:scale-[0.98] disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A labelled group of chips that scrolls sideways on small screens. */
export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <div className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{children}</div>
    </div>
  );
}

export function PageHeader({ title, backTo = '/' }: { title: string; backTo?: string }) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-stage/90 px-4 py-3 backdrop-blur">
      <Link
        to={backTo}
        aria-label={t('nav.back')}
        className="flex min-h-12 min-w-12 items-center justify-center rounded-2xl bg-surface text-2xl"
      >
        <span aria-hidden="true">‹</span>
      </Link>
      <h1 className="text-xl font-bold">{title}</h1>
    </header>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-3xl bg-surface p-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
