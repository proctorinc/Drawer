import ProgressBar from './ProgressBar';
import type { FC } from 'react';
import type { TrophiesResponse } from '@/api/trophies';
import { LevelSeal, RankCard } from '@/levels/RankCard';
import { rankCardFor } from '@/levels/rankCards';
import { RANK_TIERS, levelTitle } from '@/levels/ranks';
import { useAnimationQueue } from '@/animations/AnimationQueue';

// Kept here too, for the pages that already import it from the trophies card
export { levelTitle };

type Props = {
  trophies: TrophiesResponse;
};

const LevelCard: FC<Props> = ({ trophies }) => {
  const { level, xp, levelStartXp, nextLevelXp } = trophies.level;
  const { tier, card } = rankCardFor(level);
  const { enqueue, isPlaying } = useAnimationQueue();

  /** Tap your card to watch your rank arrive again (just the rank, no XP bar) */
  const replay = () => {
    if (isPlaying) return; // Already showing; a second tap would just pile up
    // The first rank is where everyone starts, so it arrives from itself
    const index = RANK_TIERS.indexOf(tier);
    void enqueue({
      id: `replay:rankUp:${Date.now()}`,
      kind: 'rankUp',
      payload: {
        fromTierId: RANK_TIERS[Math.max(0, index - 1)].id,
        toTierId: tier.id,
        level,
      },
    });
  };

  return (
    <section className="flex flex-col gap-4 w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Replay your ${tier.name} rank`}
        onClick={replay}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          replay();
        }}
        className="press group relative cursor-pointer rounded-sketch hover:-rotate-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        <RankCard
          level={level}
          pin
          contentClassName="flex flex-col gap-3 p-4 pt-5"
        >
          <div className="flex items-center gap-4">
            <LevelSeal level={level} size={76} />
            <div className="flex flex-col min-w-0">
              <span className="text-lg text-pencil">you are a…</span>
              <h1 className="font-accent font-bold text-[36px] leading-none">
                <span className="highlight">
                  {levelTitle(level).toLowerCase()}
                </span>
              </h1>
              <span className="mt-1 text-sm text-pencil">
                {tier.name.toLowerCase()} rank
              </span>
            </div>
          </div>
          <ProgressBar
            value={xp - levelStartXp}
            max={nextLevelXp - levelStartXp}
            label={`Level ${level} progress`}
            fillBackground={card.fill}
            className="h-5"
          />
          <div className="flex justify-between gap-2 text-pencil">
            <span>{xp} XP</span>
            <span className="text-right">
              {nextLevelXp - xp} XP to{' '}
              <span className="text-[color:var(--rank-text)]">
                {levelTitle(level + 1).toLowerCase()}
              </span>
            </span>
          </div>
        </RankCard>
        <span className="absolute -bottom-2.5 right-4 px-2 py-0.5 bg-white border-[1.5px] border-ink rounded-full text-xs text-pencil leading-tight rotate-2 group-hover:text-ink">
          tap to replay ✦
        </span>
      </div>
    </section>
  );
};

export default LevelCard;
