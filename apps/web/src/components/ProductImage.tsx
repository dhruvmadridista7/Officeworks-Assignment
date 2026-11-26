import { useState } from 'react';

type ProductImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
};

export function ProductImage({
  src,
  alt,
  className,
  loading = 'lazy',
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="product-image-fallback" role="img" aria-label={alt}>
        <span aria-hidden="true">▧</span>
        <small>Image unavailable</small>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
