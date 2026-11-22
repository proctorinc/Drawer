import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CleanText } from '../CleanText';

describe('CleanText', () => {
  it('swaps the swear word for a "redacted" tag', () => {
    const { container } = render(
      <p>
        <CleanText text="this is fucking great" />
      </p>,
    );
    expect(container.textContent).toBe('this is redacted great');
    expect(container.querySelector('.font-silly')?.textContent).toBe(
      'redacted',
    );
  });

  it('renders clean text untouched', () => {
    const { container } = render(<CleanText text="cute cat" />);
    expect(container.innerHTML).toBe('<span>cute cat</span>');
  });
});
