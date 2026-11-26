import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { App } from './App';
import type { Product } from './api/client';

const API_URL = 'http://localhost:4000/api';
const category = { slug: 'electronics', name: 'electronics' };
const products: Product[] = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  title: `Sample product ${index + 1}`,
  price: 20 + index,
  description: `Useful item ${index + 1} for a workspace.`,
  image: `https://example.com/${index + 1}.jpg`,
  category,
  rating: { rate: 4.5 - index * 0.1, count: 20 + index },
}));

const defaultHandlers = [
  http.get(`${API_URL}/products/featured`, () =>
    HttpResponse.json({ products }),
  ),
  http.get(`${API_URL}/categories`, () =>
    HttpResponse.json({ categories: [category] }),
  ),
  http.get(`${API_URL}/categories/electronics`, () =>
    HttpResponse.json({
      category,
      topRated: products.slice(0, 3),
      others: products.slice(3),
    }),
  ),
  http.get(`${API_URL}/products`, ({ request }) => {
    const query = new URL(request.url).searchParams.get('q') ?? '';
    const matches = query.toLowerCase() === 'sample' ? products : [];
    return HttpResponse.json({ query, products: matches });
  }),
  http.get(`${API_URL}/products/:id`, ({ params }) => {
    const product = products.find((item) => item.id === Number(params.id));
    if (!product)
      return HttpResponse.json(
        { error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } },
        { status: 404 },
      );
    return HttpResponse.json({ product });
  }),
  http.post(`${API_URL}/enquiries`, () =>
    HttpResponse.json({ status: 'received' }, { status: 201 }),
  ),
];

const server = setupServer(...defaultHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  window.history.pushState({}, '', '/');
});
afterAll(() => server.close());
beforeEach(() => window.history.pushState({}, '', '/'));

