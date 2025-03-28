import { useEffect, useState } from 'react';
import { Button } from '@extension/ui';
import {
  llmProviderStore,
  agentModelStore,
  AgentNameEnum,
  LLMProviderEnum,
  llmProviderModelNames,
} from '@extension/storage';

export const ModelSettings = () => {
  const unieAIBaseApiUrl = ''; // https://api2.unieai.com/v1

  const [apiKeys, setApiKeys] = useState<Record<LLMProviderEnum, { apiKey: string; baseUrl?: string }>>(
    {} as Record<LLMProviderEnum, { apiKey: string; baseUrl?: string }>,
  );
  const [modifiedProviders, setModifiedProviders] = useState<Set<LLMProviderEnum>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Record<AgentNameEnum, string>>({
    [AgentNameEnum.Navigator]: '',
    [AgentNameEnum.Planner]: '',
    [AgentNameEnum.Validator]: '',
  });

  // 載入 API 金鑰
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const providers = await llmProviderStore.getConfiguredProviders();
        const keys: Record<LLMProviderEnum, { apiKey: string; baseUrl?: string }> = {} as Record<
          LLMProviderEnum,
          { apiKey: string; baseUrl?: string }
        >;

        for (const provider of providers) {
          const config = await llmProviderStore.getProvider(provider);
          if (config) {
            keys[provider] = config;
          }
        }
        setApiKeys(keys);
      } catch (error) {
        console.error('Error loading API keys:', error);
        setApiKeys({} as Record<LLMProviderEnum, { apiKey: string; baseUrl?: string }>);
      }
    };
    loadApiKeys();
  }, []);

  // 取得可用模型
  const fetchUnieAIModels = async (baseUrl: string, apiKey: string) => {
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
      const apiKey = apiKeys[LLMProviderEnum.UnieAI]?.apiKey;
      const baseUrl = apiKeys[LLMProviderEnum.UnieAI]?.baseUrl || unieAIBaseApiUrl;
      if (apiKey && baseUrl != '') {
        const models = await fetchUnieAIModels(baseUrl, apiKey);

        // 讀取 localStorage 中的選擇模型
        const PlannerModel: string = localStorage.getItem(`${AgentNameEnum.Planner}_selectedModel`) || '';
        const NavigatorModel: string = localStorage.getItem(`${AgentNameEnum.Navigator}_selectedModel`) || '';
        const ValidatorModel: string = localStorage.getItem(`${AgentNameEnum.Validator}_selectedModel`) || '';

        // 初始化 updatedModels 並設定初始值為空字串
        const updatedModels: Record<AgentNameEnum, string> = {
          [AgentNameEnum.Planner]: '',
          [AgentNameEnum.Navigator]: '',
          [AgentNameEnum.Validator]: '',
        };

        // 檢查每個代理的選擇模型是否存在於 API 返回的模型列表中
        if (models.includes(PlannerModel)) {
          updatedModels[AgentNameEnum.Planner] = PlannerModel;
          setSelectedModels(prev => ({
            ...prev,
            [AgentNameEnum.Planner]: PlannerModel,
          }));
        } else {
          localStorage.removeItem(`${AgentNameEnum.Planner}_selectedModel`); // 如果無效則移除
        }

        if (models.includes(NavigatorModel)) {
          updatedModels[AgentNameEnum.Navigator] = NavigatorModel;
          setSelectedModels(prev => ({
            ...prev,
            [AgentNameEnum.Navigator]: NavigatorModel,
          }));
        } else {
          localStorage.removeItem(`${AgentNameEnum.Navigator}_selectedModel`); // 如果無效則移除
        }

        if (models.includes(ValidatorModel)) {
          updatedModels[AgentNameEnum.Validator] = ValidatorModel;
          setSelectedModels(prev => ({
            ...prev,
            [AgentNameEnum.Validator]: ValidatorModel,
          }));
        } else {
          localStorage.removeItem(`${AgentNameEnum.Validator}_selectedModel`); // 如果無效則移除
        }

        // 更新 selectedModels
        setSelectedModels(prev => ({
          ...prev,
          ...updatedModels,
        }));

        // 更新可用模型列表
        llmProviderModelNames[LLMProviderEnum.UnieAI] = models;
      }
    };

    loadModels();
  }, [apiKeys, modifiedProviders]); // Add both `apiKeys` and `modifiedProviders` as dependencies

  const handleApiKeyChange = (provider: LLMProviderEnum, apiKey: string, baseUrl?: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));
    setApiKeys(prev => ({
      ...prev,
      [provider]: {
        apiKey: apiKey.trim(),
        baseUrl: baseUrl !== undefined ? baseUrl.trim() : prev[provider]?.baseUrl,
      },
    }));
  };

  const handleSave = async (provider: LLMProviderEnum) => {
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

  const handleDelete = async (provider: LLMProviderEnum) => {
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

  const getButtonProps = (provider: LLMProviderEnum) => {
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

  const getAvailableModels = () => {
    const models: string[] = [];
    Object.entries(apiKeys).forEach(([provider, config]) => {
      if (config.apiKey) {
        models.push(...(llmProviderModelNames[provider as LLMProviderEnum] || []));
      }
    });
    return models.length ? models : [''];
  };

  const handleModelChange = async (agentName: AgentNameEnum, model: string) => {
    setSelectedModels(prev => ({
      ...prev,
      [agentName]: model,
    }));

    try {
      if (model) {
        // Determine provider from model name
        let provider: LLMProviderEnum | undefined;
        for (const [providerKey, models] of Object.entries(llmProviderModelNames)) {
          if (models.includes(model)) {
            provider = providerKey as LLMProviderEnum;
            break;
          }
        }

        // Save to localStorage
        localStorage.setItem(`${agentName}_selectedModel`, model);

        if (provider) {
          await agentModelStore.setAgentModel(agentName, {
            provider,
            modelName: model,
          });
        }
      } else {
        // Reset storage if no model is selected
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
        disabled={getAvailableModels().length <= 1}
        value={selectedModels[agentName] || ''}
        onChange={e => handleModelChange(agentName, e.target.value)}>
        <option key="default" value="">
          Choose model
        </option>
        {getAvailableModels().map(model => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100 text-left">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 text-left">API Keys</h2>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-700">UnieAI</h3>
              <Button
                {...getButtonProps(LLMProviderEnum.UnieAI)}
                size="sm"
                onClick={() =>
                  apiKeys[LLMProviderEnum.UnieAI]?.apiKey && !modifiedProviders.has(LLMProviderEnum.UnieAI)
                    ? handleDelete(LLMProviderEnum.UnieAI)
                    : handleSave(LLMProviderEnum.UnieAI)
                }
              />
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Custom Base URL (Optional)"
                value={apiKeys[LLMProviderEnum.UnieAI]?.baseUrl || unieAIBaseApiUrl}
                onChange={e =>
                  handleApiKeyChange(
                    LLMProviderEnum.UnieAI,
                    apiKeys[LLMProviderEnum.UnieAI]?.apiKey || '',
                    e.target.value,
                  )
                }
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <input
                type="password"
                placeholder="UnieAI API key"
                value={apiKeys[LLMProviderEnum.UnieAI]?.apiKey || ''}
                onChange={e => handleApiKeyChange(LLMProviderEnum.UnieAI, e.target.value)}
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>

          {/* <div className="border-t border-gray-200"></div> */}

          {/* Anthropic Section space-y-4 */}
          <div className="h-0 w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-700">Anthropic</h3>
              <Button
                {...getButtonProps(LLMProviderEnum.Anthropic)}
                size="sm"
                onClick={() =>
                  apiKeys[LLMProviderEnum.Anthropic]?.apiKey && !modifiedProviders.has(LLMProviderEnum.Anthropic)
                    ? handleDelete(LLMProviderEnum.Anthropic)
                    : handleSave(LLMProviderEnum.Anthropic)
                }
              />
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Anthropic API key"
                value={apiKeys[LLMProviderEnum.Anthropic]?.apiKey || ''}
                onChange={e => handleApiKeyChange(LLMProviderEnum.Anthropic, e.target.value)}
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>

          {/* <div className="border-t border-gray-200" /> */}

          {/* Gemini Section space-y-4 */}
          <div className="h-0 w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-700">Gemini</h3>
              <Button
                {...getButtonProps(LLMProviderEnum.Gemini)}
                size="sm"
                onClick={() =>
                  apiKeys[LLMProviderEnum.Gemini]?.apiKey && !modifiedProviders.has(LLMProviderEnum.Gemini)
                    ? handleDelete(LLMProviderEnum.Gemini)
                    : handleSave(LLMProviderEnum.Gemini)
                }
              />
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Gemini API key"
                value={apiKeys[LLMProviderEnum.Gemini]?.apiKey || ''}
                onChange={e => handleApiKeyChange(LLMProviderEnum.Gemini, e.target.value)}
                className="w-full p-2 rounded-md bg-gray-50 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Updated Agent Models Section */}
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
