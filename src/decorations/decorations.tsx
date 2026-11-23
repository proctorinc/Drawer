import FirstSnow from './FirstSnow';
import ChristmasLights from './ChristmasLights';
import {
  AppleHat,
  Beret,
  CrayonCrown,
  Crown,
  Halo,
  JesterHat,
  LaurelWreath,
  PlungerHat,
  PropellerCap,
} from './Hats';
import {
  Balloons,
  BandAids,
  Blaze,
  FoamFinger,
  GildedFrame,
  GoldStars,
  HeartSwarm,
  Lightbulb,
  MythicWings,
  Orbit,
  Palette,
  PencilEar,
  PlatinumPencil,
  Quill,
  RainCloud,
  SpeechBubble,
  Sweatband,
} from './Extras';
import { GrinchHeart } from './GrinchHeart';
import { GrinchHat } from './GrinchHat';
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
  GRINCH_HAT: {
    name: "the grinch's hat",
    group: 'doodlemas',
    Art: GrinchHat,
  },

  // Achievement flair: silly and common for the easy ones, showier the harder
  // they are to earn. Hidden achievements' flair stays out of the picker until earned.
  PENCIL_EAR: {
    name: 'pencil behind the ear',
    group: 'drawing',
    Art: PencilEar,
  },
  BERET: { name: "artist's beret", group: 'drawing', Art: Beret },
  PALETTE: { name: "painter's palette", group: 'drawing', Art: Palette },
  CRAYON_CROWN: { name: 'crayon crown', group: 'drawing', Art: CrayonCrown },
  ORBIT: { name: 'sun & moon orbit', group: 'drawing', Art: Orbit },

  SWEATBAND: { name: 'sweatband', group: 'streaks', Art: Sweatband },
  LAUREL_WREATH: { name: 'laurel wreath', group: 'streaks', Art: LaurelWreath },
  BLAZE: { name: 'ring of fire', group: 'streaks', Art: Blaze },

  PROPELLER_CAP: { name: 'propeller cap', group: 'friends', Art: PropellerCap },
  SPEECH_BUBBLE: { name: 'speech bubble', group: 'friends', Art: SpeechBubble },
  FOAM_FINGER: { name: 'foam finger', group: 'friends', Art: FoamFinger },
  BALLOONS: { name: 'balloons', group: 'friends', Art: Balloons },
  QUILL: { name: "critic's quill", group: 'friends', Art: Quill },
  LIGHTBULB: { name: 'bright idea', group: 'friends', Art: Lightbulb },
  JESTER_HAT: { name: 'jester hat', group: 'friends', Art: JesterHat },
  HEART_SWARM: { name: 'fan hearts', group: 'friends', Art: HeartSwarm },

  PLUNGER_HAT: { name: 'plunger hat', group: 'judges', Art: PlungerHat },
  BAND_AIDS: { name: 'band-aids', group: 'judges', Art: BandAids },
  APPLE_HAT: { name: 'apple for the teacher', group: 'judges', Art: AppleHat },
  GILDED_FRAME: { name: 'gilded frame', group: 'judges', Art: GildedFrame },
  GOLD_STARS: { name: 'gold stars', group: 'judges', Art: GoldStars },
  HALO: { name: 'halo', group: 'judges', Art: Halo },
  GRINCH_HEART: {
    name: "the grinch's heart",
    group: 'judges',
    Art: GrinchHeart,
  },

  RAIN_CLOUD: { name: 'silver lining', group: 'levels', Art: RainCloud },
  PLATINUM_PENCIL: {
    name: 'platinum pencil',
    group: 'levels',
    Art: PlatinumPencil,
  },
  CROWN: { name: 'crown', group: 'levels', Art: Crown },
  MYTHIC_WINGS: { name: 'mythic wings', group: 'levels', Art: MythicWings },
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
