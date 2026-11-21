import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  faArrowUpRightFromSquare,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useAdminUsers } from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Table,
  Tag,
  formatDateTime,
  td,
  th,
} from '../components/ui';
import type { FC } from 'react';
import type { AdminBeta } from '@/beta/duel/api';
import { useAdminBeta, useSetBetaTester } from '@/beta/duel/api';
import { ScoreBadge } from '@/beta/duel/components/GuessFeedback';
import Button from '@/components/Button';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

/** Who's in: admins always, plus the testers you add */
const Testers: FC<{ beta: AdminBeta }> = ({ beta }) => {
  const users = useAdminUsers();
  const set = useSetBetaTester();
  const [adding, setAdding] = useState('');
  const inBeta = new Set(beta.players.map((p) => p.user.id));

  return (
    <Section
      title="testers"
      aside="admins are always in; testers get the beta lab link on their profile"
    >
      <div className="flex flex-col gap-2">
        {beta.players.map((p) => (
          <div key={p.user.id} className="flex items-center gap-3">
            <UserProfileIcon user={p.user} size="sm" showLevel={false} />
            <span className="flex-1">{p.user.username}</span>
            {p.isAdmin ? (
              <Tag>admin</Tag>
            ) : (
              <>
                <span className="text-sm text-pencil">
                  added {p.addedAt ? formatDateTime(p.addedAt) : ''}
                </span>
                <Button
                  size="sm"
                  variant="base"
                  icon={faXmark}
                  aria-label={`remove ${p.user.username}`}
                  disabled={set.isPending}
                  onClick={() => set.mutate({ userId: p.user.id, add: false })}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          className="px-3 py-2 bg-white border-2 border-ink rounded-sketch-alt"
        >
          <option value="">add a tester…</option>
          {(users.data ?? [])
            .filter((u) => !inBeta.has(u.id))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
        </select>
        <Button
          size="sm"
          disabled={!adding || set.isPending}
          onClick={() =>
            set.mutate(
              { userId: adding, add: true },
              { onSuccess: () => setAdding('') },
            )
          }
        >
          let them in
        </Button>
      </div>
    </Section>
  );
};

const phaseLabel = (d: AdminBeta['duels'][number]) => {
  if (d.status !== 'active') return d.status;
  const turn = d.turnUserId === d.challenger.id ? d.challenger : d.opponent;
  return `round ${d.round}: ${turn.username} to ${d.phase}`;
};

/**
 * The beta zone: new features tried out with a few people before everyone
 * gets them. Admins are always in; add testers to open it to them.
 */
const BetaZonePage = () => {
  const beta = useAdminBeta();

  return (
    <AdminPage
      title="beta zone"
      subtitle="multi-player features to demo with a few people first"
    >
      <Loaded query={beta}>
        {(data) => (
          <>
            <Panel className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-accent font-bold text-3xl leading-none">
                    sketch duel
                  </h2>
                  <p className="text-pencil">
                    co-op pictionary: each player draws a secret prompt in 60
                    seconds, the other gets 3 guesses scored by the AI, and the
                    two rounds average into a team score.
                  </p>
                </div>
                <Link to="/draw/beta">
                  <Button size="sm" icon={faArrowUpRightFromSquare} disableLoad>
                    open the duel lab
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <Tag>{data.promptCount} prompts</Tag>
                <Tag>{data.duels.length} duels</Tag>
                <Tag>
                  {data.players.filter((p) => !p.isAdmin).length
                    ? `open to ${data.players.filter((p) => !p.isAdmin).length} tester(s)`
                    : 'admins only'}
                </Tag>
                {data.aiReady ? (
                  <Tag>AI scoring on</Tag>
                ) : (
                  <Tag className="!bg-blush">
                    AI off: guesses are scored by plain word matching
                  </Tag>
                )}
              </div>
            </Panel>

            <Testers beta={data} />

            <Section
              title="duels"
              aside="newest first; open one to see every prompt"
            >
              {data.duels.length === 0 ? (
                <p className="text-pencil">no duels yet</p>
              ) : (
                <Table
                  head={
                    <>
                      <th className={th}>players</th>
                      <th className={th}>where it&apos;s at</th>
                      <th className={th}>round 1</th>
                      <th className={th}>round 2</th>
                      <th className={th}>team</th>
                      <th className={th}>updated</th>
                    </>
                  }
                >
                  {data.duels.map((d) => (
                    <tr key={d.id} className="border-t border-line">
                      <td className={td}>
                        <Link
                          to="/draw/beta/duel/$duelId"
                          params={{ duelId: d.id }}
                          className="underline"
                        >
                          {d.challenger.username} &amp; {d.opponent.username}
                        </Link>
                      </td>
                      <td className={td}>{phaseLabel(d)}</td>
                      {d.rounds.map((r) => (
                        <td key={r.number} className={td}>
                          <span className="block">{r.prompt}</span>
                          <span className="text-sm text-pencil">
                            {r.score !== null
                              ? `${r.score}% after ${r.guesses.length} guess(es)`
                              : r.drawn
                                ? `${r.guesses.length} guess(es) so far`
                                : 'not drawn'}
                          </span>
                        </td>
                      ))}
                      <td className={td}>
                        {d.combined !== null ? (
                          <ScoreBadge score={d.combined} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={td}>{formatDateTime(d.updatedAt)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>
          </>
        )}
      </Loaded>
    </AdminPage>
  );
};

export default BetaZonePage;
