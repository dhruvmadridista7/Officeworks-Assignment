import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ApiClientError } from './api/client';
import { Layout } from './components/Layout';
import { CategoryPage } from './features/category/CategoryPage';
import { EnquiryPage } from './features/enquiry/EnquiryPage';
import { HomePage } from './features/home/HomePage';
import { ProductPage } from './features/product/ProductPage';
import { SearchPage } from './features/search/SearchPage';
import './styles/tokens.css';
import './styles/global.css';

function NotFoundPage() {
  return (
    <section className="not-found-page">
      <span className="eyebrow">404 — Page not found</span>
      <h1>We couldn’t find that page.</h1>
      <p>
        The link may be out of date. Head back to the catalogue to keep
        browsing.
      </p>
      <Link className="button button-primary" to="/">
        Browse products
      </Link>
    </section>
  );
}

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (
                error instanceof ApiClientError &&
                error.status !== undefined &&
                error.status < 500
              ) {
                return false;
              }
              return failureCount < 1;
            },
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="category/:slug" element={<CategoryPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="products/:id" element={<ProductPage />} />
            <Route path="products/:id/enquire" element={<EnquiryPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
