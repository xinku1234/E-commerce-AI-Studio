import { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomEndpointConfig } from '../types';
import {
  DEFAULT_IMAGE_ENDPOINT_CONFIG,
  DEFAULT_PROMPT_ENDPOINT_CONFIG,
  readStoredEndpointConfig
} from '../utils/modelConfig';

export const CUSTOM_PROMPT_MODEL_ID = 'custom-prompt-model';
export const CUSTOM_IMAGE_ENGINE_ID = 'custom-image-engine';

export interface ModelRequestFields {
  customEndpointUrl?: string;
  customApiKey?: string;
}

export interface ModelBinding {
  healthResolved: boolean;
  modelRequired: boolean;
  serverModelReady: boolean;
  promptModelReady: boolean;
  imageModelReady: boolean;
  modelReady: boolean;

  selectedPromptModel: string;
  setSelectedPromptModel: (modelId: string) => void;
  selectedImageModel: string;
  setSelectedImageModel: (modelId: string) => void;

  customPromptConfig: CustomEndpointConfig;
  setCustomPromptConfig: (updater: any) => void;
  customImageConfig: CustomEndpointConfig;
  setCustomImageConfig: (updater: any) => void;

  denoisingStrength: number;
  setDenoisingStrength: (value: number) => void;

  /** Model name plus custom endpoint fields for any prompt/analysis request. */
  promptModelRequest: { modelName: string } & ModelRequestFields;
  /** Model name plus custom endpoint fields for any image generation request. */
  imageModelRequest: { modelName: string } & ModelRequestFields;

  /** Called when the server rejects a request with MODEL_REQUIRED. */
  markBindingRejected: () => void;
}

/**
 * Single source of truth for the model binding. Every workspace that calls an
 * AI endpoint reads from here, so the prompt/analysis model configured once in
 * the model dialog applies to the hero studio and the product dialog alike.
 */
export function useModelBinding(): ModelBinding {
  const [healthResolved, setHealthResolved] = useState(false);
  const [modelRequired, setModelRequired] = useState(true);
  const [serverModelReady, setServerModelReady] = useState(false);

  const [selectedPromptModel, setSelectedPromptModel] = useState<string>(
    () => localStorage.getItem('SELECTED_PROMPT_MODEL') || 'gemini-3.7-flash'
  );
  const [selectedImageModel, setSelectedImageModel] = useState<string>(
    () => localStorage.getItem('SELECTED_IMAGE_MODEL') || 'gemini-3.1-flash-image'
  );
  const [customPromptConfig, setCustomPromptConfig] = useState<CustomEndpointConfig>(
    () => readStoredEndpointConfig('CUSTOM_PROMPT_CONFIG', DEFAULT_PROMPT_ENDPOINT_CONFIG)
  );
  const [customImageConfig, setCustomImageConfig] = useState<CustomEndpointConfig>(
    () => readStoredEndpointConfig('CUSTOM_IMAGE_CONFIG', DEFAULT_IMAGE_ENDPOINT_CONFIG)
  );
  const [denoisingStrength, setDenoisingStrength] = useState<number>(0.65);

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then(response => response.json())
      .then(data => {
        if (!active) return;
        setModelRequired(data.modelRequired !== false);
        // Only a configured server-side key unlocks the built-in presets;
        // custom endpoints unlock separately after their own connection test.
        setServerModelReady(Boolean(data.ai?.gemini?.configured));
      })
      .catch(() => {
        if (!active) return;
        setModelRequired(true);
        setServerModelReady(false);
      })
      .finally(() => {
        if (active) setHealthResolved(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('SELECTED_PROMPT_MODEL', selectedPromptModel);
  }, [selectedPromptModel]);

  useEffect(() => {
    localStorage.setItem('SELECTED_IMAGE_MODEL', selectedImageModel);
  }, [selectedImageModel]);

  useEffect(() => {
    const { apiKey: _apiKey, ...safeConfig } = customPromptConfig;
    localStorage.setItem('CUSTOM_PROMPT_CONFIG', JSON.stringify(safeConfig));
  }, [customPromptConfig]);

  useEffect(() => {
    const { apiKey: _apiKey, ...safeConfig } = customImageConfig;
    localStorage.setItem('CUSTOM_IMAGE_CONFIG', JSON.stringify(safeConfig));
  }, [customImageConfig]);

  const usesCustomPrompt = selectedPromptModel === CUSTOM_PROMPT_MODEL_ID;
  const usesCustomImage = selectedImageModel === CUSTOM_IMAGE_ENGINE_ID;

  const promptModelReady = usesCustomPrompt
    ? customPromptConfig.testStatus === 'success'
    : serverModelReady;
  const imageModelReady = usesCustomImage
    ? customImageConfig.testStatus === 'success'
    : serverModelReady;
  const effectiveModelRequired = healthResolved && modelRequired;
  const modelReady = !effectiveModelRequired || (promptModelReady && imageModelReady);

  const promptModelRequest = useMemo(() => {
    if (!usesCustomPrompt) return { modelName: selectedPromptModel };
    const modelName = customPromptConfig.useManual
      ? (customPromptConfig.manualModel || 'qwen-vl-max')
      : (customPromptConfig.selectedModel || customPromptConfig.manualModel || 'qwen-vl-max');
    return {
      modelName,
      customEndpointUrl: customPromptConfig.endpointUrl,
      customApiKey: customPromptConfig.apiKey
    };
  }, [usesCustomPrompt, selectedPromptModel, customPromptConfig]);

  const imageModelRequest = useMemo(() => {
    if (!usesCustomImage) return { modelName: selectedImageModel };
    const modelName = customImageConfig.useManual
      ? (customImageConfig.manualModel || 'flux.1-schnell')
      : (customImageConfig.selectedModel || customImageConfig.manualModel || 'flux.1-schnell');
    return {
      modelName,
      customEndpointUrl: customImageConfig.endpointUrl,
      customApiKey: customImageConfig.apiKey
    };
  }, [usesCustomImage, selectedImageModel, customImageConfig]);

  // The server is authoritative: a MODEL_REQUIRED response means whatever the
  // UI believed about the binding is stale, so drop back to unverified.
  const markBindingRejected = useCallback(() => {
    setServerModelReady(false);
    const reset = (prev: CustomEndpointConfig) => (
      prev.testStatus === 'success'
        ? { ...prev, testStatus: 'idle' as const, testMessage: undefined }
        : prev
    );
    setCustomPromptConfig(reset);
    setCustomImageConfig(reset);
  }, []);

  return {
    healthResolved,
    modelRequired: effectiveModelRequired,
    serverModelReady,
    promptModelReady,
    imageModelReady,
    modelReady,
    selectedPromptModel,
    setSelectedPromptModel,
    selectedImageModel,
    setSelectedImageModel,
    customPromptConfig,
    setCustomPromptConfig,
    customImageConfig,
    setCustomImageConfig,
    denoisingStrength,
    setDenoisingStrength,
    promptModelRequest,
    imageModelRequest,
    markBindingRejected
  };
}
