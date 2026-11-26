import { Link, useParams } from 'react-router-dom';
import { useProduct } from '../../api/queries';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { ProductImage } from '../../components/ProductImage';

export function ProductPage() {
  const { id = '' } = useParams();
  const productId = /^\d+$/.test(id) ? Number(id) : Number.NaN;
  const productQuery = useProduct(productId);

  if (!Number.isSafeInteger(productId) || productId < 1) {
    return (
      <div className="inline-error" role="alert">
        This product address is invalid. <Link to="/">Browse products</Link>
      </div>
    );
  }
  if (productQuery.isPending)
    return <LoadingState label="Loading product details…" />;
  if (productQuery.isError)
    return (
      <ErrorState
        message={productQuery.error.message}
        onRetry={() => void productQuery.refetch()}
      />
    );
  const { product } = productQuery.data;

  return (
    <article className="product-detail">
      <div className="product-detail-image">
        <ProductImage src={product.image} alt={product.title} loading="eager" />
      </div>
      <div className="product-detail-copy">
        <Link className="back-link" to={`/category/${product.category.slug}`}>
          ← {product.category.name}
        </Link>
        <span className="eyebrow">Product details</span>
        <h1>{product.title}</h1>
        <div className="detail-meta">
          <span className="product-price">{product.price.toFixed(2)}</span>
          <span className="rating">
            ★ {product.rating.rate.toFixed(1)}{' '}
            <small>({product.rating.count} reviews)</small>
          </span>
        </div>
        <p className="product-description">{product.description}</p>
        <Link
          className="button button-primary"
          to={`/products/${product.id}/enquire`}
        >
          Enquire about this product
        </Link>
      </div>
    </article>
  );
}
