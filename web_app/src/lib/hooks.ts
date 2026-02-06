import { useState, useEffect, useCallback } from 'react';
import { ChatConfig, DEFAULT_CONFIG } from '@/lib/chat-client';

const STORAGE_KEY = 'chat-config-v1';
const CONFIG_CHANGE_EVENT = 'chat-config-changed';

function loadConfigFromStorage(): ChatConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Auto-trim on load to fix any existing "dirty" data
      if (parsed.apiKey) parsed.apiKey = parsed.apiKey.trim();
      if (parsed.baseUrl) parsed.baseUrl = parsed.baseUrl.trim();
      if (parsed.ocrModel) parsed.ocrModel = parsed.ocrModel.trim();
      if (parsed.chatModel) parsed.chatModel = parsed.chatModel.trim();

      // Migrate from old single-model config
      if (parsed.model && !parsed.ocrModel && !parsed.chatModel) {
        parsed.ocrModel = DEFAULT_CONFIG.ocrModel;
        parsed.chatModel = parsed.model.trim();
        delete parsed.model;
      }

      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      console.error('Failed to parse chat config', e);
    }
  }
  return DEFAULT_CONFIG;
}

function saveConfigToStorage(config: ChatConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useChatConfig() {
  const [config, setConfig] = useState<ChatConfig>(() => loadConfigFromStorage());
  const [loaded, setLoaded] = useState(false);

  // Mark as loaded after initial render
  useEffect(() => {
    setLoaded(true);
  }, []);

  // Listen for config changes from other components (but not our own)
  useEffect(() => {
    const handleConfigChange = (e: Event) => {
      // Only handle events from other sources
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.source === 'self') return;

      setConfig(loadConfigFromStorage());
    };

    window.addEventListener(CONFIG_CHANGE_EVENT, handleConfigChange);
    return () => {
      window.removeEventListener(CONFIG_CHANGE_EVENT, handleConfigChange);
    };
  }, []);

  const updateConfig = useCallback((newConfig: Partial<ChatConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      // Auto-trim critical fields
      if (updated.apiKey) updated.apiKey = updated.apiKey.trim();
      if (updated.baseUrl) updated.baseUrl = updated.baseUrl.trim();
      if (updated.ocrModel) updated.ocrModel = updated.ocrModel.trim();
      if (updated.chatModel) updated.chatModel = updated.chatModel.trim();

      // Save synchronously before updating state
      saveConfigToStorage(updated);

      // Dispatch event with source marker to avoid self-triggering
      window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: { source: 'self' } }));

      return updated;
    });
  }, []);

  return { config, updateConfig, loaded };
}
