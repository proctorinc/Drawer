import { describe, expect, it } from 'vitest';
import { speakerTurns } from '../speakers';

describe('speakerTurns', () => {
  it('splits an exchange written on one line, as older reviews are', () => {
    expect(
      speakerTurns(
        'Bramble: Noted for the minutes, Management: absent again. Nog: Wake me when… zzz',
      ),
    ).toEqual([
      {
        speaker: 'Bramble',
        line: 'Noted for the minutes, Management: absent again.',
      },
      { speaker: 'Nog', line: 'Wake me when… zzz' },
    ]);
  });

  it('splits one turn per line', () => {
    expect(speakerTurns('Sprocket: §12.4(b)!\nNog: Tea break?')).toEqual([
      { speaker: 'Sprocket', line: '§12.4(b)!' },
      { speaker: 'Nog', line: 'Tea break?' },
    ]);
  });

  it("leaves a single judge's comment whole", () => {
    for (const comment of [
      'Ho ho ho! Rudolph would blush.',
      'Note: this is one voice talking.',
    ]) {
      expect(speakerTurns(comment)).toEqual([{ speaker: null, line: comment }]);
    }
  });
});
