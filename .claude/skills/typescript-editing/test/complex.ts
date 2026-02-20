import { Observable } from 'rxjs';

export interface Product {
  id: string;
  name: string;
  price: number;
}

export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export enum Category {
  Electronics,
  Clothing,
  Food
}

export class ProductService {
  private products: Product[] = [];

  findById(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }
}

export function createProduct(name: string, price: number): Product {
  return {
    id: Math.random().toString(),
    name,
    price
  };
}
