import { Link } from 'react-router-dom';
import type { Product } from '../api/client';
import { ProductImage } from './ProductImage';

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <Link className="product-card-link" to={`/products/${product.id}`}>
        <div className="product-image-frame">
          <ProductImage src={product.image} alt={product.title} />
        </div>
        <div className="product-card-content">
          <span className="eyebrow">{product.category.name}</span>
          <h3>{product.title}</h3>
          <div className="product-card-meta">
            <span className="product-price">{product.price.toFixed(2)}</span>
            <span className="rating">★ {product.rating.rate.toFixed(1)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
