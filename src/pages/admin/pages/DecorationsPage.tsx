import { useAdminRewards } from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  Table,
  Tag,
  td,
  th,
} from '../components/ui';
import type { FC } from 'react';
import type { DecorationId, User } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { DECORATIONS, DECORATION_GROUPS } from '@/decorations/decorations';
import { SantaHat } from '@/events/christmas/Decorations';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

const SIZES = ['sm', 'lg', 'xl', '2xl'] as const;

const demoUser = (username: string, decoration: DecorationId | ''): User => ({
  id: `demo-${username}`,
  username,
  createdAt: new Date(),
  avatarType: 'basic',
  avatarUrl: '',
  decoration,
});

/** A decoration on avatars of every size, plus your own avatar */
const AvatarRow: FC<{ decoration: DecorationId | '' }> = ({ decoration }) => {
  const me = useUser();
  const noop = () => {};
  return (
    <div className="flex items-end gap-8">
      {SIZES.map((size, i) => (
        <UserProfileIcon
          key={size}
          size={size}
          onClick={noop}
          showLevel={false}
          user={demoUser(['ann', 'bo', 'cass', 'dee'][i], decoration)}
        />
      ))}
      <UserProfileIcon
        size="2xl"
        onClick={noop}
        showLevel={false}
        user={{ ...me, decoration }}
      />
    </div>
  );
};

const DecorationsPage = () => {
  const rewards = useAdminRewards();

  return (
    <AdminPage
      title="decorations"
      subtitle="every wearable, on every avatar size (the last one is you)"
    >
      <Loaded query={rewards}>
        {(list) => {
          const byId = new Map(list.map((r) => [r.id, r]));
          const known = new Set<string>(Object.keys(DECORATIONS));
          const otherRewards = list.filter((r) => !known.has(r.id));

          return (
            <>
              {DECORATION_GROUPS.map((group) => (
                <Section key={group.name} title={group.name}>
                  {group.ids.map((id) => {
                    const reward = byId.get(id);
                    return (
                      <Panel key={id} className="flex flex-col gap-4 p-5">
                        <div className="flex items-baseline gap-3">
                          <h3 className="font-accent font-bold text-2xl leading-none">
                            {DECORATIONS[id].name}
                          </h3>
                          <span className="font-mono text-xs text-pencil">
                            {id}
                          </span>
                          {reward ? (
                            <span className="ml-auto flex gap-2">
                              <Tag>unlocked by {reward.unlockedBy}</Tag>
                              <Tag className="bg-butter">
                                worn by {reward.wornBy}
                              </Tag>
                            </span>
                          ) : (
                            <Tag className="ml-auto bg-blush">
                              no reward row on the server
                            </Tag>
                          )}
                        </div>
                        {reward && (
                          <p className="text-pencil">{reward.description}</p>
                        )}
                        <AvatarRow decoration={id} />
                      </Panel>
                    );
                  })}
                </Section>
              ))}

              <Section title="for comparison">
                <Panel className="flex flex-col gap-6 p-5">
                  <div className="flex flex-col gap-2">
                    <span className="text-pencil">no decoration</span>
                    <AvatarRow decoration="" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-pencil">
                      christmas default: everyone without a decoration gets the
                      red hat while the event is live
                    </span>
                    <div className="relative size-32">
                      <div className="size-32 rounded-full border-[3px] border-ink bg-sky" />
                      <SantaHat />
                    </div>
                  </div>
                </Panel>
              </Section>

              <Section title="other rewards" aside="unlocks that aren't worn">
                <Table
                  head={
                    <>
                      <th className={th}>reward</th>
                      <th className={th}>description</th>
                      <th className={th}>unlocked by achievement</th>
                      <th className={th}>players with it</th>
                    </>
                  }
                >
                  {otherRewards.map((r) => (
                    <tr key={r.id}>
                      <td className={td}>
                        <b>{r.name}</b>
                        <div className="font-mono text-xs text-pencil">
                          {r.id}
                        </div>
                      </td>
                      <td className={td}>{r.description}</td>
                      <td className={td}>{r.achievementId ?? '–'}</td>
                      <td className={td}>{r.unlockedBy}</td>
                    </tr>
                  ))}
                </Table>
              </Section>
            </>
          );
        }}
      </Loaded>
    </AdminPage>
  );
};

export default DecorationsPage;
