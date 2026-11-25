import { useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FC, KeyboardEvent } from 'react';
import type { Mentionable } from '@/mentions/mentions';
import { refreshProgress } from '@/animations/useProgressWatcher';
import { AIJudgeAvatar } from '@/ai/AIJudgeAvatar';
import { queryKeys, useAddComment } from '@/api/Api';
import { useAlert } from '@/components/Confirm';
import { CommentIcon } from '@/components/icons';
import { matchMentions, mentionAtCaret } from '@/mentions/mentions';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

type Props = {
  submissionId: string;
  /** Who typing @ suggests: the judge, the artist, commenters, your friends */
  mentionables: Array<Mentionable>;
};

/**
 * A slim line to write a comment on, sent with the comment icon. Typing @
 * suggests who to mention.
 */
export const CommentComposer: FC<Props> = ({ submissionId, mentionables }) => {
  const queryClient = useQueryClient();
  const addComment = useAddComment();
  const alert = useAlert();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  // Escape (or leaving the box) hides the suggestions until the next keystroke
  const [dismissed, setDismissed] = useState(false);
  const canSend = !!text.trim() && !addComment.isPending;

  const typing = mentionAtCaret(text, caret);
  const suggestions =
    typing && !dismissed ? matchMentions(mentionables, typing.query) : [];
  const open = suggestions.length > 0;
  const active = Math.min(highlight, suggestions.length - 1);

  function edit(value: string, at: number) {
    setText(value);
    setCaret(at);
    setHighlight(0);
    setDismissed(false);
  }

  function pick(mention: Mentionable) {
    if (!typing) return;
    const before = `${text.slice(0, typing.start)}@${mention.handle} `;
    // Swaps out the rest of the word being typed too, if the caret was mid-word
    const after = text.slice(caret).replace(/^\S*\s?/, '');
    edit(before + after, before.length);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(before.length, before.length);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((active + step + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDismissed(true);
    }
  }

  function send() {
    if (!canSend) return;
    addComment.mutate(
      { submissionId, text },
      {
        onSuccess: () => {
          for (const queryKey of [
            queryKeys.myProfile,
            queryKeys.promptSubmission(submissionId),
            queryKeys.activityFeed,
          ]) {
            queryClient.invalidateQueries({ queryKey });
          }
          refreshProgress(queryClient);
          edit('', 0);
        },
        onError: (err) =>
          alert({ title: "couldn't post that", message: err.message }),
      },
    );
  }

  return (
    <form
      className="relative flex items-center gap-1 h-10 pl-3 pr-1 bg-white border-2 border-ink rounded-sketch-alt"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <input
        ref={inputRef}
        className="flex-1 min-w-0 bg-transparent placeholder:text-pencil/70 focus:outline-none"
        placeholder="Add a comment..."
        aria-label="Your comment"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        value={text}
        onChange={(e) =>
          edit(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onKeyDown={onKeyDown}
        onBlur={() => setDismissed(true)}
      />
      <button
        type="submit"
        aria-label="Post comment"
        disabled={!canSend}
        className="grid place-items-center size-8 cursor-pointer text-ink transition-[scale,opacity] duration-300 ease-[var(--ease-spring)] hover:scale-110 active:scale-90 disabled:opacity-30 disabled:cursor-default disabled:hover:scale-100"
      >
        <CommentIcon size={20} strokeWidth={2.2} />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention someone"
          className="absolute z-20 left-0 right-0 bottom-full mb-1.5 flex flex-col py-1 bg-white border-2 border-ink rounded-sketch-alt shadow-pencil-sm"
        >
          {suggestions.map((mention, i) => (
            <li
              key={mention.handle}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keeps focus in the input, so the pick lands where you were typing
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(mention)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'flex items-center gap-2 px-2 py-1 cursor-pointer font-semibold',
                i === active && 'bg-sky',
              )}
            >
              {mention.kind === 'judge' ? (
                <AIJudgeAvatar judge={mention.judge} size="xs" />
              ) : (
                <UserProfileIcon user={mention.user} size="xs" />
              )}
              <span className="truncate">@{mention.handle}</span>
              {mention.kind === 'judge' && (
                <span className="ml-auto px-1.5 rounded-full border-[1.5px] border-ink bg-sky text-xs font-bold">
                  judge
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
};
