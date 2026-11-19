import { Link } from '@tanstack/react-router';
import { addDays, format } from 'date-fns';
import {
  useAdminAchievements,
  useAdminPrompts,
  useAdminRewards,
  useAdminUsers,
  useEventStats,
} from '../api';
import {
  Loaded,
  Panel,
  StatTile,
  Table,
  Tag,
  decorationName,
  formatDay,
  td,
  th,
} from './ui';
import type { AdminEvent, EventStats } from '../api';
import type { FC, ReactNode } from 'react';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import Badge from '@/pages/trophies/components/Badge';
import { getReaction } from '@/reactions/catalog';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import { cn } from '@/utils';

const Block: FC<{ title: string; aside?: ReactNode; children: ReactNode }> = ({
  title,
  aside,
  children,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between">
      <h3 className="font-accent font-bold text-xl leading-none">{title}</h3>
      {aside && <span className="text-sm text-pencil">{aside}</span>}
    </div>
    {children}
  </div>
);

/** Each event day's prompt and how many people drew it, as bars */
const DayByDay: FC<{ event: AdminEvent }> = ({ event }) => {
  const prompts = useAdminPrompts();
  return (
    <Loaded query={prompts}>
      {(list) => {
        const byDay = new Map(list.map((p) => [p.day, p]));
        const days: Array<string> = [];
        for (
          let d = new Date(`${event.firstDay}T00:00:00`);
          format(d, 'yyyy-MM-dd') <= event.lastDay;
          d = addDays(d, 1)
        ) {
          days.push(format(d, 'yyyy-MM-dd'));
        }
        const most = Math.max(
          1,
          ...days.map((d) => byDay.get(d)?.submissions ?? 0),
        );

        return (
          <div className="flex items-end gap-1 h-40">
            {days.map((day, i) => {
              const prompt = byDay.get(day);
              const drawn = prompt?.submissions ?? 0;
              return (
                <Link
                  key={day}
                  to="/draw/admin/prompts"
                  search={{ event: event.slug }}
                  title={`day ${i + 1} · ${formatDay(day)} · ${prompt?.prompt ?? 'no prompt'} · ${drawn} drawn`}
                  className="flex flex-col items-center justify-end flex-1 h-full gap-1 group"
                >
                  <span className="text-xs text-pencil">{drawn || ''}</span>
                  <span
                    className={cn(
                      'w-full rounded-t-sm border-[1.5px] border-ink group-hover:bg-coral',
                      prompt ? 'bg-xmas-green' : 'bg-blush border-dashed',
                    )}
                    style={{ height: `${Math.max(4, (drawn / most) * 100)}%` }}
                  />
                  <span className="text-[10px] text-pencil">{i + 1}</span>
                </Link>
              );
            })}
          </div>
        );
      }}
    </Loaded>
  );
};

/** How an event went for every player: who took part, what they earned and wore */
const EventReport: FC<{ event: AdminEvent }> = ({ event }) => {
  const stats = useEventStats(event.id);
  const achievements = useAdminAchievements().data ?? [];
  const rewards = useAdminRewards().data ?? [];
  const users = useAdminUsers().data ?? [];

  const stickers = achievements.filter((a) => a.eventSlug === event.slug);
  const stickerIds = new Set(stickers.map((a) => a.id));
  const decorations = rewards.filter(
    (r) => r.achievementId && stickerIds.has(r.achievementId),
  );

  return (
    <Loaded query={stats}>
      {(s: EventStats) => {
        const players = s.standings.length;
        const finished = s.countdownDays
          ? s.standings.filter((p) => p.countdownDoodles >= s.countdownDays)
              .length
          : null;
        const reactionTotal = s.reactions.reduce(
          (sum, r) => sum + r.submissions + r.comments,
          0,
        );

        return (
          <Panel className="flex flex-col gap-6 p-5">
            <div className="grid grid-cols-6 gap-3">
              <StatTile
                label="players drew"
                value={`${players}/${users.length}`}
              />
              <StatTile
                label="doodles"
                value={s.standings.reduce((sum, p) => sum + p.doodles, 0)}
              />
              <StatTile label="comments" value={s.comments} />
              <StatTile label="reactions" value={reactionTotal} />
              <StatTile
                label="drew every countdown day"
                value={finished ?? '–'}
                className="bg-butter"
              />
              <StatTile
                label="wearing its decorations"
                value={decorations.reduce((sum, d) => sum + d.wornBy, 0)}
                className="bg-blush"
              />
            </div>

            <Block
              title="day by day"
              aside={
                <Link
                  to="/draw/admin/prompts"
                  search={{ event: event.slug }}
                  className="underline"
                >
                  view & edit this event's prompts →
                </Link>
              }
            >
              <DayByDay event={event} />
            </Block>

            <div className="grid grid-cols-3 gap-6">
              <Block title="stickers" aside="earned by everyone">
                <ul className="flex flex-col gap-2">
                  {stickers.map((a) => (
                    <li key={a.id} className="flex items-center gap-3">
                      <Badge achievement={a} className="size-10 shrink-0" />
                      <span className="flex-1 leading-tight">
                        <b>{a.name}</b>
                        <span className="block text-sm text-pencil">
                          {a.description}
                        </span>
                      </span>
                      <Tag>{a.earnedBy} earned</Tag>
                    </li>
                  ))}
                </ul>
              </Block>

              <Block title="decorations" aside="who's wearing them now">
                <ul className="flex flex-col gap-3">
                  {decorations.map((d) => {
                    const wearers = users.filter((u) => u.decoration === d.id);
                    return (
                      <li key={d.id} className="flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <b className="flex-1">{decorationName(d.id)}</b>
                          <Tag>{d.unlockedBy} unlocked</Tag>
                          <Tag className="bg-butter">{d.wornBy} wearing</Tag>
                        </span>
                        <span className="flex flex-wrap gap-2 pt-1">
                          {wearers.map((u) => (
                            <UserProfileIcon key={u.id} user={u} size="sm" />
                          ))}
                          {wearers.length === 0 && (
                            <span className="text-sm text-pencil">
                              nobody yet
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Block>

              <Block title="reactions while it ran" aside="★ = event only">
                <ul className="grid grid-cols-2 gap-2">
                  {s.reactions.map((r) => (
                    <li key={r.reactionId} className="flex items-center gap-2">
                      <ReactionSticker reactionId={r.reactionId} size={24} />
                      <span className="flex-1 truncate">
                        {getReaction(r.reactionId).label}
                        {event.reactions.includes(r.reactionId) && ' ★'}
                      </span>
                      <b>{r.submissions + r.comments}</b>
                    </li>
                  ))}
                  {s.reactions.length === 0 && (
                    <li className="text-sm text-pencil">none yet</li>
                  )}
                </ul>
              </Block>
            </div>

            <Block title="every player" aside={`${players} took part`}>
              <Table
                head={
                  <>
                    <th className={th}>#</th>
                    <th className={th}>player</th>
                    <th className={th}>doodles</th>
                    {s.countdownDays > 0 && (
                      <th className={th}>countdown days</th>
                    )}
                    <th className={th}>reactions received</th>
                  </>
                }
              >
                {s.standings.map((p, i) => (
                  <tr key={p.user.id}>
                    <td className={td}>{i + 1}</td>
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <UserProfileIcon user={p.user} size="sm" />
                        {p.user.username}
                      </span>
                    </td>
                    <td className={td}>{p.doodles}</td>
                    {s.countdownDays > 0 && (
                      <td className={td}>
                        {p.countdownDoodles}/{s.countdownDays}
                      </td>
                    )}
                    <td className={td}>{p.reactionsReceived}</td>
                  </tr>
                ))}
              </Table>
            </Block>
          </Panel>
        );
      }}
    </Loaded>
  );
};

export default EventReport;
