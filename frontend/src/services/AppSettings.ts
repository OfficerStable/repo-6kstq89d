import axios from 'axios';
import { url } from '../utils/Utils';

// Settings use JSON bodies, so they bypass the shared `api` instance (which
// rewrites payloads into credential-bearing FormData) and talk to the backend
// directly.
const CONFIGURED_MODELS_KEY = 'lgb.llms';

export interface ProviderField {
  name: string;
  secret: boolean;
}

export interface ProviderDef {
  id: string;
  key_prefix: string;
  fields: ProviderField[];
}

export interface LLMModelEntry {
  key?: string;
  provider: string;
  name: string;
  fields: Record<string, string>;
}

export interface AppSettings {
  llm_models: LLMModelEntry[];
  env: Record<string, string>;
}

export interface AppSettingsState {
  providers: ProviderDef[];
  allowed_env_keys: string[];
  secret_env_keys: string[];
  settings: AppSettings;
  configured_models: string[];
}

interface ApiResponse<T> {
  status: string;
  data?: T;
  message?: string;
  error?: string;
}

export const getAppSettings = async (): Promise<AppSettingsState> => {
  const response = await axios.get<ApiResponse<AppSettingsState>>(`${url()}/app_settings`);
  if (response.data.status !== 'Success' || !response.data.data) {
    throw new Error(response.data.error || response.data.message || 'Failed to load settings');
  }
  return response.data.data;
};

export const saveAppSettings = async (
  payload: AppSettings
): Promise<{ settings: AppSettings; configured_models: string[] }> => {
  const response = await axios.post<ApiResponse<{ settings: AppSettings; configured_models: string[] }>>(
    `${url()}/app_settings`,
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (response.data.status !== 'Success' || !response.data.data) {
    throw new Error(response.data.error || response.data.message || 'Failed to save settings');
  }
  return response.data.data;
};

// Persist the configured model keys so the LLM dropdown (utils/Constants.ts)
// reflects the user's configuration after a reload.
export const persistConfiguredModels = (models: string[]): void => {
  try {
    if (models && models.length) {
      localStorage.setItem(CONFIGURED_MODELS_KEY, JSON.stringify(models));
    } else {
      localStorage.removeItem(CONFIGURED_MODELS_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
};
