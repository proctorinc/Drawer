import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CommentLines } from '../CommentLines';
import { speakerTurns } from '../speakers';

const turns = speakerTurns('Bramble: For the minutes. Nog: Zzz.');
const lines = (container: HTMLElement) =>
  [...container.querySelectorAll(':scope > span')].map((line) => [
    line.querySelector('span')?.textContent,
    line.textContent,
  ]);

describe('CommentLines', () => {
  it('puts each speaker on a line of their own, named without the colon', () => {
    const { container } = render(<CommentLines turns={turns} />);
    expect(lines(container)).toEqual([
      ['Bramble', 'BrambleFor the minutes.'],
      ['Nog', 'NogZzz.'],
    ]);
  });

  it('only shows the next speaker once their line starts typing', () => {
    const typed = (n: number) =>
      lines(render(<CommentLines turns={turns} typed={n} />).container);
    expect(typed(16)).toEqual([['Bramble', 'BrambleFor the minutes.']]);
    expect(typed(18)).toEqual([
      ['Bramble', 'BrambleFor the minutes.'],
      ['Nog', 'NogZ'],
    ]);
  });
});
