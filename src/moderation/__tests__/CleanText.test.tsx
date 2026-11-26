import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

  it("leaves other judges' handles plain on a reviewed doodle", () => {
    const client = new QueryClient();
    client.setQueryData(['ai', 'judges', 'names'], ['Sir Doodleton', 'Santa']);
    const { container } = render(
      <QueryClientProvider client={client}>
        <CleanText text="@SirDoodleton or @Santa?" judge="Sir Doodleton" />
      </QueryClientProvider>,
    );
    const highlighted = [...container.querySelectorAll('.bg-sky')];
    expect(highlighted.map((el) => el.textContent)).toEqual(['@SirDoodleton']);
    expect(container.textContent).toBe('@SirDoodleton or @Santa?');
  });
});
