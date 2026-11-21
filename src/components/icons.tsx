import type { FC, SVGProps } from 'react';

// Stroke icons in the same loose pen style as the rest of the sketchbook UI
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const StrokeIcon: FC<IconProps> = ({ size = 24, children, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const PencilIcon: FC<IconProps> = ({ fill, ...props }) => (
  <StrokeIcon {...props}>
    <path d="M4 20l1-4L16 5l3 3L8 19z" fill={fill ?? 'none'} />
    <path d="M14 7l3 3" />
  </StrokeIcon>
);

export const FriendsIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M17 14c2.5 0 4.2 1.5 4.5 4" />
  </StrokeIcon>
);

export const TrophyIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H4.5c0 3 1.2 4.5 3 4.8M17 6h2.5c0 3-1.2 4.5-3 4.8" />
    <path d="M12 14v3.5M8.5 20.5c.5-2 2-3 3.5-3s3 1 3.5 3z" />
  </StrokeIcon>
);

export const ClockIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </StrokeIcon>
);

export const PinIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="8" r="5" fill="var(--color-coral)" />
    <path d="M12 13v8" />
  </StrokeIcon>
);

export const ArrowLeftIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </StrokeIcon>
);

export const EraserIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M7 21h12M5 15l9-9 5 5-9 9H8z" />
    <path d="M10 11l5 5" />
  </StrokeIcon>
);

export const UndoIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </StrokeIcon>
);

export const HeartIcon: FC<IconProps> = ({ fill, ...props }) => (
  <StrokeIcon {...props}>
    <path
      d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"
      fill={fill ?? 'none'}
    />
  </StrokeIcon>
);

export const StarIcon: FC<IconProps> = ({ fill, ...props }) => (
  <StrokeIcon {...props}>
    <path
      d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"
      fill={fill ?? 'none'}
    />
  </StrokeIcon>
);

export const PlusIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M12 5.5c.2 4.5-.1 9 .2 13M5.5 12.2c4.4-.3 8.7.1 13-.2" />
  </StrokeIcon>
);

export const CommentIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M4 5h16v11H9l-5 4z" />
  </StrokeIcon>
);

export const SendIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </StrokeIcon>
);

export const FlameIcon: FC<IconProps> = ({ size = 18, ...props }) => (
  <svg
    width={size}
    height={size * (26 / 24)}
    viewBox="0 0 24 26"
    fill="var(--color-coral)"
    stroke="var(--color-ink)"
    strokeWidth={2}
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2c1 4 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-7 2-10z" />
  </svg>
);

export const BellIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M6 16.5c1-1.2 1.2-3 1.2-5.2 0-3 2-5.3 4.8-5.3s4.9 2.2 4.9 5.2c0 2.3.3 4.1 1.3 5.3z" />
    <path d="M10 19.5c.6 1 1.3 1.4 2 1.4s1.5-.4 2-1.4M12 3.5V6" />
  </StrokeIcon>
);

export const MegaphoneIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M4 10.5v3.2c0 .6.4 1 1 1h2.5L15 19V5L7.5 9.3H5c-.6 0-1 .5-1 1.2z" />
    <path d="M8 14.8l1.2 4.4c.2.6.7.9 1.3.8l.9-.2M18 9.5c.8.7 1.2 1.6 1.2 2.5s-.4 1.8-1.2 2.5" />
  </StrokeIcon>
);

export const SpeakerIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M4 9.5v5c0 .3.2.5.5.5H8l5 4V5L8 9H4.5c-.3 0-.5.2-.5.5z" />
    <path d="M16.5 9.5c.7.7 1 1.6 1 2.5s-.3 1.8-1 2.5M19 7c1.3 1.3 2 3 2 5s-.7 3.7-2 5" />
  </StrokeIcon>
);

export const CheckIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </StrokeIcon>
);

export const ChevronDownIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M6 9.5l6 6 6-6" />
  </StrokeIcon>
);

export const LockIcon: FC<IconProps> = ({ fill, ...props }) => (
  <StrokeIcon {...props}>
    <path
      d="M5.5 11.2c4.4-.4 8.6-.3 13 .1.3 3 .2 6-.2 8.9-4.2.4-8.3.4-12.5 0-.4-3-.5-6-.3-9z"
      fill={fill ?? 'none'}
    />
    <path d="M8.2 11V8a3.8 3.8 0 0 1 7.6-.2V11" />
    <path d="M12 14.8v2.4" />
  </StrokeIcon>
);

export const InfoIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M12 3.2c5-.2 8.9 3.6 8.8 8.9-.1 5-3.9 8.8-8.9 8.7-5-.1-8.7-4-8.6-9 .1-4.9 3.8-8.5 8.7-8.6z" />
    <path d="M12 11v5.5" />
    <path d="M12 7.6v.1" />
  </StrokeIcon>
);

export const GearIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M12 2.8l1.6 2.3 2.7-.7.6 2.7 2.7.8-.8 2.7 2.1 1.8-2.1 1.9.8 2.6-2.7.9-.6 2.6-2.7-.6L12 21.2l-1.6-2.4-2.7.6-.6-2.6-2.7-.9.8-2.6-2.1-1.9 2.1-1.8-.8-2.7 2.7-.8.6-2.7 2.7.7z" />
    <path d="M12 9.2c1.6-.1 2.9 1.2 2.8 2.8 0 1.6-1.3 2.8-2.9 2.8-1.5-.1-2.7-1.3-2.7-2.9.1-1.5 1.3-2.7 2.8-2.7z" />
  </StrokeIcon>
);

export const SpeakerOffIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M4 9.5v5c0 .3.2.5.5.5H8l5 4V5L8 9H4.5c-.3 0-.5.2-.5.5z" />
    <path d="M16.5 9.5l4.5 5M21 9.5l-4.5 5" />
  </StrokeIcon>
);

export const VibrateIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M8.2 4.2c2.5-.2 5-.2 7.5 0 .3 5.2.3 10.4 0 15.6-2.5.2-5 .2-7.5 0-.3-5.2-.3-10.4 0-15.6z" />
    <path d="M11 16.8h2M4.5 8.5l-1.5 1.7 1.5 1.8-1.5 1.8 1.5 1.7M19.5 8.5l1.5 1.7-1.5 1.8 1.5 1.8-1.5 1.7" />
  </StrokeIcon>
);

export const VibrateOffIcon: FC<IconProps> = (props) => (
  <StrokeIcon {...props}>
    <path d="M8.2 4.2c2.5-.2 5-.2 7.5 0 .3 5.2.3 10.4 0 15.6-2.5.2-5 .2-7.5 0-.3-5.2-.3-10.4 0-15.6z" />
    <path d="M11 16.8h2M4 4l16 16" />
  </StrokeIcon>
);
