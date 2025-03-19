import { useEffect, useState } from 'react';
import { Button } from '@extension/ui';
import { llmProviderStore, agentModelStore, AgentNameEnum } from '@extension/storage';

export const ModelSettings = () => {
  const unieAIBaseApiUrl = 'https://api2.unieai.com/v1';
  const [apiKeys, setApiKeys] = useState<Record<string, { apiKey: string; baseUrl?: string }>>({});
  const [modifiedProviders, setModifiedProviders] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Record<AgentNameEnum, string>>({
    [AgentNameEnum.Navigator]: '',
    [AgentNameEnum.Planner]: '',
    [AgentNameEnum.Validator]: '',
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]); // 用來儲存從 API 取得的模型

  // 載入 API 金鑰
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const providers = await llmProviderStore.getConfiguredProviders();
        const keys: Record<string, { apiKey: string; baseUrl?: string }> = {};

        for (const provider of providers) {
          const config = await llmProviderStore.getProvider(provider);
          if (config) {
            keys[provider] = config;
          }
        }
        setApiKeys(keys);
      } catch (error) {
        console.error('Error loading API keys:', error);
      }
    };
    loadApiKeys();
  }, []);

  // 取得可用模型
  const getAvailableModels = async (baseUrl: string, apiKey: string) => {
    try {
      const res = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${apiKey}`,
        },
      });

      if (!res.ok) {
        const errorBody = await res.json();
        return new Response(`error: ${res.statusText} - ${errorBody.detail || 'Unknown error'}`, {
          status: res.status,
        });
      }

      const data = await res.json();
      console.log(data);
      const modelIds = data?.data.map((model: any) => model.id) || []; // Extracting model ids
      return modelIds; // Return the array of model ids
    } catch (error) {
      console.error('Error fetching models from API:', error);
      return []; // 如果出錯返回空陣列
    }
  };

  // 當 API 金鑰變更時，重新載入模型
  useEffect(() => {
    const loadModels = async () => {
      const apiKey = apiKeys['unieai']?.apiKey;
      const baseUrl = apiKeys['unieai']?.baseUrl || unieAIBaseApiUrl;
      if (apiKey) {
        const models = await getAvailableModels(baseUrl, apiKey);
        setAvailableModels(models);
      }
    };

    loadModels();
  }, [apiKeys, modifiedProviders]); // Add both `apiKeys` and `modifiedProviders` as dependencies

  const handleApiKeyChange = (provider: string, apiKey: string, baseUrl?: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));
    setApiKeys(prev => ({
      ...prev,
      [provider]: {
        apiKey: apiKey.trim(),
        baseUrl: baseUrl !== undefined ? baseUrl.trim() : prev[provider]?.baseUrl,
      },
    }));
  };

  const handleSave = async (provider: string) => {
    try {
      await llmProviderStore.setProvider(provider, apiKeys[provider]);
      setModifiedProviders(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      await llmProviderStore.removeProvider(provider);
      setApiKeys(prev => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  const handleModelChange = async (agentName: AgentNameEnum, model: string) => {
    setSelectedModels(prev => ({
      ...prev,
      [agentName]: model,
    }));

    try {
      if (model) {
        await agentModelStore.setAgentModel(
          agentName,
          {
            modelName: model,
          },
          availableModels,
        );
      } else {
        await agentModelStore.resetAgentModel(agentName);
      }
    } catch (error) {
      console.error('Error saving agent model:', error);
    }
  };

  const renderModelSelect = (agentName: AgentNameEnum) => (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-medium text-gray-700">{agentName.charAt(0).toUpperCase() + agentName.slice(1)}</h3>
      </div>
      <select
        className="w-64 px-3 py-2 border rounded-md"
        disabled={availableModels.length <= 1}
        value={selectedModels[agentName] || ''}
        onChange={e => handleModelChange(agentName, e.target.value)}>
        <option key="default" value="">
          Choose model
        </option>
        {availableModels.map(model => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );

  // getButtonProps 定義
  const getButtonProps = (provider: string) => {
    const hasStoredKey = Boolean(apiKeys[provider]?.apiKey);
    const isModified = modifiedProviders.has(provider);
    const hasInput = Boolean(apiKeys[provider]?.apiKey?.trim());

    if (hasStoredKey && !isModified) {
      return {
        variant: 'danger' as const,
        children: 'Delete',
        disabled: false,
      };
    }

    return {
      variant: 'primary' as const,
      children: 'Save',
      disabled: !hasInput || !isModified,
    };
  };

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100 text-left">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 text-left">API Keys</h2>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-700">UnieAI</h3>
              <Button
                {...getButtonProps('unieai')}
                size="sm"
                onClick={() =>
                  apiKeys['unieai']?.apiKey && !modifiedProviders.has('unieai')
                    ? handleDelete('unieai')
                    : handleSave('unieai')
                }
              />
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="UnieAI API key"
                value={apiKeys['unieai']?.apiKey || ''}
                onChange={e => handleApiKeyChange('unieai', e.target.value)}
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <input
                type="text"
                placeholder="Custom Base URL (Optional)"
                value={apiKeys['unieai']?.baseUrl || unieAIBaseApiUrl}
                onChange={e => handleApiKeyChange('unieai', apiKeys['unieai']?.apiKey || '', e.target.value)}
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100 text-left">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 text-left">Model Selection</h2>
        <div className="space-y-4">
          {[AgentNameEnum.Planner, AgentNameEnum.Navigator, AgentNameEnum.Validator].map(agentName => (
            <div key={agentName}>{renderModelSelect(agentName)}</div>
          ))}
        </div>
      </div>
    </section>
  );
};
