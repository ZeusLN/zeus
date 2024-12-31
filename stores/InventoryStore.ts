import { action, observable } from 'mobx';
import Product from '../models/Product';
import ProductCategory from '../models/ProductCategory';
import Storage from '../storage';

export const LEGACY_CATEGORY_KEY = 'zeus-product-categories';
export const LEGACY_PRODUCT_KEY = 'zeus-products';

export const CATEGORY_KEY = 'zeus-product-categories-v2';
export const PRODUCT_KEY = 'zeus-products-v2';

export default class InventoryStore {
    @observable categories: Array<ProductCategory> = [];
    @observable products: Array<Product> = [];
    @observable public loading = false;

    @action
    public async getInventory() {
        this.loading = true;
        try {
            // Retrieve the categories
            const categories = await Storage.getItem(CATEGORY_KEY);
            if (categories) {
                this.categories = JSON.parse(categories) || [];
            }
            // Retrieve the products
            const products = await Storage.getItem(PRODUCT_KEY);
            if (products) {
                this.products = JSON.parse(products) || [];
            }
        } catch (error) {
            console.error('Could not load inventory', error);
        } finally {
            this.loading = false;
        }

        return {
            categories: this.categories,
            products: this.products
        };
    }

    @action
    public async setCategories(categories: string) {
        this.loading = true;
        await Storage.setItem(CATEGORY_KEY, categories);
        this.loading = false;
        return categories;
    }

    @action
    public updateCategories = async (newCategory: ProductCategory) => {
        const { categories: existingCategories } = await this.getInventory();

        const found = existingCategories.find((c) => c.id === newCategory.id);
        if (found) {
            const { products } = await this.getInventory();
            const updatedProducts = products
                .filter((product) => product.category === found.name)
                .map(
                    (product) =>
                        ({ ...product, category: newCategory.name } as Product)
                );
            if (updatedProducts.length > 0) {
                await this.updateProducts(updatedProducts);
            }

            found.name = newCategory.name;
        } else {
            existingCategories.push(newCategory);
        }

        await this.setCategories(JSON.stringify(existingCategories));

        const { categories } = await this.getInventory();
        return categories;
    };

    @action
    public deleteCategory = async (categoryId: string) => {
        const { categories: existingCategories } = await this.getInventory();

        const idx = existingCategories.findIndex((c) => c.id === categoryId);
        if (idx > -1) {
            existingCategories.splice(idx, 1);
            await this.setCategories(JSON.stringify(existingCategories));

            const { categories } = await this.getInventory();
            return categories;
        }
    };

    @action
    public async setProducts(products: string) {
        this.loading = true;
        await Storage.setItem(PRODUCT_KEY, products);
        this.loading = false;
        return products;
    }

    @action
    public updateProducts = async (newProducts: Product[]) => {
        const { products: existingProducts } = await this.getInventory();

        newProducts.forEach((newProduct) => {
            const found = existingProducts.find((c) => c.id === newProduct.id);
            if (found) {
                found.name = newProduct.name;
                found.sku = newProduct.sku;
                found.price = newProduct.price;
                found.pricedIn = newProduct.pricedIn;
                found.category = newProduct.category;
                found.status = newProduct.status;
            } else {
                existingProducts.push(newProduct);
            }
        });

        await this.setProducts(JSON.stringify(existingProducts));
        // ensure we get the enhanced settings set
        const { products } = await this.getInventory();
        return products;
    };

    @action
    public deleteProduct = async (productIds: string[]) => {
        const { products: existingProducts } = await this.getInventory();

        const updatedProducts = existingProducts.filter(
            (p) => !productIds.includes(p.id)
        );
        await this.setProducts(JSON.stringify(updatedProducts));

        const { products } = await this.getInventory();
        return products;
    };
}
