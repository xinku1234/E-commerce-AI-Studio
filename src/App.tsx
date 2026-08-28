/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { ProductModal } from './components/ProductModal';
import { HeroStudio } from './components/HeroImageStudio/HeroStudio';
import { ProductItem, BatchTask } from './types';
import { SAMPLE_PRODUCTS } from './data/presets';
import { createCompactProduct, loadStoredProduct, storeProduct } from './utils/productStorage';

const DetailPageStudio = lazy(() => import('./components/DetailPageStudio/DetailPageStudio').then(module => ({ default: module.DetailPageStudio })));
const BatchStudio = lazy(() => import('./components/BatchGenerator/BatchStudio').then(module => ({ default: module.BatchStudio })));
const PublishHub = lazy(() => import('./components/PublishHub/PublishHub').then(module => ({ default: module.PublishHub })));

const WorkspaceLoading = () => (
  <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-400" role="status">
    正在加载工作区...
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'hero' | 'detail' | 'batch' | 'publish'>('hero');
  const [currentProduct, setCurrentProduct] = useState<ProductItem>(() => {
    try {
      const saved = localStorage.getItem('ECOM_STUDIO_CURRENT_PRODUCT');
      return saved ? JSON.parse(saved) : SAMPLE_PRODUCTS[0];
    } catch {
      return SAMPLE_PRODUCTS[0];
    }
  });
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [hasLoadedStoredProduct, setHasLoadedStoredProduct] = useState(false);
  
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>(() => {
    try {
      const saved = localStorage.getItem('ECOM_STUDIO_BATCH_TASKS');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let isActive = true;
    loadStoredProduct()
      .then((storedProduct) => {
        if (isActive && storedProduct) setCurrentProduct(storedProduct);
      })
      .catch((error) => console.warn('Unable to restore product images:', error))
      .finally(() => {
        if (isActive) setHasLoadedStoredProduct(true);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredProduct) return;
    try {
      localStorage.setItem('ECOM_STUDIO_CURRENT_PRODUCT', JSON.stringify(createCompactProduct(currentProduct)));
    } catch (error) {
      console.warn('Unable to persist current product metadata:', error);
    }
    storeProduct(currentProduct).catch((error) => console.warn('Unable to persist product images:', error));
  }, [currentProduct, hasLoadedStoredProduct]);

  useEffect(() => {
    try {
      const compactTasks = batchTasks.slice(0, 100).map(task => ({
        ...task,
        resultImageUrl: task.resultImageUrl?.startsWith('data:') ? undefined : task.resultImageUrl
      }));
      localStorage.setItem('ECOM_STUDIO_BATCH_TASKS', JSON.stringify(compactTasks));
    } catch (error) {
      console.warn('Unable to persist batch tasks:', error);
    }
  }, [batchTasks]);

  const handleAddToBatch = (newTask: BatchTask) => {
    setBatchTasks(prev => [newTask, ...prev]);
  };

  const handleClearTasks = () => {
    setBatchTasks([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentProduct={currentProduct}
        onOpenProductModal={() => setIsProductModalOpen(true)}
        batchCount={batchTasks.length}
      />

      {/* Main Workspace View Switcher */}
      <main className="flex-1 pb-16">
        {activeTab === 'hero' && (
          <HeroStudio
            currentProduct={currentProduct}
            onAddToBatch={handleAddToBatch}
            onSyncToDetail={() => setActiveTab('detail')}
            onOpenProductModal={() => setIsProductModalOpen(true)}
            onUpdateProduct={(updated) => setCurrentProduct(updated)}
          />
        )}

        <Suspense fallback={<WorkspaceLoading />}>
          {activeTab === 'detail' && (
            <DetailPageStudio
              currentProduct={currentProduct}
              onNavigateToPublish={() => setActiveTab('publish')}
            />
          )}

          {activeTab === 'batch' && (
            <BatchStudio
              batchTasks={batchTasks}
              onUpdateTasks={setBatchTasks}
              onClearTasks={handleClearTasks}
              currentProduct={currentProduct}
              onNavigateToPublish={() => setActiveTab('publish')}
            />
          )}

          {activeTab === 'publish' && (
            <PublishHub currentProduct={currentProduct} />
          )}
        </Suspense>
      </main>

      {/* Product Selection & Upload Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        currentProduct={currentProduct}
        onSelectProduct={(p) => setCurrentProduct(p)}
        onSaveNewProduct={async (p) => {
          await storeProduct(p);
          setCurrentProduct(p);
        }}
      />
    </div>
  );
}
