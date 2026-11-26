import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App scaffold', () => {
  it('renders the starter heading', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Product catalogue scaffold' })
        .textContent,
    ).toBe('Product catalogue scaffold');
  });
});
