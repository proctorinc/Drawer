import { AdminPage, Panel, Section } from '../components/ui';
import type { FC } from 'react';
import type { PencilSound } from '@/drawing/feedback';
import { useAppSettings, useUpdateAppSettings } from '@/api/appSettings';
import { PENCIL_SOUNDS, previewFeedback } from '@/drawing/feedback';
import { CheckIcon, SpeakerIcon } from '@/components/icons';
import { cn } from '@/utils';

const ABOUT: Record<PencilSound, { name: string; description: string }> = {
  pencil: {
    name: 'standard pencil',
    description:
      'Graphite on paper: a soft brush under the tip, the odd scratch as it digs in, and a dry tick for taps.',
  },
  musical: {
    name: 'musical',
    description:
      'The same soft brush, with warm, mellow notes in place of scratches. Higher on the page plays higher.',
  },
};

/** App-wide settings admins choose for everyone */
const AppSettingsPage: FC = () => {
  const { data, isPending, error } = useAppSettings();
  const update = useUpdateAppSettings();
  const current = update.isPending
    ? update.variables.pencilSound
    : data?.pencilSound;

  return (
    <AdminPage title="settings" subtitle="Choices that apply to everyone">
      <Section
        title="pencil sound"
        aside={
          update.isError
            ? "Couldn't save, try again"
            : update.isPending
              ? 'saving…'
              : 'what everyone hears while they draw'
        }
      >
        {error ? (
          <p className="text-coral">Couldn't load the settings.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {PENCIL_SOUNDS.map((sound) => {
              const chosen = sound === current;
              return (
                <Panel
                  key={sound}
                  className={cn(
                    'flex flex-col gap-3 p-4',
                    chosen && 'bg-me',
                    isPending && 'opacity-50',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-accent font-bold text-2xl leading-none">
                      {ABOUT[sound].name}
                    </h3>
                    {chosen && (
                      <span className="flex items-center gap-1 text-sm font-bold">
                        <CheckIcon size={16} />
                        in use
                      </span>
                    )}
                  </div>
                  <p className="text-pencil leading-snug">
                    {ABOUT[sound].description}
                  </p>
                  <div className="flex gap-2 mt-auto">
                    <button
                      type="button"
                      onClick={() => previewFeedback('sound', sound)}
                      className="press flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-ink rounded-sketch-alt cursor-pointer"
                    >
                      <SpeakerIcon size={18} />
                      listen
                    </button>
                    {!chosen && (
                      <button
                        type="button"
                        disabled={isPending || update.isPending}
                        onClick={() => update.mutate({ pencilSound: sound })}
                        className="press px-3 py-1.5 bg-ink text-paper border-2 border-ink rounded-sketch-alt cursor-pointer disabled:opacity-50"
                      >
                        use for everyone
                      </button>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
        <p className="text-sm text-pencil">
          A preview plays at your own sound level from the canvas settings. Draw
          on the{' '}
          <a href="/draw/admin/drawing" className="underline">
            drawing canvas
          </a>{' '}
          to hear it properly.
        </p>
      </Section>
    </AdminPage>
  );
};

export default AppSettingsPage;