function renderApp(path = '/') {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('catalogue user journeys', () => {
  it('shows the five featured products on the home page', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Featured products' }),
    ).toBeInTheDocument();
    await screen.findByRole('heading', { name: products[0].title });
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
    for (const product of products) {
      expect(
        screen.getByRole('heading', { name: product.title }),
      ).toBeInTheDocument();
    }
    fireEvent.error(screen.getByRole('img', { name: products[0].title }));
    expect(
      screen.getByRole('img', { name: products[0].title }),
    ).toHaveTextContent('Image unavailable');
  });

  it('shows top-rated and additional products on the category page', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(
      await screen.findByRole('link', { name: 'electronics' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Top rated' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'More in this category' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: products[0].title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: products[4].title }),
    ).toBeInTheDocument();
  });

  it('opens product details when a product tile is selected', async () => {
    const user = userEvent.setup();
    renderApp();

    const productLink = await screen.findByRole('link', {
      name: /Sample product 1/,
    });
    await user.click(productLink);

    expect(
      await screen.findByRole('heading', { name: products[0].title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Enquire about this product' }),
    ).toHaveAttribute('href', '/products/1/enquire');
  });

  it('searches only after submit and ignores an empty submission', async () => {
    const user = userEvent.setup();
    let searchRequests = 0;
    server.use(
      http.get(`${API_URL}/products`, ({ request }) => {
        searchRequests += 1;
        const query = new URL(request.url).searchParams.get('q') ?? '';
        return HttpResponse.json({
          query,
          products: query === 'sample' ? products : [],
        });
      }),
    );
    renderApp();
    await screen.findByRole('heading', { name: 'Featured products' });

    const search = screen.getByRole('searchbox', { name: 'Search products' });
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(searchRequests).toBe(0);
    await user.type(search, '   ');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(searchRequests).toBe(0);

    await user.clear(search);
    await user.type(search, 'sample');
    expect(searchRequests).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByRole('heading', { name: /Results for “sample”/ }),
    ).toBeInTheDocument();
    expect(searchRequests).toBe(1);

    await user.clear(search);
    await user.type(search, 'nothing-matches');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByRole('heading', {
        name: 'No results for “nothing-matches”',
      }),
    ).toBeInTheDocument();
    expect(searchRequests).toBe(2);

    await user.clear(search);
    await user.type(search, 'another-missing-term{Enter}');
    expect(
      await screen.findByRole('heading', {
        name: 'No results for “another-missing-term”',
      }),
    ).toBeInTheDocument();
    expect(searchRequests).toBe(3);
  });

  it('validates the enquiry form and shows thank-you after successful submit', async () => {
    const user = userEvent.setup();
    let submittedEnquiry: unknown;
    server.use(
      http.post(`${API_URL}/enquiries`, async ({ request }) => {
        submittedEnquiry = await request.json();
        return HttpResponse.json({ status: 'received' }, { status: 201 });
      }),
    );
    renderApp('/products/1/enquire');

    expect(
      await screen.findByRole('heading', {
        name: 'Ask us about this product.',
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(
      screen.getByText('Enter a valid email address.'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Name/), 'Jane Doe');
    await user.type(screen.getByLabelText(/Email/), 'jane@example.com');
    await user.type(screen.getByLabelText(/Phone/), '+91 98765 43210');
    await user.type(screen.getByLabelText(/Message/), 'Is this available?');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Thank you for getting in touch.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue browsing' }),
    ).toHaveAttribute('href', '/');
    expect(submittedEnquiry).toEqual({
      productId: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+91 98765 43210',
      message: 'Is this available?',
      website: '',
    });
  });

  it('shows an API error instead of thank-you when enquiry delivery fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/enquiries`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'EMAIL_DELIVERY_FAILED',
              message:
                'Your enquiry could not be sent. Please try again later.',
            },
          },
          { status: 502 },
        ),
      ),
    );
    renderApp('/products/1/enquire');
    await screen.findByRole('heading', { name: 'Ask us about this product.' });
    await user.type(screen.getByLabelText(/Name/), 'Jane Doe');
    await user.type(screen.getByLabelText(/Email/), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your enquiry could not be sent. Please try again later.',
    );
    expect(
      screen.queryByRole('heading', {
        name: 'Thank you for getting in touch.',
      }),
    ).not.toBeInTheDocument();
  });

  it('offers retry after a data request fails', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.use(
      http.get(`${API_URL}/products/featured`, () => {
        attempts += 1;
        if (attempts < 3) {
          return HttpResponse.json(
            {
              error: {
                code: 'UPSTREAM_ERROR',
                message: 'Temporarily unavailable.',
              },
            },
            { status: 502 },
          );
        }
        return HttpResponse.json({ products });
      }),
    );
    renderApp();

    const retry = await screen.findByRole(
      'button',
      { name: 'Retry' },
      { timeout: 5_000 },
    );
    await user.click(retry);
    expect(
      await screen.findByRole('heading', { name: 'Featured products' }),
    ).toBeInTheDocument();
    expect(attempts).toBe(3);
  });

  it('shows a loading state while the featured products request is pending', async () => {
    let releaseResponse: (() => void) | undefined;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    server.use(
      http.get(`${API_URL}/products/featured`, async () => {
        await responseGate;
        return HttpResponse.json({ products });
      }),
    );
    renderApp();

    expect(screen.getByText(/Loading featured products/)).toBeInTheDocument();
    releaseResponse?.();
    expect(
      await screen.findByRole('heading', { name: 'Featured products' }),
    ).toBeInTheDocument();
  });

  it('does not automatically retry a not-found product response', async () => {
    let attempts = 0;
    server.use(
      http.get(`${API_URL}/products/:id`, () => {
        attempts += 1;
        return HttpResponse.json(
          {
            error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' },
          },
          { status: 404 },
        );
      }),
    );
    renderApp('/products/99999');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Product not found.',
    );
    expect(attempts).toBe(1);
  });
});
