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
import { useModelBinding } from './hooks/useModelBinding';
import { ErrorBoundary } from './components/ErrorBoundary';

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
  const [modelConfigRequest, setModelConfigRequest] = useState(0);
  // One binding shared by every workspace, so the prompt model configured once
  // is the model each AI call uses. The workspace stays locked until the server
  // confirms a usable model.
  const modelBinding = useModelBinding();
  // The model dialog lives in the hero workspace, so a request from any other
  // workspace has to bring the user there for the dialog to be reachable.
  const requestModelConfig = () => {
    setActiveTab('hero');
    setModelConfigRequest(value => value + 1);
  };
  
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
        modelReady={modelBinding.modelReady}
        onRequireModel={requestModelConfig}
      />

      {/* Main Workspace View Switcher */}
      <main className="flex-1 pb-16">
        {/* Each workspace gets its own boundary so one failing panel keeps the
            navigation and the other workspaces usable. */}
        {activeTab === 'hero' && (
          <ErrorBoundary variant="panel" label="主图工作台">
            <HeroStudio
              currentProduct={currentProduct}
              onAddToBatch={handleAddToBatch}
              onSyncToDetail={() => setActiveTab('detail')}
              onOpenProductModal={() => setIsProductModalOpen(true)}
              onUpdateProduct={(updated) => setCurrentProduct(updated)}
              modelBinding={modelBinding}
              modelConfigRequest={modelConfigRequest}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'detail' && (
          <ErrorBoundary variant="panel" label="详情页工作台">
            <Suspense fallback={<WorkspaceLoading />}>
              <DetailPageStudio
                currentProduct={currentProduct}
                onNavigateToPublish={() => setActiveTab('publish')}
                modelBinding={modelBinding}
                onRequireModel={requestModelConfig}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeTab === 'batch' && (
          <ErrorBoundary variant="panel" label="批量矩阵工作区">
            <Suspense fallback={<WorkspaceLoading />}>
              <BatchStudio
                batchTasks={batchTasks}
                onUpdateTasks={setBatchTasks}
                onClearTasks={handleClearTasks}
                currentProduct={currentProduct}
                onNavigateToPublish={() => setActiveTab('publish')}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeTab === 'publish' && (
          <ErrorBoundary variant="panel" label="多渠道分发工作区">
            <Suspense fallback={<WorkspaceLoading />}>
              <PublishHub currentProduct={currentProduct} />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>

      {/* Product Selection & Upload Modal */}
      <ErrorBoundary variant="panel" label="商品资料弹窗">
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          currentProduct={currentProduct}
          onSelectProduct={(p) => setCurrentProduct(p)}
          onSaveNewProduct={async (p) => {
            await storeProduct(p);
            setCurrentProduct(p);
          }}
          modelBinding={modelBinding}
          onRequireModel={requestModelConfig}
        />
      </ErrorBoundary>
    </div>
  );
}
