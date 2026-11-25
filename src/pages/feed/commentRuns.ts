import type { AIReply, Comment } from '@/api/Api';

/** Back-to-back comments from one person, shown as a single speech box */
export type CommentRun = { user: Comment['user']; comments: Array<Comment> };

/** A judge's reply, which always gets a speech box of its own */
export type ReplyEntry = { reply: AIReply };

/**
 * The comments and the judge's replies in the order they were said, with
 * each person's back-to-back comments joined into one run.
 */
export function commentThread(
  comments: Array<Comment>,
  replies: Array<AIReply> = [],
): Array<CommentRun | ReplyEntry> {
  const said = [
    ...comments.map((comment) => ({ at: comment.createdAt, comment })),
    ...replies.map((reply) => ({ at: reply.createdAt, reply })),
  ];
  // Stable, so comments said at the same moment keep their order
  said.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const thread: Array<CommentRun | ReplyEntry> = [];
  for (const entry of said) {
    if ('reply' in entry) {
      thread.push({ reply: entry.reply });
      continue;
    }
    const last = thread.at(-1);
    if (last && 'user' in last && last.user.id === entry.comment.user.id) {
      last.comments.push(entry.comment);
    } else {
      thread.push({ user: entry.comment.user, comments: [entry.comment] });
    }
  }
  return thread;
}
