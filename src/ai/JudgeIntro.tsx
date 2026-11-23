import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { AIJudgeAvatar } from './AIJudgeAvatar';
import { useTypewriter, withoutArticle } from './AIDialogue';
import type { FC, ReactNode } from 'react';
import type { AIJudge } from '@/api/Api';
import { fetchAPI } from '@/api/apiClient';
import { useAnimationQueue } from '@/animations/AnimationQueue';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import useAuth from '@/auth/hooks/useAuth';
import Button from '@/components/Button';
import { SpeakerIcon } from '@/components/icons';
import { cn } from '@/utils';

/** Today's judge asking for today's doodle, a speech bubble per line */
export interface JudgeIntro {
  judge: AIJudge;
  day: string;
  prompt: string;
  lines: Array<string>;
  /**
   * Only when the judge scores backwards (the Grinch): whether you joined his
   * plot (true), refused (false), or haven't answered (null)
   */
  pledge?: boolean | null;
  /** The Grinch is asking whose side you're on, and you haven't drawn yet */
  canPledge?: boolean;
  /**
   * What the Grinch remembers of your last visit, which picked his ask: a new
   * face, a loyal accomplice, a traitor (joined, then drew well), a rebel
   * (refused, drew well) or a secret fan (refused, then drew badly anyway)
   */
  history?: IntroHistory;
  /** What he says after you answer, before you draw: to a yes, and to a no */
  replies?: { yes: string; no: string };
}

export type IntroHistory =
  | 'first'
  | 'loyal'
  | 'traitor'
  | 'rebel'
  | 'secretFan';

/** The yes (join or stay with him) and no buttons for his ask, by your history */
const PLEDGE_LABELS: Record<IntroHistory, { yes: string; no: string }> = {
  first: { yes: 'Join him', no: 'Never!' },
  loyal: { yes: 'Stay loyal', no: 'Quit him' },
  traitor: { yes: 'Come crawling back', no: 'Never!' },
  rebel: { yes: 'Switch sides', no: 'Still never!' },
  secretFan: { yes: 'Admit it, join him', no: 'Never!' },
};

/** Answers the Grinch's ask: join his plot to ruin the day, or refuse */
export const saveJudgePledge = async (joined: boolean) => {
  const response = await fetchAPI('POST', '/ai/judge/today/pledge', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joined }),
  });
  if (!response.ok) throw new Error('Failed to save your answer');
};

/** Fetches the judge's intro; null when judging is off or there's no prompt */
const fetchJudgeIntro = async (): Promise<JudgeIntro | null> => {
  const response = await fetchAPI('GET', '/ai/judge/today/intro');
  if (response.status === 204) return null;
  if (!response.ok) throw new Error("Failed to load the judge's intro");
  return response.json();
};

// Each day's intro plays once on its own, per device
const SEEN_KEY = 'judge-intro-seen';

const wasIntroSeen = (day: string) => {
  try {
    return localStorage.getItem(SEEN_KEY) === day;
  } catch {
    return false;
  }
};

export const markIntroSeen = (day: string) => {
  try {
    localStorage.setItem(SEEN_KEY, day);
  } catch {
    // Private mode or blocked storage: it may play again, which is fine
  }
};

/**
 * The line as typed so far, with today's prompt picked out in highlighter
 * wherever it's been said, so the ask is impossible to miss.
 */
const withPromptHighlighted = (
  line: string,
  shownLength: number,
  prompt: string,
): ReactNode => {
  const core = withoutArticle(prompt);
  const start = core ? line.toLowerCase().indexOf(core) : -1;
  const shown = line.slice(0, shownLength);
  if (start === -1 || shownLength <= start) return shown;
  const end = Math.min(start + core.length, shownLength);
  return (
    <>
      {shown.slice(0, start)}
      <b className="highlight font-bold">{shown.slice(start, end)}</b>
      {shown.slice(end)}
    </>
  );
};

type DialogueProps = {
  intro: JudgeIntro;
  /** Off to draw it */
  onAccept: () => void;
  onClose: () => void;
  /**
   * Set when the Grinch is asking you to join his plot (and you haven't drawn
   * yet): the last page asks yes or no instead of "let's draw". This gets the
   * answer; then he replies to it before you're sent off to draw.
   */
  onPledge?: (joined: boolean) => void;
};

/**
 * Today's judge giving you your quest, RPG style: its face bobs while each
 * line types out. Tap to skip ahead or turn the page; the last page asks you
 * to go draw.
 */
