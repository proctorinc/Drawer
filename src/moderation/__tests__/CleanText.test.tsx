import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CleanText } from '../CleanText';

describe('CleanText', () => {
  it('swaps the swear word for a silly word in a rainbow tag', () => {
    const { container } = render(
      <p>
        <CleanText text="this is fucking great" />
      </p>,
    );
    const tag = container.querySelector<HTMLElement>('.font-silly');
    expect(tag?.textContent).toMatch(/ing$/);
    expect(container.textContent).toBe(`this is ${tag?.textContent} great`);
    expect(tag?.style.backgroundImage).toContain('linear-gradient');
  });

  it('renders clean text untouched', () => {
    const { container } = render(<CleanText text="cute cat" />);
    expect(container.innerHTML).toBe('<span>cute cat</span>');
  });
});
