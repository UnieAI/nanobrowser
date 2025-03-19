import { type ProviderConfig, AgentNameEnum } from '@extension/storage';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

// create a chat model based on the agent name, the model name and provider
export function createChatModel(
  agentName: string,
  providerName: string,
  providerConfig: ProviderConfig,
  modelName: string,
): BaseChatModel {
  const maxTokens = 2000;
  const maxCompletionTokens = 5000;
  let temperature = 0;
  let topP = 0.001;

  if (agentName === AgentNameEnum.Planner) {
    temperature = 0.02;
  }
  const args: any = {
    model: modelName,
    apiKey: providerConfig.apiKey,
    configuration: {},
  };
  if (providerConfig.baseUrl) {
    args.configuration = {
      baseURL: providerConfig.baseUrl,
    };
  }

  // O series models have different parameters
  if (modelName.startsWith('o')) {
    args.modelKwargs = {
      max_completion_tokens: maxCompletionTokens,
    };
  } else {
    args.topP = topP;
    args.temperature = temperature;
    args.maxTokens = maxTokens;
  }
  return new ChatOpenAI(args);
}
