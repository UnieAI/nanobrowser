import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';

// Interface for a single provider configuration
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

// Interface for storing multiple LLM provider configurations
export interface LLMKeyRecord {
  providers: Record<string, ProviderConfig>; // Now only UnieAI is needed
}

export type LLMProviderStorage = BaseStorage<LLMKeyRecord> & {
  setProvider: (provider: string, config: ProviderConfig) => Promise<void>;
  getProvider: (provider: string) => Promise<ProviderConfig | undefined>;
  removeProvider: (provider: string) => Promise<void>;
  hasProvider: (provider: string) => Promise<boolean>;
  getConfiguredProviders: () => Promise<string[]>;
  getAllProviders: () => Promise<Record<string, ProviderConfig>>;
};

const storage = createStorage<LLMKeyRecord>(
  'llm-api-keys',
  { providers: {} as Record<string, ProviderConfig> },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const llmProviderStore: LLMProviderStorage = {
  ...storage,
  async setProvider(provider: string, config: ProviderConfig) {
    if (!provider) {
      throw new Error('Provider name cannot be empty');
    }
    if (!config.apiKey) {
      throw new Error('API key cannot be empty');
    }
    const current = (await storage.get()) || { providers: {} };
    await storage.set({
      providers: {
        ...current.providers,
        [provider]: config,
      },
    });
  },
  async getProvider(provider: string) {
    const data = (await storage.get()) || { providers: {} };
    return data.providers[provider];
  },
  async removeProvider(provider: string) {
    const current = (await storage.get()) || { providers: {} };
    const newProviders = { ...current.providers };
    delete newProviders[provider];
    await storage.set({ providers: newProviders });
  },
  async hasProvider(provider: string) {
    const data = (await storage.get()) || { providers: {} };
    return provider in data.providers;
  },
  async getConfiguredProviders() {
    const data = await storage.get();
    return Object.keys(data.providers);
  },
  async getAllProviders() {
    const data = await storage.get();
    return data.providers;
  },
};
