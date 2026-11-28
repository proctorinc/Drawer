import { useState } from 'react';
import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import DrawingDesk from './components/DrawingDesk';
import { ColorDabs } from './components/PromptTitle';
import type { ToOptions } from '@tanstack/react-router';
import type { CSSProperties, FC } from 'react';
import type { DailyPrompt, RedoGrant } from '@/api/Api';
import { useGetRedos } from '@/api/Api';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import { clearRedoDraft, redoDraftKey } from '@/daily/drafts';
import { isSameDay, parseDay } from '@/days';
import { DrawingProvider } from '@/drawing/DrawingContext';
import { cn, highlightColor } from '@/utils';

type RedoPrompt = Omit<DailyPrompt, 'isCompleted'>;

const longDay = (day: string) =>
  parseDay(day)
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
    })
    .toLowerCase();

/** A redo kept for exactly this day, if there is one */
const grantFor = (grants: Array<RedoGrant>, day: string) =>
  grants.find((grant) => grant.day && isSameDay(grant.day, day));

/** The missed prompts you can spend a redo on, newest first */
export const RedoListPage = () => {
  const { data, isLoading } = useGetRedos();

  if (isLoading) return <LoadingScreen />;
  const grants = data?.grants ?? [];
  const prompts = data?.prompts ?? [];
  const free = data?.freeDays ?? [];
  const count = grants.length + free.length;
  const anyDay = grants.filter((grant) => !grant.day).length;

  return (
    <Layout back>
      <header className="flex flex-col gap-1 w-full text-center">
        <h1 className="font-accent font-bold text-4xl leading-none">redos</h1>
        <p className="text-pencil text-balance">
          {count === 0
            ? "you don't have any redos right now"
            : `you have ${count === 1 ? 'a redo' : `${count} redos`}: draw a prompt you missed and pin it to its day`}
        </p>
      </header>

      {grants.length > 0 && prompts.length === 0 && (
        <p className="text-center text-pencil">
          you haven't missed any prompts they cover. nice!
        </p>
      )}

      <ul className="flex flex-col gap-3 w-full">
        {prompts.map((prompt) => {
          const kept = grantFor(grants, prompt.day);
          const isFree = free.some((day) => isSameDay(day, prompt.day));
          return (
            <li key={prompt.day}>
              <Link
                to="/draw/redo/$day"
                params={{ day: prompt.day.slice(0, 10) }}
                className="press flex items-center gap-3 w-full px-4 py-3 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm hover:-rotate-1 transition-[rotate] duration-300"
              >
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-sm leading-none text-pencil">
                    {longDay(prompt.day)}
                  </span>
                  <span className="font-accent font-bold text-2xl leading-tight">
                    <span
                      className="highlight"
                      style={
                        {
                          '--hl': highlightColor(prompt.colors[2] ?? '#ffd45a'),
                        } as CSSProperties
                      }
                    >
                      {prompt.prompt.toLowerCase()}
                    </span>
                  </span>
                  {isFree ? (
                    <span className="text-sm leading-tight text-pencil">
                      a doodlemas day: this redo's on the house
                    </span>
                  ) : (
                    kept && (
                      <span className="text-sm leading-tight text-pencil">
                        a redo saved for this day
                        {kept.note && `: ${kept.note}`}
                      </span>
                    )
                  )}
                </div>
                <div className={cn('flex-none scale-75 origin-right')}>
                  <ColorDabs colors={prompt.colors} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {anyDay > 0 && prompts.length > 0 && (
        <p className="text-sm text-center text-pencil">
          a redo for any day works on any prompt since you joined
        </p>
      )}
    </Layout>
  );
};

const RedoDesk: FC<{
  prompt: RedoPrompt;
  backTo: ToOptions;
  onDone: () => void;
}> = ({ prompt, backTo, onDone }) => {
  const { submitPrompt } = useDailyPrompt();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(png: Blob) {
    setError(null);
    submitPrompt(png, {
      day: prompt.day,
      onSuccess: (submission) => {
        // Pinned: the redo is spent and its draft has nothing left to wait for
        clearRedoDraft(prompt.day);
        onDone();
        navigate({
          to: '/draw/submission/$submissionId',
          params: { submissionId: submission.id },
          replace: true,
        });
      },
      onError: () => setError('Failed to submit drawing'),
    });
  }

  return (
    <DrawingDesk
      dailyPrompt={{ ...prompt, isCompleted: false }}
      error={error}
      onSubmit={handleSubmit}
      pinning={null}
      past={{
        title: 'redo',
        detail: longDay(prompt.day),
        backTo,
      }}
    />
  );
};

/**
 * Drawing a missed prompt with a redo; kept on this device until it's pinned.
 * Back goes wherever it was opened from (backTo).
 */
export const RedoDeskPage: FC<{ day: string; backTo: ToOptions }> = ({
  day,
  backTo,
}) => {
  const { data, isLoading } = useGetRedos();
  // Once it's pinned the prompt leaves the list; don't bounce on the way out
  const [done, setDone] = useState(false);

  if (isLoading) return <LoadingScreen />;
  if (done) return null;
  const prompt = data?.prompts.find((p) => isSameDay(p.day, day));
  if (!prompt) return <Navigate {...backTo} replace />;

  const key = redoDraftKey(day);
  return (
    <DrawingProvider key={key} localStorageKey={key}>
      <RedoDesk prompt={prompt} backTo={backTo} onDone={() => setDone(true)} />
    </DrawingProvider>
  );
};