export const JudgeIntroDialogue: FC<DialogueProps> = ({
  intro,
  onAccept,
  onClose,
  onPledge,
}) => {
  const { judge, prompt } = intro;
  // The Grinch has stolen the day: the lights go out and he makes an entrance
  const stolen = !!judge.scoresBackwards;
  const labels = PLEDGE_LABELS[intro.history ?? 'first'] ?? PLEDGE_LABELS.first;
  // His reply to your answer, once you've given it: one more page
  const [reply, setReply] = useState<string | null>(null);
  const lines = reply === null ? intro.lines : [...intro.lines, reply];
  const asking = stolen && !!onPledge && reply === null;
  const [page, setPage] = useState(0);
  const line = lines[page] ?? '';
  const isLast = page >= lines.length - 1;
  const { shown, done, talking, finish } = useTypewriter(line, judge.name);

  const advance = () => {
    if (!done) return finish();
    if (!isLast) setPage((n) => n + 1);
  };

  const answer = (joined: boolean) => {
    onPledge?.(joined);
    const said = joined ? intro.replies?.yes : intro.replies?.no;
    if (!said) return onAccept();
    setReply(said);
    setPage(intro.lines.length);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        // His question needs a real answer, not a stray key
        if (done && isLast) {
          if (!asking) onAccept();
        } else advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-end justify-center cursor-pointer animate-in fade-in',
        stolen ? 'bg-[#071004]/95 duration-700' : 'bg-ink/70 duration-200',
      )}
      onClick={advance}
    >
      {stolen && <StolenBanner />}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${judge.name} has a request`}
        className="relative w-full max-w-md px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-10 fade-in duration-300"
      >
        {/* The speaker: a face that moves while it talks, and a name plate */}
        <div className="flex items-end gap-3 pl-2">
          <span
            className={cn(
              'inline-flex origin-bottom',
              talking && 'animate-talk',
            )}
          >
            <AIJudgeAvatar judge={judge} size="xl" />
          </span>
          <div className="flex flex-col gap-0.5 mb-2 px-3 py-1.5 min-w-0 bg-white border-2 border-ink rounded-sketch-alt -rotate-1">
            <b className="font-accent font-bold text-2xl leading-none">
              {judge.name}
            </b>
            <span className="text-sm text-pencil truncate">
              {stolen ? 'stole doodlemas' : "today's judge"}
            </span>
          </div>
        </div>

        {/* The speech bubble, with a tail up to the speaker */}
        <div className="relative mt-3 bg-white border-2 border-ink rounded-sketch px-4 pt-4 pb-3">
          <span
            aria-hidden="true"
            className="absolute -top-[9px] left-10 size-4 rotate-45 bg-white border-l-2 border-t-2 border-ink"
          />
          <p className="sr-only" aria-live="polite">
            {done ? line : ''}
          </p>
          {/* The full line sits invisibly underneath, so the bubble doesn't grow as it types */}
          <div aria-hidden="true" className="grid text-xl leading-snug">
            <span className="invisible [grid-area:1/1]">
              {withPromptHighlighted(line, line.length, prompt)}
            </span>
            <span className="[grid-area:1/1]">
              {withPromptHighlighted(line, shown.length, prompt)}
              {!done && (
                <span className="inline-block w-2 ml-0.5 animate-pulse">▍</span>
              )}
            </span>
          </div>

          <div className="flex items-end justify-between gap-3 mt-3 min-h-10">
            {/* Which page of the conversation you're on */}
            <span className="flex gap-1" aria-hidden="true">
              {lines.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'size-2 rounded-full border-[1.5px] border-ink',
                    i <= page ? 'bg-ink' : 'bg-white',
                  )}
                />
              ))}
            </span>
            {done && isLast && asking ? (
              <span className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <Button
                  size="sm"
                  variant="base"
                  disableLoad
                  aria-pressed={intro.pledge === true}
                  onClick={(event) => {
                    event.stopPropagation();
                    answer(true);
                  }}
                >
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    {/* His side */}
                    <SideFace src={judge.avatarUrl} />
                    {labels.yes}
                    {intro.pledge === true && ' ✓'}
                  </span>
                </Button>
                <Button
                  size="sm"
                  disableLoad
                  autoFocus
                  aria-pressed={intro.pledge === false}
                  onClick={(event) => {
                    event.stopPropagation();
                    answer(false);
                  }}
                >
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    {/* Christmas's side */}
                    <SideFace src="/ai/santa.svg" />
                    {labels.no}
                    {intro.pledge === false && ' ✓'}
                  </span>
                </Button>
              </span>
            ) : done && isLast ? (
              <span className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <Button
                  size="sm"
                  variant="base"
                  disableLoad
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                  }}
                >
                  Later
                </Button>
                <Button
                  size="sm"
                  disableLoad
                  autoFocus
                  onClick={(event) => {
                    event.stopPropagation();
                    onAccept();
                  }}
                >
                  Let's draw!
                </Button>
              </span>
            ) : done ? (
              <span
                aria-hidden="true"
                className="text-pencil text-sm leading-none animate-bounce"
              >
                ▼
              </span>
            ) : (
              <span className="text-sm text-pencil">tap to skip</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** A little face on an answer button, showing whose side it puts you on */
const SideFace: FC<{ src: string }> = ({ src }) => (
  <img
    src={src}
    alt=""
    className="size-6 -my-1 flex-none rounded-full border-[1.5px] border-ink bg-white"
  />
);

/** Across the top of the darkened page when the Grinch takes over the day */
const StolenBanner: FC = () => (
  <div
    aria-hidden="true"
    className="absolute inset-x-0 top-[max(2.5rem,env(safe-area-inset-top))] flex flex-col items-center gap-2 px-4 text-center pointer-events-none animate-in fade-in zoom-in-90 duration-700 delay-300 fill-mode-backwards"
  >
    <span className="font-accent font-bold text-sm uppercase tracking-[0.3em] text-[#9bd45a]">
      breaking news
    </span>
    <span className="font-accent font-bold text-4xl leading-none text-white -rotate-2 animate-[wiggle_0.6s_ease-in-out_1s_2]">
      doodlemas has been
      <span className="block mt-1 text-[#e5483b] text-5xl">stolen!</span>
    </span>
  </div>
);

/** The stage wrapper: plays the intro, then sends you to your canvas if you accept */
export const JudgeIntroPlayer: FC<{
  intro: JudgeIntro;
  onDone: () => void;
}> = ({ intro, onDone }) => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();

  useEffect(() => markIntroSeen(intro.day), [intro.day]);

  const accept = () => {
    onDone();
    // The canvas is on the home page while today's doodle is still to draw
    if (pathname !== '/draw') void navigate({ to: '/draw' });
  };

  // The Grinch asks whose side you're on, until you've drawn (then it's locked in).
  // The server says which: this plays on the stage, outside the daily prompt.
  const asking = !!intro.canPledge;

  return (
    <JudgeIntroDialogue
      intro={intro}
      onClose={onDone}
      onAccept={accept}
      onPledge={
        asking
          ? (joined) => {
              saveJudgePledge(joined)
                .catch(() => {
                  // He just won't know; not worth stopping you from drawing
                })
                .finally(
                  () =>
                    void queryClient.invalidateQueries({
                      queryKey: ['ai', 'judge', 'today'],
                    }),
                );
            }
          : undefined
      }
    />
  );
};

/** Queues the intro on the stage, behind anything already celebrating */
export function useShowJudgeIntro() {
  const { enqueue } = useAnimationQueue();
  return useCallback(
    (intro: JudgeIntro) => {
      void enqueue({
        id: `judge-intro:${intro.day}`,
        kind: 'judgeIntro',
        payload: { intro },
      });
    },
    [enqueue],
  );
}

/**
 * A speaker button that plays today's judge intro again. Shows nothing when
 * judging is off or there's no intro to play.
 */
export const JudgeIntroReplayButton: FC<{ className?: string }> = ({
  className,
}) => {
  const { dailyPrompt } = useDailyPrompt();
  const day = dailyPrompt?.day.slice(0, 10);
  const { data } = useQuery({
    queryKey: ['ai', 'judge', 'today', 'intro', day],
    queryFn: fetchJudgeIntro,
    enabled: !!day,
    // Picks up a judge swapped in mid-day
    staleTime: 5 * 60_000,
    retry: false,
  });
  const { enqueue } = useAnimationQueue();
  if (!data) return null;

  return (
    <button
      type="button"
      aria-label={`Hear ${data.judge.name}'s request again`}
      title="Hear the judge's request again"
      onClick={() =>
        // Its own id each time, so it isn't merged with the day's first play
        void enqueue({
          id: `judge-intro:${data.day}:replay:${Date.now()}`,
          kind: 'judgeIntro',
          payload: { intro: data },
        })
      }
      className={cn(
        'inline-flex flex-none items-center justify-center size-11 bg-white border-2 border-ink rounded-full cursor-pointer hover:bg-paper active:translate-y-px',
        className,
      )}
    >
      <SpeakerIcon size={22} />
    </button>
  );
};

