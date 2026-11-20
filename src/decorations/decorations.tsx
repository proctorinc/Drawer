import FirstSnow from './FirstSnow';
import ChristmasLights from './ChristmasLights';
import type { FC } from 'react';
import type { DecorationId } from '@/api/Api';
import { SantaHat } from '@/events/christmas/Decorations';

type Decoration = {
  name: string;
  /** The event that unlocks it, or the kind of reward it is when no event does */
  group: string;
  Art: FC;
};

const GoldenSantaHat: FC = () => <SantaHat golden />;

/** Every decoration, easiest to earn first. Each one's id is its reward's id. */
export const DECORATIONS: Record<DecorationId, Decoration> = {
  FIRST_SNOW: {
    name: 'first snow',
    group: 'doodlemas',
    Art: FirstSnow,
  },
  CHRISTMAS_LIGHTS: {
    name: 'christmas lights',
    group: 'doodlemas',
    Art: ChristmasLights,
  },
  GOLDEN_SANTA_HAT: {
    name: 'golden santa hat',
    group: 'doodlemas',
    Art: GoldenSantaHat,
  },
};

/** Decorations by group, in the order DECORATIONS lists them */
export const DECORATION_GROUPS = (
  Object.keys(DECORATIONS) as Array<DecorationId>
).reduce<Array<{ name: string; ids: Array<DecorationId> }>>((groups, id) => {
  const name = DECORATIONS[id].group;
  const group = groups.find((g) => g.name === name);
  if (group) group.ids.push(id);
  else groups.push({ name, ids: [id] });
  return groups;
}, []);

/**
 * Draws a decoration over an avatar; its parent must be the avatar's square,
 * positioned box. Draws nothing for an id this build doesn't know.
 */
export const AvatarDecoration: FC<{ id: string }> = ({ id }) => {
  const decoration = DECORATIONS[id as DecorationId] as Decoration | undefined;
  return decoration ? <decoration.Art /> : null;
};
