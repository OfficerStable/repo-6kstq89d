import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, Button, Select, TextInput, Banner, Flex, Typography } from '@neo4j-ndl/react';
import { TrashIconOutline } from '@neo4j-ndl/react/icons';
import { tr } from '../../../i18n';
import { IconButtonWithToolTip } from '../../UI/IconButtonToolTip';
import {
  getAppSettings,
  saveAppSettings,
  persistConfiguredModels,
  AppSettingsState,
  LLMModelEntry,
} from '../../../services/AppSettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'llm' | 'system';

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [state, setState] = useState<AppSettingsState | null>(null);
  const [models, setModels] = useState<LLMModelEntry[]>([]);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<Tab>('llm');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'danger' | 'success' | 'info'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getAppSettings();
      setState(data);
      setModels(data.settings.llm_models.map((m) => ({ ...m, fields: { ...m.fields } })));
      setEnv({ ...data.settings.env });
    } catch {
      setMessage({ type: 'danger', text: tr('settings.backendUnavailable') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setActiveTab('llm');
      load();
    }
  }, [open, load]);

  const providerOptions = useMemo(
    () => (state?.providers ?? []).map((p) => ({ label: tr(`settings.providerNames.${p.id}`), value: p.id })),
    [state]
  );

  const fieldsForProvider = useCallback(
    (providerId: string) => state?.providers.find((p) => p.id === providerId)?.fields ?? [],
    [state]
  );

  const addModel = () => {
    const defaultProvider = state?.providers[0]?.id ?? 'openai';
    setModels((prev) => [...prev, { provider: defaultProvider, name: '', fields: {} }]);
  };

  const removeModel = (idx: number) => {
    setModels((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateProvider = (idx: number, providerId: string) => {
    setModels((prev) => prev.map((m, i) => (i === idx ? { ...m, provider: providerId, fields: {} } : m)));
  };

  const updateName = (idx: number, name: string) => {
    setModels((prev) => prev.map((m, i) => (i === idx ? { ...m, name } : m)));
  };

  const updateField = (idx: number, fieldName: string, value: string) => {
    setModels((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, fields: { ...m.fields, [fieldName]: value } } : m))
    );
  };

  const updateEnv = (key: string, value: string) => {
    setEnv((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    if (models.some((m) => !m.name.trim())) {
      setActiveTab('llm');
      setMessage({ type: 'danger', text: tr('settings.requiredName') });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveAppSettings({ llm_models: models, env });
      persistConfiguredModels(result.configured_models);
      const selected = localStorage.getItem('selectedModel');
      if (result.configured_models.length && (!selected || !result.configured_models.includes(selected))) {
        localStorage.setItem('selectedModel', result.configured_models[0]);
      }
      setMessage({ type: 'success', text: tr('settings.saved') });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      const detail = e instanceof Error ? e.message : '';
      setMessage({ type: 'danger', text: `${tr('settings.saveFailed')}${detail ? `: ${detail}` : ''}` });
      setSaving(false);
    }
  };

  const secretEnv = useMemo(() => new Set(state?.secret_env_keys ?? []), [state]);

  return (
    <Dialog
      size='large'
      isOpen={open}
      onClose={onClose}
      htmlAttributes={{ 'aria-labelledby': 'settings-dialog-title' }}
    >
      <Dialog.Header htmlAttributes={{ id: 'settings-dialog-title' }}>{tr('settings.title')}</Dialog.Header>
      <Dialog.Content className='n-flex n-flex-col n-gap-token-4'>
        <Flex flexDirection='row' gap='2'>
          <Button fill={activeTab === 'llm' ? 'filled' : 'outlined'} onClick={() => setActiveTab('llm')}>
            {tr('settings.tabLLM')}
          </Button>
          <Button fill={activeTab === 'system' ? 'filled' : 'outlined'} onClick={() => setActiveTab('system')}>
            {tr('settings.tabSystem')}
          </Button>
        </Flex>

        {message && (
          <Banner
            name='Settings'
            type={message.type}
            description={message.text}
            usage='inline'
            isCloseable
            onClose={() => setMessage(null)}
          />
        )}

        {loading ? (
          <Typography variant='body-medium'>…</Typography>
        ) : activeTab === 'llm' ? (
          <div className='n-flex n-flex-col n-gap-token-4' style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            <Typography variant='body-medium'>{tr('settings.llmIntro')}</Typography>
            {models.length === 0 && <Typography variant='body-medium'>{tr('settings.noModels')}</Typography>}
            {models.map((model, idx) => {
              const fields = fieldsForProvider(model.provider);
              return (
                <div
                  key={idx}
                  className='n-flex n-flex-col n-gap-token-3'
                  style={{
                    border: '1px solid rgb(var(--theme-palette-neutral-border-weak))',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <Flex flexDirection='row' justifyContent='space-between' alignItems='flex-end' gap='3'>
                    <div className='w-1/2'>
                      <Select
                        label={tr('settings.provider')}
                        type='select'
                        size='medium'
                        selectProps={{
                          options: providerOptions,
                          value: providerOptions.find((o) => o.value === model.provider) ?? null,
                          onChange: (nv) => nv && updateProvider(idx, nv.value),
                        }}
                        isFluid
                        htmlAttributes={{ id: `provider-${idx}` }}
                      />
                    </div>
                    <div className='w-1/2'>
                      <TextInput
                        label={tr('settings.displayName')}
                        value={model.name}
                        isFluid
                        isRequired
                        onChange={(e) => updateName(idx, e.target.value)}
                        htmlAttributes={{ id: `name-${idx}`, placeholder: 'GPT-4o' }}
                      />
                    </div>
                    <IconButtonWithToolTip
                      label={tr('settings.remove')}
                      text={tr('settings.remove')}
                      onClick={() => removeModel(idx)}
                      size='medium'
                      clean
                    >
                      <TrashIconOutline />
                    </IconButtonWithToolTip>
                  </Flex>
                  {model.provider === 'gemini' && (
                    <Banner name='gemini' type='info' description={tr('settings.geminiHint')} usage='inline' />
                  )}
                  <div className='n-flex n-flex-row n-flex-wrap n-gap-token-3'>
                    {fields.map((field) => (
                      <div key={field.name} className='w-[48%]'>
                        <TextInput
                          label={tr(`settings.fieldNames.${field.name}`)}
                          value={model.fields[field.name] ?? ''}
                          isFluid
                          onChange={(e) => updateField(idx, field.name, e.target.value)}
                          htmlAttributes={{
                            id: `field-${idx}-${field.name}`,
                            type: field.secret ? 'password' : 'text',
                            autoComplete: 'off',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <Flex flexDirection='row'>
              <Button fill='outlined' onClick={addModel}>
                {tr('settings.addModel')}
              </Button>
            </Flex>
          </div>
        ) : (
          <div className='n-flex n-flex-col n-gap-token-3' style={{ maxHeight: '55vh', overflowY: 'auto' }}>
            <Typography variant='body-medium'>{tr('settings.systemIntro')}</Typography>
            <div className='n-flex n-flex-row n-flex-wrap n-gap-token-3'>
              {(state?.allowed_env_keys ?? []).map((key) => (
                <div key={key} className='w-[48%]'>
                  <TextInput
                    label={tr(`settings.envNames.${key}`)}
                    value={env[key] ?? ''}
                    isFluid
                    onChange={(e) => updateEnv(key, e.target.value)}
                    htmlAttributes={{
                      id: `env-${key}`,
                      type: secretEnv.has(key) ? 'password' : 'text',
                      autoComplete: 'off',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <Flex flexDirection='row' justifyContent='flex-end' gap='3'>
          <Button fill='outlined' onClick={onClose} isDisabled={saving}>
            {tr('settings.cancel')}
          </Button>
          <Button onClick={onSave} isLoading={saving} isDisabled={loading || saving}>
            {saving ? tr('settings.saving') : tr('settings.save')}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog>
  );
};

export default SettingsModal;