const Watcher: FC = () => {
  const { dailyPrompt } = useDailyPrompt();
  const day = dailyPrompt?.day.slice(0, 10);
  const wanted =
    !!dailyPrompt && !dailyPrompt.isCompleted && !wasIntroSeen(day!);
  const { data } = useQuery({
    queryKey: ['ai', 'judge', 'today', 'intro', day],
    queryFn: fetchJudgeIntro,
    enabled: wanted,
    staleTime: Infinity,
    // Nice to have: never worth a retry storm
    retry: false,
  });
  const show = useShowJudgeIntro();
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!data || !wanted || shown.current === data.day) return;
    // Drawn on another device while it was being written
    if (dailyPrompt.isCompleted || wasIntroSeen(data.day)) return;
    shown.current = data.day;
    show(data);
  }, [data, wanted, dailyPrompt, show]);

  return null;
};

/**
 * When there's a new prompt you haven't drawn yet, today's judge pops up once
 * to ask you for it. Mount once, inside the daily prompt and animation queue
 * providers; renders nothing.
 */
const JudgeIntroWatcher: FC = () => {
  const { user } = useAuth();
  if (!user) return null;
  // Keyed so switching accounts (or impersonating) checks again
  return <Watcher key={user.id} />;
};

export default JudgeIntroWatcher;
