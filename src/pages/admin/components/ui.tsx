import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FC, ReactNode } from 'react';
import { DECORATIONS } from '@/decorations/decorations';
import { cn } from '@/utils';

/** A sub-page's title bar and body */
export const AdminPage: FC<{
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}> = ({ title, subtitle, actions, children }) => (
  <div className="flex flex-col gap-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-accent font-bold text-4xl leading-none">{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-pencil">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
    {children}
  </div>
);

/** A titled block of a page */
export const Section: FC<{
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ title, aside, className, children }) => (
  <section className={cn('flex flex-col gap-3', className)}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1 border-b-2 border-dashed border-line">
      <h2 className="font-accent font-bold text-2xl leading-none">{title}</h2>
      {aside && <span className="text-pencil">{aside}</span>}
    </div>
    {children}
  </section>
);

/** A white sketch-outlined box */
export const Panel: FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <div
    className={cn(
      'bg-white border-2 border-ink rounded-sketch shadow-pencil-sm',
      className,
    )}
  >
    {children}
  </div>
);

export const StatTile: FC<{
  label: string;
  value: ReactNode;
  className?: string;
}> = ({ label, value, className }) => (
  <Panel className={cn('flex flex-col gap-1 px-4 py-3', className)}>
    <span className="font-accent font-bold text-3xl leading-none">{value}</span>
    <span className="text-pencil">{label}</span>
  </Panel>
);

/** A small rounded tag */
export const Tag: FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 text-sm leading-tight bg-paper border-[1.5px] border-ink rounded-full whitespace-nowrap',
      className,
    )}
  >
    {children}
  </span>
);

export const SearchInput: FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <label className="relative block w-full sm:w-72">
    <FontAwesomeIcon
      icon={faSearch}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-pencil"
    />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full py-2 pl-9 pr-3 bg-white border-2 border-ink rounded-sketch-alt focus:outline-none focus:ring-2 focus:ring-butter"
    />
  </label>
);

/** Renders a query's data, or its loading and error states */
export function Loaded<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return <p className="py-10 text-center text-pencil">loading…</p>;
  }
  if (query.isError) {
    return (
      <p className="py-10 text-center text-coral">{query.error.message}</p>
    );
  }
  return <>{children(query.data)}</>;
}

/** Table cell classes, so every admin table lines up the same way */
export const th =
  'px-3 py-2 text-left font-accent font-bold text-lg whitespace-nowrap';
export const td = 'px-3 py-2 align-middle';

export const Table: FC<{ head: ReactNode; children: ReactNode }> = ({
  head,
  children,
}) => (
  <Panel className="overflow-x-auto">
    {/* Columns keep a readable width; narrow screens scroll the table */}
    <table className="w-full min-w-[640px] border-collapse">
      <thead className="border-b-2 border-ink bg-paper">
        <tr>{head}</tr>
      </thead>
      <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&>tr:hover]:bg-paper">
        {children}
      </tbody>
    </table>
  </Panel>
);

export const Swatches: FC<{ colors: Array<string>; size?: string }> = ({
  colors,
  size = 'size-4',
}) => (
  <span className="inline-flex gap-1">
    {colors.map((color, i) => (
      <span
        key={i}
        title={color}
        className={cn(size, 'rounded-full border-[1.5px] border-ink')}
        style={{ backgroundColor: color }}
      />
    ))}
  </span>
);

export const formatDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const formatDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** A decoration's name, or its id when this build doesn't know it yet */
export const decorationName = (id: string) =>
  (DECORATIONS as Partial<Record<string, { name: string }>>)[id]?.name ?? id;
