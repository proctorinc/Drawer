import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { AdminPage, Panel, Section } from '../components/ui';
import type { FC, ReactNode } from 'react';
import Button from '@/components/Button';
import { Card, CardContent, CardHeader } from '@/components/Card';
import Chip from '@/components/Chip';
import Logo from '@/components/Logo';
import LogoIcon from '@/components/logo/LogoIcon';
import * as Icons from '@/components/icons';
import ProgressBar from '@/pages/trophies/components/ProgressBar';

const PALETTE = [
  'paper',
  'ink',
  'pencil',
  'line',
  'butter',
  'sky',
  'blush',
  'coral',
  'xmas-red',
  'xmas-green',
  'xmas-gold',
  'snow',
];

const THEMES: Array<string | null> = [null, 'christmas'];

const Specimen: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex items-center justify-center min-h-16">{children}</div>
    <span className="text-sm text-pencil">{label}</span>
  </div>
);

/** The app's building blocks side by side, for a visual once-over */
const BrandPage = () => (
  <AdminPage title="brand & ui" subtitle="logos, palette and shared components">
    <Section title="logo">
      <Panel className="flex flex-col gap-6 p-6">
        {THEMES.map((theme) => (
          <div key={theme ?? 'everyday'} className="flex items-center gap-10">
            <Logo size="lg" theme={theme} />
            {[24, 36, 52, 88].map((size) => (
              <Specimen key={size} label={`${size}px`}>
                <LogoIcon theme={theme} size={size} />
              </Specimen>
            ))}
            <span className="text-pencil">{theme ?? 'everyday'}</span>
          </div>
        ))}
      </Panel>
    </Section>

    <Section title="palette">
      <div className="grid grid-cols-6 gap-3">
        {PALETTE.map((name) => (
          <Panel key={name} className="overflow-hidden">
            <div
              className="h-16 border-b-2 border-ink"
              style={{ backgroundColor: `var(--color-${name})` }}
            />
            <div className="px-3 py-2 font-mono text-sm">{name}</div>
          </Panel>
        ))}
      </div>
    </Section>

    <Section title="buttons & chips">
      <Panel className="flex flex-wrap items-center gap-6 p-6">
        <Button disableLoad>primary</Button>
        <Button size="sm" disableLoad icon={faHeart}>
          primary sm
        </Button>
        <Button variant="base" disableLoad>
          base
        </Button>
        <Button variant="base" size="sm" disableLoad>
          base sm
        </Button>
        <Button disabled>disabled</Button>
        <Chip>plain chip</Chip>
        <Chip className="bg-butter">
          <Icons.TrophyIcon size={16} /> 3 trophies
        </Chip>
        <Chip className="bg-blush">almost there!</Chip>
      </Panel>
    </Section>

    <div className="grid grid-cols-2 gap-8">
      <Section title="card">
        <Card>
          <CardContent>
            <CardHeader title="card title" subtitle="a subtitle under it" />
            <p>Body copy in Patrick Hand.</p>
          </CardContent>
        </Card>
      </Section>
      <Section title="progress">
        <Panel className="flex flex-col gap-3 p-6">
          {[0, 1, 3, 5].map((value) => (
            <ProgressBar
              key={value}
              value={value}
              max={5}
              label={`${value} of 5`}
              fill={value === 5 ? 'bg-coral' : 'bg-butter'}
              className="h-4"
            />
          ))}
        </Panel>
      </Section>
    </div>

    <Section title="icons">
      <Panel className="grid grid-cols-9 gap-4 p-6">
        {Object.entries(Icons).map(([name, Icon]) => (
          <Specimen key={name} label={name.replace(/Icon$/, '')}>
            <Icon size={28} />
          </Specimen>
        ))}
      </Panel>
    </Section>
  </AdminPage>
);

export default BrandPage;
