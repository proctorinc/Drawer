/** One line of a judge's comment, and who says it (null: the judge themself) */
export type Turn = { speaker: string | null; line: string };

/**
 * "Name: " opening a turn: at the start, on a new line, or after the last turn
 * finished its sentence. Names are one capitalized word, so a mid-sentence
 * "Management: ..." stays part of the line.
 */
const TURN = /(?:^|\n|(?<=[.!?…]["”’)]*\s))\s*([A-Z][\w'’-]{0,19}):\s+/g;

/**
 * Splits a comment written as an exchange between characters (the Union
 * Elves' "Bramble: ... Nog: ...") into its turns, one per speaker. Works on
 * a whole exchange on one line, as older reviews have them, or one turn per
 * line. A comment that isn't an exchange is one turn with no speaker.
 */
export function speakerTurns(comment: string): Array<Turn> {
  const text = comment.trim();
  const matches = [...text.matchAll(TURN)];
  if (matches.length < 2 || matches[0].index !== 0)
    return [{ speaker: null, line: text }];
  return matches.map((match, i) => ({
    speaker: match[1],
    line: text
      .slice(match.index + match[0].length, matches[i + 1]?.index)
      .trim(),
  }));
}
