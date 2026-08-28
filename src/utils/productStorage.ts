import { ProductItem } from '../types';

const DB_NAME = 'ecommerce-ai-studio';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
const CURRENT_PRODUCT_KEY = 'current-product';

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('无法打开商品素材数据库。'));
});

export const loadStoredProduct = async (): Promise<ProductItem | null> => {
  if (!('indexedDB' in window)) return null;
  const database = await openDatabase();
  try {
    return await new Promise<ProductItem | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(CURRENT_PRODUCT_KEY);
      request.onsuccess = () => resolve((request.result as ProductItem | undefined) ?? null);
      request.onerror = () => reject(request.error || new Error('无法读取已保存商品。'));
    });
  } finally {
    database.close();
  }
};

export const storeProduct = async (product: ProductItem): Promise<void> => {
  if (!('indexedDB' in window)) return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(product, CURRENT_PRODUCT_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('无法保存商品素材。'));
      transaction.onabort = () => reject(transaction.error || new Error('商品素材保存已中止。'));
    });
  } finally {
    database.close();
  }
};

export const createCompactProduct = (product: ProductItem): ProductItem => {
  const compactImage = (value?: string) => value?.startsWith('data:') ? '' : value;
  return {
    ...product,
    imageUrl: compactImage(product.imageUrl) || '',
    cutoutImageUrl: compactImage(product.cutoutImageUrl),
    images: product.images?.map(compactImage).filter((value): value is string => Boolean(value))
  };
};
