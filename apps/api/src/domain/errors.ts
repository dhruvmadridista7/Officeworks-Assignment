export class UpstreamError extends Error {
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { cause?: unknown; retryable?: boolean } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'UpstreamError';
    this.retryable = options.retryable ?? false;
  }
}

export class ProductNotFoundError extends Error {
  constructor(productId: number) {
    super(`Product ${productId} was not found.`);
    this.name = 'ProductNotFoundError';
  }
}

export class CategoryNotFoundError extends Error {
  constructor(slug: string) {
    super(`Category ${slug} was not found.`);
    this.name = 'CategoryNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
