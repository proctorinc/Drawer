import { useState } from 'react';
import { AdminPage, Panel, Section, Tag } from '../components/ui';
import type { FC } from 'react';
import type { AvatarSize } from '@/pages/profile/components/profile-icons/DefaultAvatar';
import type { AvatarParts } from '@/pages/profile/components/profile-icons/sketchFace';
import { PROFILE_HUES, cn } from '@/utils';
import { DefaultAvatar } from '@/pages/profile/components/profile-icons/DefaultAvatar';
import {
  FACE_COUNT,
  HAIR,
  defaultAvatarFor,
  guessLook,
} from '@/pages/profile/components/profile-icons/sketchFace';
import { userProfileIconVariants } from '@/pages/profile/components/profile-icons/UserProfileIcon';

const SIZES: Array<AvatarSize> = ['xs', 'sm', 'lg', 'xl', '2xl'];

const USERNAMES = [
  'mom',
  'dad',
  'SuperMom_2kids',
  'granddad',
  'nana_rose',
  'papaBear',
  'jenny.doodles',
  'mike_draws',
  'queenofsketch',
  'coolguy42',
  'sarah',
  'tom',
  'pixelwizard',
  'doodlebug',
  'inkspot',
  'sketchy_steve',
  'lazy_llama',
  'blue_bird',
  'katie_k',
  'the_real_dave',
  'artsyfartsy',
  'xX_draw_Xx',
  'sunflower',
  'night_owl',
  'wobblyline',
  'crayon_cat',
  'gma_june',
  'uncle_bob',
  'emma.p',
  'ben10',
  'zigzag',
  'scribbles',
  'Matt',
  'Liz',
  'potato',
  'cloud9',
  'mrs_mcgee',
  'bigbro',
  'rocket',
  'olive',
];

const demoUser = (username: string) => ({ id: `demo-${username}`, username });

const Bubble: FC<{
  username: string;
  size?: AvatarSize;
  parts?: AvatarParts;
  /** A picked profile color; else the one the name gives */
  hue?: number;
}> = ({ username, size = 'lg', parts, hue }) => (
  <div className={cn(userProfileIconVariants({ size }), 'overflow-hidden')}>
    <DefaultAvatar
      user={{ ...demoUser(username), colorHue: hue }}
      size={size}
      parts={parts}
    />
  </div>
);

const LookTag: FC<{ username: string }> = ({ username }) => {
  const guess = guessLook(username);
  return (
    <Tag className={guess ? 'bg-butter' : 'bg-white'}>
      {guess ?? 'coin flip'}
    </Tag>
  );
};

const NameCheck = () => {
  const [name, setName] = useState('supermom');
  const parts = defaultAvatarFor(demoUser(name || ' '));
  return (
    <Panel className="flex flex-wrap items-center gap-6 p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="type a username"
        className="px-3 py-2 border-2 border-ink rounded-sketch bg-paper text-lg"
      />
      <Bubble username={name || ' '} size="xl" />
      <div className="flex flex-col gap-1">
        <LookTag username={name} />
        <span className="text-pencil text-sm">
          {parts.hair} · {parts.neckline} · {parts.glasses} glasses ·{' '}
          {parts.extra}
        </span>
      </div>
    </Panel>
  );
};

const DefaultAvatarsPage = () => {
  const sample = defaultAvatarFor(demoUser('sample'));
  return (
    <AdminPage
      title="default avatars"
      subtitle={`${FACE_COUNT} sketch faces in each user's profile color, picked from their id`}
    >
      <Section title="try a name" aside="mom, dad, names → a matching look">
        <NameCheck />
      </Section>

      <Section title="a room full of users">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-4">
          {USERNAMES.map((username) => (
            <div key={username} className="flex flex-col items-center gap-1.5">
              <Bubble username={username} size="xl" />
              <span className="text-sm font-bold truncate max-w-full">
                {username}
              </span>
              <LookTag username={username} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="every size" aside="xs · sm · lg · xl · 2xl">
        <div className="flex flex-col gap-4">
          {['mom', 'mike_draws', 'pixelwizard', 'nana_rose'].map((username) => (
            <div key={username} className="flex flex-wrap items-end gap-6">
              {SIZES.map((size) => (
                <Bubble key={size} username={username} size={size} />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="one face, every profile color">
        <div className="flex flex-wrap gap-4">
          {PROFILE_HUES.map((hue) => (
            <Bubble
              key={hue}
              username="sample"
              size="xl"
              parts={sample}
              hue={hue}
            />
          ))}
        </div>
      </Section>

      {(['fem', 'masc'] as const).map((look) => (
        <Section key={look} title={`every ${look} hairdo`}>
          <div className="flex flex-wrap gap-4">
            {HAIR[look].map((hair, i) => (
              <div key={hair} className="flex flex-col items-center gap-1">
                <Bubble
                  username={USERNAMES[i * 3]}
                  size="2xl"
                  parts={{
                    ...sample,
                    look,
                    hair,
                    glasses: 'none',
                    extra: 'none',
                    tilt: 0,
                  }}
                />
                <span className="text-sm text-pencil">{hair}</span>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </AdminPage>
  );
};

export default DefaultAvatarsPage;
