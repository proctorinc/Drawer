import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { JudgeIntroDialogue } from '../JudgeIntro';
import type { JudgeIntro } from '../JudgeIntro';

vi.mock('@/api/apiClient', () => ({ fetchAPI: vi.fn() }));

// jsdom has no matchMedia; the typewriter asks about reduced motion
window.matchMedia = vi.fn().mockReturnValue({ matches: false });

const intro: JudgeIntro = {
  judge: {
    id: 'j1',
    name: 'Sir Doodleton',
    bio: '',
    avatarUrl: '',
    decoration: '',
  },
  day: '2026-11-20',
  prompt: 'A prehistoric city',
  lines: [
    'Hark, a doodler!',
    'I need you to draw me a prehistoric city, my ancestors demand a monument.',
    'Return with it and I shall rate it.',
  ],
};

describe('JudgeIntroDialogue', () => {
  it('pages through the lines, then asks you to draw', () => {
    const onAccept = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <JudgeIntroDialogue
        intro={intro}
        onAccept={onAccept}
        onClose={onClose}
      />,
    );
    const overlay = container.firstElementChild!;
    const bubble = () => screen.getByRole('dialog').textContent ?? '';

    // Tap once to finish typing, again to turn the page
    fireEvent.click(overlay);
    expect(bubble()).toContain('Hark, a doodler!');
    expect(screen.queryByText("Let's draw!")).toBeNull();
    fireEvent.click(overlay);
    fireEvent.click(overlay);

    // The prompt is picked out in the ask
    expect(container.querySelector('b.highlight')?.textContent).toBe(
      'prehistoric city',
    );

    fireEvent.click(overlay);
    fireEvent.click(overlay);
    expect(bubble()).toContain('I shall rate it');
    fireEvent.click(screen.getByText("Let's draw!"));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Later', () => {
    const onClose = vi.fn();
    const { container } = render(
      <JudgeIntroDialogue
        intro={{ ...intro, lines: intro.lines.slice(0, 2) }}
        onAccept={vi.fn()}
        onClose={onClose}
      />,
    );
    const overlay = container.firstElementChild!;
    fireEvent.click(overlay);
    fireEvent.click(overlay);
    fireEvent.click(overlay);
    fireEvent.click(screen.getByText('Later'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
