import { z } from 'zod';

export const CategorySchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export const ProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  price: z.number().nonnegative(),
  description: z.string(),
  image: z.string().url(),
  category: CategorySchema,
  rating: z.object({
    rate: z.number().min(0).max(5),
    count: z.number().int().nonnegative(),
  }),
});

export type Category = z.infer<typeof CategorySchema>;
export type Product = z.infer<typeof ProductSchema>;

const FeaturedResponseSchema = z.object({ products: z.array(ProductSchema) });
const CategoriesResponseSchema = z.object({
  categories: z.array(CategorySchema),
});
const CategoryResponseSchema = z.object({
  category: CategorySchema,
  topRated: z.array(ProductSchema),
  others: z.array(ProductSchema),
});
const SearchResponseSchema = z.object({
  query: z.string(),
  products: z.array(ProductSchema),
});
const ProductResponseSchema = z.object({ product: ProductSchema });
const EnquiryResponseSchema = z.object({ status: z.literal('received') });
const ErrorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type EnquiryRequest = {
  productId: number;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  website: string;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const apiBaseUrl = (
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
).replace(/\/+$/, '');

async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError(
      'Could not reach the catalogue service. Check your connection and retry.',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      'The catalogue service returned an invalid response.',
      response.status,
    );
  }

  if (!response.ok) {
    const error = ErrorResponseSchema.safeParse(payload);
    throw new ApiClientError(
      error.success
        ? error.data.error.message
        : 'The request could not be completed.',
      response.status,
      error.success ? error.data.error.code : undefined,
    );
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiClientError(
      'The catalogue service returned data in an unexpected format.',
      response.status,
    );
  }
  return result.data;
}

export const catalogueApi = {
  getFeatured: () => requestJson('/products/featured', FeaturedResponseSchema),
  getCategories: () => requestJson('/categories', CategoriesResponseSchema),
  getCategory: (slug: string) =>
    requestJson(
      `/categories/${encodeURIComponent(slug)}`,
      CategoryResponseSchema,
    ),
  searchProducts: (query: string) =>
    requestJson(
      `/products?q=${encodeURIComponent(query)}`,
      SearchResponseSchema,
    ),
  getProduct: (id: number) =>
    requestJson(`/products/${id}`, ProductResponseSchema),
  submitEnquiry: (enquiry: EnquiryRequest) =>
    requestJson('/enquiries', EnquiryResponseSchema, {
      method: 'POST',
      body: JSON.stringify(enquiry),
    }),
};
