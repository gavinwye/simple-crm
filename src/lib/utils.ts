export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(d: Date | number, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === 'number' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(d: Date | number) {
  const date = typeof d === 'number' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function relativeDays(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const days = Math.round((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 0) return `in ${-days} days`;
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  return `${days} days ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const COLOUR_CLASSES: Record<string, { bg: string; text: string }> = {
  amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
  slate: { bg: 'bg-slate-200', text: 'text-slate-700' },
};

export function avatarClasses(colour: string | null | undefined) {
  return COLOUR_CLASSES[colour ?? 'slate'] ?? COLOUR_CLASSES.slate;
}
