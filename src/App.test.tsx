import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './pages/feed/Feed.tsx';

describe('App', () => {
  test('renders', () => {
    render(<App />);
    expect(screen.getByText('Learn React')).toBeDefined();
  });
});
