import type { Comment } from '@/api/Api';

/** Back-to-back comments from one person, shown as a single speech box */
export type CommentRun = { user: Comment['user']; comments: Array<Comment> };

export function commentRuns(comments: Array<Comment>): Array<CommentRun> {
  const runs: Array<CommentRun> = [];
  for (const comment of comments) {
    const last = runs.at(-1);
    if (last?.user.id === comment.user.id) last.comments.push(comment);
    else runs.push({ user: comment.user, comments: [comment] });
  }
  return runs;
}
