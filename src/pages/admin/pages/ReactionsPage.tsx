import { useReactionUsage } from '../api';
import { AdminPage, Loaded, Panel, Section } from '../components/ui';
import type { FC } from 'react';
import type { ReactionInfo } from '@/reactions/catalog';
import type { ReactionUsage } from '../api';
import {
  eventReactions,
  moreReactions,
  standardReactions,
} from '@/reactions/catalog';
import { ReactionSticker } from '@/reactions/ReactionSticker';

const GROUPS = [
  { title: 'up front in the picker', list: standardReactions },
  { title: 'behind "more"', list: moreReactions },
  { title: 'event only', list: eventReactions },
];

const ReactionTile: FC<{ reaction: ReactionInfo; usage?: ReactionUsage }> = ({
  reaction,
  usage,
}) => (
  <Panel className="flex flex-col items-center gap-2 p-3 text-center">
    <ReactionSticker reactionId={reaction.id} size={56} />
    <span className="font-accent font-bold text-xl leading-none">
      {reaction.label}
    </span>
    <span className="text-sm text-pencil">
      “alice {reaction.verb} your goalie”
    </span>
    {/* The pill as it looks once someone has picked it */}
    <span
      className="flex items-center gap-1 px-2 py-0.5 border-2 border-ink rounded-full"
      style={{ backgroundColor: reaction.tint }}
    >
      <ReactionSticker reactionId={reaction.id} size={18} />
      <span className="font-bold">
        {(usage?.submissions ?? 0) + (usage?.comments ?? 0)}
      </span>
    </span>
    <span className="text-xs text-pencil">
      {usage?.submissions ?? 0} on drawings · {usage?.comments ?? 0} on comments
    </span>
    <span className="font-mono text-xs text-pencil">{reaction.id}</span>
  </Panel>
);

const ReactionsPage = () => {
  const usage = useReactionUsage();

  return (
    <AdminPage
      title="reactions"
      subtitle="the whole catalog, with its art, tint and how often it's used"
    >
      <Loaded query={usage}>
        {(list) => {
          const byId = new Map(list.map((u) => [u.reactionId, u]));
          return GROUPS.map(({ title, list: reactions }) => (
            <Section key={title} title={title} aside={reactions.length}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                {reactions.map((r) => (
                  <ReactionTile
                    key={r.id}
                    reaction={r}
                    usage={byId.get(r.id)}
                  />
                ))}
              </div>
            </Section>
          ));
        }}
      </Loaded>
    </AdminPage>
  );
};

export default ReactionsPage;
