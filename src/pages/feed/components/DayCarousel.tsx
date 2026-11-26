import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import SubmissionSheet from './SubmissionSheet';
import type { CSSProperties, FC } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import { useFeedDay, useGetMyProfile, useGetUserProfile } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Layout from '@/components/Layout';
import Masthead from '@/components/Masthead';
import { cn } from '@/utils';
import { isSameDay, parseDay } from '@/days';

const arrowClass =
  'press flex items-center justify-center size-7 bg-white border-2 border-ink rounded-blob text-sm text-ink cursor-pointer disabled:invisible';

/** True once the page has scrolled down at all */
function useScrolled() {
  const [scrolled, setScrolled] = useState(() => window.scrollY > 0);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return scrolled;
}

/** Floats at the screen's edge and bounces toward the doodles you can swipe to */
const SwipeHint: FC<{
  dir: -1 | 1;
  onClick: () => void;
}> = ({ dir, onClick }) => (
  <button
    aria-label={dir < 0 ? 'Previous doodle' : 'Next doodle'}
    tabIndex={-1}
    onClick={onClick}
    className={cn(
      // Pinned halfway down the screen, at the page column's edge, so they
      // stay put while you scroll the comments
      'fixed z-20 top-1/2 -translate-y-1/2 cursor-pointer animate-in fade-in zoom-in-75 duration-300',
      dir < 0
        ? 'left-[calc(50vw-min(50vw,14rem)+0.25rem)]'
        : 'right-[calc(50vw-min(50vw,14rem)+0.25rem)]',
    )}
  >
    <span
      className="flex items-center justify-center size-9 bg-white border-2 border-ink rounded-blob text-ink animate-hint"
      style={{ '--hint-dir': dir } as CSSProperties}
    >
      <FontAwesomeIcon icon={dir < 0 ? faChevronLeft : faChevronRight} />
    </span>
  </button>
);

/**
 * That day's doodles from you and your friends (never the artist's friends),
 * plus the opened one up front if it's from outside your circle
 */
export function dayDoodles(
  feed: Array<UserPromptSubmission>,
  opened: UserPromptSubmission,
): Array<UserPromptSubmission> {
  const day = feed.filter((doodle) => isSameDay(doodle.day, opened.day));
  return day.some((doodle) => doodle.id === opened.id) ? day : [opened, ...day];
}

/** Every doodle in an artist's book, oldest first, like their calendar */
export function bookDoodles(
  prompts: Array<UserPromptSubmission>,
  opened: UserPromptSubmission,
): Array<UserPromptSubmission> {
  const book = prompts.some((doodle) => doodle.id === opened.id)
    ? prompts
    : [opened, ...prompts];
  return [...book].sort(
    (a, b) => parseDay(a.day).getTime() - parseDay(b.day).getTime(),
  );
}

/** That artist's doodles; your own come from the profile you already have */
function useBook(userId: string | undefined) {
  const currentUser = useUser();
  const isMe = userId === currentUser.id;
  const { data: myProfile } = useGetMyProfile();
  const { data: theirProfile } = useGetUserProfile(isMe ? '' : (userId ?? ''));
  return (isMe ? myProfile : theirProfile)?.prompts;
}

type Props = {
  /** The doodle on show; swiping slides the next one's whole page in */
  submission: UserPromptSubmission;
  /** Opened from this artist's calendar: swipe through their days instead */
  book?: string;
};

/**
 * A doodle's page, side by side with everyone in your circle who drew that
 * day, or with the artist's other days when opened from their calendar
 */
