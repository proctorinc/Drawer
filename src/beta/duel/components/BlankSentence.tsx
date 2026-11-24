import { useLayoutEffect, useRef, useState } from 'react';
import { relationLine, tileClass } from './GuessFeedback';
import type { FC } from 'react';
import type { KeywordMark, Segment } from '../api';
import { cn } from '@/utils';
import { CleanText } from '@/moderation/CleanText';

/**
 * A blank's fill: yellow for close, a pencil-gray for a miss, white untried.
 * The one you're on gets the full-strength color; the rest a faint wash of it.
 */
const blankColor = (mark: KeywordMark | null, strong: boolean) => {
  if (mark?.status === 'close') return strong ? 'bg-butter' : 'bg-butter/35';
  if (mark?.status === 'miss')
    return strong ? 'bg-[#e4ded2]' : 'bg-[#e4ded2]/40';
  return 'bg-white';
};

/** The blanks in the order they read in the sentence */
export const blankOrder = (template: Array<Segment>) =>
  template.flatMap((s) => (s.blank === undefined ? [] : [s.blank]));

/** How one blank stands, in a few words */
const clueText = (mark: KeywordMark) => {
  if (mark.status === 'close') {
    return {
      title: mark.relation ? relationLine[mark.relation] : 'close',
      note: mark.note,
    };
  }
  return { title: 'not it', note: mark.note };
};

/**
 * The prompt as a fill-in-the-blank sentence. Found (green) blanks are filled in for
 * you and locked; the rest are inputs (an answer can be a few words). Under it, the
 * hint for the blank you're on, in a speech bubble whose tail points up at that box.
 * Backspace in an empty blank goes back one.
 */
export const BlankSentence: FC<{
  template: Array<Segment>;
  marks: Array<KeywordMark | null>;
  values: Array<string>;
  onChange: (blank: number, value: string) => void;
  /** The blank whose hint is showing: filled solid */
  selected?: number;
  onSelect?: (blank: number) => void;
  disabled?: boolean;
}> = ({
  template,
  marks,
  values,
  onChange,
  selected,
  onSelect,
  disabled = false,
}) => {
  const wrap = useRef<HTMLDivElement>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const open = blankOrder(template).filter((b) => marks[b]?.status !== 'hit');
  const focusFrom = (blank: number, step: 1 | -1) => {
    const at = open.indexOf(blank) + step;
    if (at >= 0 && at < open.length) inputs.current[open[at]]?.focus();
  };

  const hint = selected === undefined ? null : marks[selected];
  const showHint = hint !== null && hint.status !== 'hit';

  // Where the selected box's middle sits, so the bubble's tail can point at it
  const [tailX, setTailX] = useState<number | null>(null);
  const joined = values.join('\u0000');
  useLayoutEffect(() => {
    const measure = () => {
      const box = selected === undefined ? null : inputs.current[selected];
      if (!box || !wrap.current) return setTailX(null);
      const outer = wrap.current.getBoundingClientRect();
      const inner = box.getBoundingClientRect();
      setTailX(inner.left + inner.width / 2 - outer.left);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [selected, joined, showHint]);

  return (
    <div
      ref={wrap}
      className="relative flex flex-col items-center gap-3 w-full"
    >
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 font-accent text-xl leading-tight text-center">
        {template.map((seg, i) => {
          if (seg.blank === undefined) {
            const text = seg.text?.trim();
            return text ? <span key={i}>{text}</span> : null;
          }
          const blank = seg.blank;
          const mark = marks[blank];
          if (mark?.status === 'hit') {
            return (
              <span
                key={i}
                className={cn(
                  'px-2 py-0.5 border-2 rounded-[6px]',
                  tileClass.hit,
                )}
              >
                {mark.keyword || <CleanText text={mark.answer ?? ''} />}
              </span>
            );
          }
          const value = values[blank] ?? '';
          const placeholder = mark?.answer || '?';
          return (
            <input
              key={i}
              ref={(el) => {
                inputs.current[blank] = el;
              }}
              value={value}
              onChange={(e) =>
                onChange(blank, e.target.value.replace(/^\s+/, ''))
              }
              onFocus={() => onSelect?.(blank)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !value) {
                  e.preventDefault();
                  focusFrom(blank, -1);
                }
              }}
              maxLength={30}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              // Read-only, not disabled, while scoring: disabling would drop focus and the keyboard
              readOnly={disabled}
              aria-label={`blank ${open.indexOf(blank) + 1}`}
              placeholder={placeholder}
              style={{
                width: `${Math.max(3, value.length + 1, placeholder.length + 1)}ch`,
              }}
              className={cn(
                'max-w-full px-2 py-0.5 text-center border-2 border-dashed rounded-[6px] placeholder:text-pencil/60 outline-none read-only:opacity-60',
                'border-ink',
                // The box you're on fills in solid, in the same color as its bubble
                selected === blank
                  ? cn('border-solid', blankColor(mark, true))
                  : blankColor(mark, false),
              )}
            />
          );
        })}
      </p>

      {showHint ? (
        <div
          className={cn(
            'relative w-full px-3 py-1.5 text-sm leading-tight text-center border-2 border-ink rounded-sketch',
            blankColor(hint, true),
          )}
          aria-live="polite"
        >
          {tailX !== null && (
            <span
              aria-hidden="true"
              className={cn(
                'absolute -top-[9px] size-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-ink',
                blankColor(hint, true),
              )}
              style={{ left: tailX }}
            />
          )}
          <b>{clueText(hint).title}</b>
          {hint.note && <span> · {hint.note}</span>}
        </div>
      ) : (
        <div className="min-h-5" />
      )}
    </div>
  );
};
