import { useFeaturedProducts } from '../../api/queries';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { ProductGrid } from '../../components/ProductGrid';

export function HomePage() {
  const featured = useFeaturedProducts();

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow">
            Workspace essentials, thoughtfully picked
          </span>
          <h1>Good work starts with the right things.</h1>
          <p>
            Browse useful finds for your desk, your team, and everything in
            between.
          </p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>◎</span>
          <i />
          <b />
        </div>
      </section>

      <section className="catalogue-section" aria-labelledby="featured-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Picked for you</span>
            <h2 id="featured-title">Featured products</h2>
          </div>
          <span className="section-note">
            A few favourites to get you started
          </span>
        </div>
        {featured.isPending && (
          <LoadingState label="Loading featured products…" />
        )}
        {featured.isError && (
          <ErrorState
            message={featured.error.message}
            onRetry={() => void featured.refetch()}
          />
        )}
        {featured.data && featured.data.products.length === 0 && (
          <EmptyState
            title="Nothing featured yet"
            description="Check back soon for our featured products."
          />
        )}
        {featured.data && featured.data.products.length > 0 && (
          <ProductGrid products={featured.data.products} />
        )}
      </section>
    </>
  );
}
