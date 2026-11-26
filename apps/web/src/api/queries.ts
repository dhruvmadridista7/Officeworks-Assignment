import { useMutation, useQuery } from '@tanstack/react-query';
import { catalogueApi } from './client';

export function useFeaturedProducts() {
  return useQuery({
    queryKey: ['products', 'featured'],
    queryFn: catalogueApi.getFeatured,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: catalogueApi.getCategories,
  });
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: ['categories', slug],
    queryFn: () => catalogueApi.getCategory(slug),
    enabled: slug.length > 0,
  });
}

export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: ['products', 'search', query],
    queryFn: () => catalogueApi.searchProducts(query),
    enabled: query.length > 0,
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => catalogueApi.getProduct(id),
    enabled: Number.isSafeInteger(id) && id > 0,
  });
}

export function useSubmitEnquiry() {
  return useMutation({ mutationFn: catalogueApi.submitEnquiry });
}
