import { useParams } from 'react-router-dom';
import { useCategory } from '../../api/queries';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { ProductGrid } from '../../components/ProductGrid';

export function CategoryPage() {
  const { slug = '' } = useParams();
  const result = useCategory(slug);

  if (result.isPending) return <LoadingState label="Loading category…" />;
  if (result.isError)
    return (
      <ErrorState
        message={result.error.message}
        onRetry={() => void result.refetch()}
      />
    );
  const { category, topRated, others } = result.data;
  if (topRated.length === 0 && others.length === 0) {
    return (
      <EmptyState
        title={`No ${category.name} products yet`}
        description="Try another category or browse all products."
      />
    );
  }

  return (
    <div className="catalogue-section">
      <div className="page-intro">
        <span className="eyebrow">Browse by category</span>
        <h1>{category.name}</h1>
        <p>Popular picks and more from this collection.</p>
      </div>
      {topRated.length > 0 && (
        <section
          className="catalogue-section"
          aria-labelledby="top-rated-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Customer favourites</span>
              <h2 id="top-rated-title">Top rated</h2>
            </div>
          </div>
          <ProductGrid products={topRated} />
        </section>
      )}
      {others.length > 0 && (
        <section className="catalogue-section" aria-labelledby="more-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Explore the range</span>
              <h2 id="more-title">More in this category</h2>
            </div>
          </div>
          <ProductGrid products={others} />
        </section>
      )}
    </div>
  );
}
