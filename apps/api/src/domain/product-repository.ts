import type { Category, Product } from './product';

export interface ProductRepository {
  list(): Promise<Product[]>;
  getById(id: number): Promise<Product | null>;
  listCategories(): Promise<Category[]>;
}
