import { useSearchParams } from 'react-router-dom';
import { useSearchProducts } from '../../api/queries';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { ProductGrid } from '../../components/ProductGrid';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();
  const result = useSearchProducts(query);

  if (!query) {
    return (
      <EmptyState
        title="Search the catalogue"
        description="Enter a product name or keyword in the search box above."
      />
    );
  }
  if (result.isPending)
    return <LoadingState label={`Searching for “${query}”…`} />;
  if (result.isError)
    return (
      <ErrorState
        message={result.error.message}
        onRetry={() => void result.refetch()}
      />
    );
  if (result.data.products.length === 0) {
    return (
      <EmptyState
        title={`No results for “${query}”`}
        description="Try a different word or browse a category."
      />
    );
  }

  return (
    <section className="catalogue-section">
      <div className="page-intro">
        <span className="eyebrow">Search results</span>
        <h1>Results for “{result.data.query}”</h1>
        <p>
          {result.data.products.length}{' '}
          {result.data.products.length === 1 ? 'product' : 'products'} found
        </p>
      </div>
      <ProductGrid products={result.data.products} />
    </section>
  );
}
