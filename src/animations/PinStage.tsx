import { useState } from 'react';
import type { StageComponent } from './types';
import useUser from '@/auth/hooks/useUser';
import { PIN_COLORS } from '@/components/PushPin';
import { PinCeremony } from '@/drawing/components/PinCeremony';

/** Pinning a just-drawn doodle to the wall, picking up from where its canvas sat */
export const PinStage: StageComponent<'pin'> = ({ payload, onDone }) => {
  const user = useUser();
  const [from] = useState(
    () =>
      new DOMRect(
        payload.from.x,
        payload.from.y,
        payload.from.width,
        payload.from.height,
      ),
  );

  return (
    <PinCeremony
      imageUrl={payload.imageUrl}
      from={from}
      // Your polaroid leads the wall, which gives the first card this pin
      pinColor={PIN_COLORS[0]}
      user={user}
      onDone={onDone}
    />
  );
};