const DayCarousel: FC<Props> = ({ submission, book }) => {
  const navigate = useNavigate();
  const router = useRouter();
  const bookPrompts = useBook(book);
  // Keeps a stranger's doodle in the row after you've swiped past it
  const [opened] = useState(submission);
  // Days sometimes carry a UTC time, which /feed/:day won't take
  const { data: day } = useFeedDay(opened.day.slice(0, 10));
  const doodles = book
    ? bookDoodles(bookPrompts ?? [], opened)
    : dayDoodles(day ?? [], opened);
  const index = doodles.findIndex((doodle) => doodle.id === submission.id);
  const stripRef = useRef<HTMLUListElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Hints hide mid-swipe and come back, bouncing again, once it settles
  const [swiping, setSwiping] = useState(false);
  const scrolled = useScrolled();

  const shownIndex = (strip: HTMLElement) =>
    Math.round(strip.scrollLeft / strip.clientWidth);

  // Show the current doodle: on arrival, and again once the rest of the day loads in
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (strip && shownIndex(strip) !== index) {
      strip.scrollLeft = index * strip.clientWidth;
    }
  }, [index, doodles.length]);

  // Drawings only load once on screen, so warm the neighbours before they slide in
  useEffect(() => {
    for (const neighbour of doodles.slice(Math.max(index - 1, 0), index + 2)) {
      const image = new Image();
      // Matches DrawingImage's request, so the browser reuses it
      image.crossOrigin = 'anonymous';
      image.src = neighbour.imageUrl;
    }
  }, [index, doodles.length]);

  // A swipe still settling must never pull you back once you've left
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // Once a swipe comes to rest, the URL follows (replacing, so back still leaves)
  function handleScroll() {
    setSwiping(true);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setSwiping(false);
      // Tapped away (say, the navbar) mid-swipe: following now would replace
      // wherever you went with this doodle again
      const here = `/draw/submission/${submission.id}`;
      if (router.latestLocation.pathname !== here) return;
      const strip = stripRef.current;
      const landed = strip && doodles[shownIndex(strip)];
      if (landed && landed.id !== submission.id) {
        navigate({
          to: '/draw/submission/$submissionId',
          params: { submissionId: landed.id },
          search: { book },
          replace: true,
          resetScroll: false,
        });
      }
    }, 120);
  }

  function flip(by: number) {
    const strip = stripRef.current;
    strip?.scrollBy({ left: by * strip.clientWidth, behavior: 'smooth' });
  }

  return (
    <Layout
      back
      masthead={
        // Stays pinned to the top, so back and the doodle switcher are
        // always in reach however far down the comments you are
        <div
          className={cn(
            // bg-fixed lines its dots up with the page's, wherever the column sits
            'paper bg-fixed sticky top-0 z-30 flex flex-col pb-3 border-b-2 border-dashed transition-colors duration-200',
            scrolled ? 'border-line' : 'border-transparent',
          )}
        >
          <Masthead back />
          {doodles.length > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3 text-pencil">
              <button
                aria-label="Previous doodle"
                disabled={index <= 0}
                onClick={() => flip(-1)}
                className={arrowClass}
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <span>
                {index + 1} of {doodles.length}
              </span>
              <button
                aria-label="Next doodle"
                disabled={index >= doodles.length - 1}
                onClick={() => flip(1)}
                className={arrowClass}
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="relative w-full">
        {!swiping && index > 0 && (
          <SwipeHint key={`prev-${index}`} dir={-1} onClick={() => flip(-1)} />
        )}
        {!swiping && index >= 0 && index < doodles.length - 1 && (
          <SwipeHint key={`next-${index}`} dir={1} onClick={() => flip(1)} />
        )}
        {/* Bleeds past the page's padding so each page slides in edge to edge */}
        <ul
          ref={stripRef}
          onScroll={handleScroll}
          aria-label={book ? 'Doodles from this book' : 'Doodles from this day'}
          className="flex items-start w-[calc(100%+3rem)] -mx-6 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none]"
        >
          {doodles.map((doodle) => (
            // Top padding leaves room for the polaroid's push pin
            <li
              key={doodle.id}
              className="w-full shrink-0 snap-center snap-always px-6 pt-3"
            >
              <SubmissionSheet doodle={doodle} />
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
};

export default DayCarousel;
