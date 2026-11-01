import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/app/profile';

const READY = [
  { id: 'improv', to: '/improv', hint: 'improvHint' },
  { id: 'explore', to: '/explore', hint: 'exploreHint' },
  { id: 'fretboardMastery', to: '/notes', hint: 'notesHint' },
  { id: 'tools', to: '/tools', hint: 'toolsHint' },
] as const;
const SOON = ['chords', 'ear', 'solo'] as const;

export function HomePage() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t('app.name')}</h1>
          <p className="text-muted">{t('app.tagline')}</p>
          {profile && <p className="mt-1 text-sm text-muted">{profile.name}</p>}
        </div>
        <Link
          to="/settings"
          aria-label={t('nav.settings')}
          className="flex min-h-12 min-w-12 items-center justify-center rounded-2xl bg-surface text-2xl"
        >
          <span aria-hidden="true">⚙</span>
        </Link>
      </header>

      <Link
        to="/play"
        className="block rounded-3xl bg-spot p-6 text-stage shadow-[0_0_60px_-15px] shadow-spot active:scale-[0.99]"
      >
        <div className="text-3xl font-black">▶ {t('home.freePlay')}</div>
        <div className="font-medium opacity-80">{t('home.freePlayHint')}</div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {READY.map((x) => (
          <Link key={x.id} to={x.to} className="rounded-3xl border border-line bg-surface-2 p-4 active:scale-[0.98]">
            <div className="text-lg font-bold">{t(`home.${x.id}`)}</div>
            <div className="text-sm text-muted">{t(`home.${x.hint}`)}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SOON.map((id) => (
          <div key={id} className="rounded-3xl border border-line bg-surface p-4 opacity-60" aria-disabled="true">
            <div className="text-xs font-bold uppercase tracking-wide text-spot">{t('home.soon')}</div>
            <div className="text-lg font-bold">{t(`home.${id}`)}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
