/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { ProductModal } from './components/ProductModal';
import { HeroStudio } from './components/HeroImageStudio/HeroStudio';
import { DetailPageStudio } from './components/DetailPageStudio/DetailPageStudio';
import { BatchStudio } from './components/BatchGenerator/BatchStudio';
import { PublishHub } from './components/PublishHub/PublishHub';
import { ProductItem, BatchTask } from './types';
import { SAMPLE_PRODUCTS } from './data/presets';

export default function App() {
  const [activeTab, setActiveTab] = useState<'hero' | 'detail' | 'batch' | 'publish'>('hero');
  const [currentProduct, setCurrentProduct] = useState<ProductItem>(SAMPLE_PRODUCTS[0]);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  
  // Initial batch tasks populated for instantaneous inspection
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>([
    {
      id: 'task_init_1',
      productId: SAMPLE_PRODUCTS[0].id,
      productName: SAMPLE_PRODUCTS[0].name,
      productImage: SAMPLE_PRODUCTS[0].imageUrl,
      platform: 'taobao',
      aspectRatio: '1:1',
      styleId: 'scene_studio_minimal',
      badgeId: 'badge_billion_subsidy',
      status: 'completed',
      resultImageUrl: SAMPLE_PRODUCTS[0].imageUrl,
      progress: 100,
      createdAt: '10:00:12',
      complianceScore: 99
    },
    {
      id: 'task_init_2',
      productId: SAMPLE_PRODUCTS[0].id,
      productName: SAMPLE_PRODUCTS[0].name,
      productImage: SAMPLE_PRODUCTS[0].imageUrl,
      platform: 'jd',
      aspectRatio: '1:1',
      styleId: 'scene_studio_minimal',
      badgeId: 'badge_official_auth',
      status: 'completed',
      resultImageUrl: SAMPLE_PRODUCTS[0].imageUrl,
      progress: 100,
      createdAt: '10:00:15',
      complianceScore: 100
    },
    {
      id: 'task_init_3',
      productId: SAMPLE_PRODUCTS[0].id,
      productName: SAMPLE_PRODUCTS[0].name,
      productImage: SAMPLE_PRODUCTS[0].imageUrl,
      platform: 'douyin',
      aspectRatio: '3:4',
      styleId: 'scene_cyber_tech',
      status: 'completed',
      resultImageUrl: SAMPLE_PRODUCTS[0].imageUrl,
      progress: 100,
      createdAt: '10:00:18',
      complianceScore: 98
    },
    {
      id: 'task_init_4',
      productId: SAMPLE_PRODUCTS[0].id,
      productName: SAMPLE_PRODUCTS[0].name,
      productImage: SAMPLE_PRODUCTS[0].imageUrl,
      platform: 'amazon',
      aspectRatio: '1:1',
      styleId: 'scene_pure_white_compliance',
      status: 'completed',
      resultImageUrl: SAMPLE_PRODUCTS[0].imageUrl,
      progress: 100,
      createdAt: '10:00:20',
      complianceScore: 100
    }
  ]);

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
      </main>

      {/* Product Selection & Upload Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        currentProduct={currentProduct}
        onSelectProduct={(p) => setCurrentProduct(p)}
        onSaveNewProduct={(p) => setCurrentProduct(p)}
      />
    </div>
  );
}
