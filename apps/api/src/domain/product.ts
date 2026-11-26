export type Category = {
  slug: string;
  name: string;
};

export type Product = {
  id: number;
  title: string;
  price: number;
  description: string;
  image: string;
  category: Category;
  rating: {
    rate: number;
    count: number;
  };
};
