import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import SubmissionSheet from './SubmissionSheet';
import type { FC } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import { useGetMyProfile } from '@/api/Api';
import Layout from '@/components/Layout';
import { isSameDay } from '@/days';

const arrowClass =
  'press flex items-center justify-center size-7 bg-white border-2 border-ink rounded-blob text-sm text-ink cursor-pointer disabled:invisible';

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

type Props = {
  /** The doodle on show; swiping slides the next one's whole page in */
  submission: UserPromptSubmission;
};

/** A doodle's page, side by side with everyone in your circle who drew that day */
const DayCarousel: FC<Props> = ({ submission }) => {
  const navigate = useNavigate();
  const router = useRouter();
  const { data: profile } = useGetMyProfile();
  // Keeps a stranger's doodle in the row after you've swiped past it
  const [opened] = useState(submission);
  const doodles = dayDoodles(profile?.feed ?? [], opened);
  const index = doodles.findIndex((doodle) => doodle.id === submission.id);
  const stripRef = useRef<HTMLUListElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
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
      header={
        doodles.length > 1 && (
          <div className="flex items-center justify-center gap-3 text-pencil">
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
        )
      }
    >
      {/* Bleeds past the page's padding so each page slides in edge to edge */}
      <ul
        ref={stripRef}
        onScroll={handleScroll}
        aria-label="Doodles from this day"
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
    </Layout>
  );
};

export default DayCarousel;
