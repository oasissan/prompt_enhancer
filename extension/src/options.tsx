import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { getStorageData, updateStorageData, StorageData } from './storage';
import './index.css';

interface ModelInfo {
  id: string;
  name: string;
  desc: string;
}

const PROVIDER_MODELS: Record<'gemini' | 'openai' | 'anthropic', ModelInfo[]> = {
  gemini: [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: 'Newest, ultra-fast agentic flagship (GA May 2026)' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', desc: 'Advanced reasoning, deep coding & planning' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', desc: 'Ultra-fast, cost-efficient scale (GA May 2026)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', desc: 'Legacy fast model' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'Legacy capable reasoning model' },
  ],
  openai: [
    { id: 'gpt-5.5-instant', name: 'GPT-5.5 Instant', desc: 'Newest ChatGPT default, ultra-low latency (May 2026)' },
    { id: 'gpt-5.5', name: 'GPT-5.5', desc: 'Premium reasoning and advanced planning flagship (GA 2025/2026)' },
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', desc: 'Agentic and programming optimized specialist' },
    { id: 'gpt-4o', name: 'GPT-4o', desc: 'Legacy flagship model' },
  ],
  anthropic: [
    { id: 'claude-opus-4.7', name: 'Claude 4.7 Opus', desc: 'State-of-the-art flagship reasoning (GA April 2026)' },
    { id: 'claude-sonnet-4.6', name: 'Claude 4.6 Sonnet', desc: 'High-speed premium agentic capability (Feb 2026)' },
    { id: 'claude-haiku-4.5', name: 'Claude 4.5 Haiku', desc: 'Fastest, low-cost micro model (Oct 2025)' },
  ],
};

const DEFAULT_MODELS: Record<'gemini' | 'openai' | 'anthropic', string> = {
  gemini: 'gemini-3.5-flash',
  openai: 'gpt-5.5-instant',
  anthropic: 'claude-opus-4.7',
};

const Options = () => {
  const [data, setData] = useState<StorageData | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getStorageData().then(setData);
  }, []);

  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px', animation: 'pulse 1.5s infinite' }}>✨</div>
          <div>Loading workspace environment...</div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    await updateStorageData(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleProviderChange = (provider: 'gemini' | 'openai' | 'anthropic') => {
    // Check if the current preferred model is compatible with the new provider
    const isCompatible = PROVIDER_MODELS[provider].some(m => m.id === data.preferredModel);
    
    setData({
      ...data,
      preferredProvider: provider,
      preferredModel: isCompatible ? data.preferredModel : DEFAULT_MODELS[provider],
    });
  };

  const activeProvider = data.preferredProvider || 'gemini';
  const availableModels = PROVIDER_MODELS[activeProvider];

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: 'inherit' }} className="animate-fade-in">
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <span className="text-gradient">AI Prompt Refinement</span>
          <span style={{ fontSize: '28px' }}>✨</span>
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>
          Configure elite models, provider priorities, and secure API gateways
        </p>
      </header>

      {/* Configuration Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        {/* Active Configuration Card */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚙️ Provider & Model Preferences
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>
                Active Prompt Engine
              </label>
              <select 
                value={activeProvider}
                onChange={(e) => handleProviderChange(e.target.value as 'gemini' | 'openai' | 'anthropic')}
                style={{ textTransform: 'capitalize' }}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI GPT</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>
                Preferred AI Model
              </label>
              <select 
                value={data.preferredModel}
                onChange={(e) => setData({ ...data, preferredModel: e.target.value })}
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Model Description Box */}
          <div style={{ marginTop: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '12px 16px' }}>
            <strong style={{ fontSize: '12px', color: '#8b5cf6', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Engine Capabilities
            </strong>
            <span style={{ fontSize: '13.5px', color: '#cbd5e1' }}>
              {availableModels.find(m => m.id === data.preferredModel)?.desc || 'No description available.'}
            </span>
          </div>
        </div>

        {/* Secure API Key Manager Card */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔒 Gateway Authentication
          </h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px 0' }}>
            Credentials are encrypted and stored 100% locally in your secure browser storage.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Gemini Key */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: 500 }}>Google Gemini API Key</label>
                <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'underline' }}>Get Gemini Key ↗</a>
              </div>
              <input 
                type="password" 
                value={data.apiKey}
                onChange={(e) => setData({ ...data, apiKey: e.target.value })}
                placeholder="AIzaSy..."
              />
            </div>

            {/* OpenAI Key */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: 500 }}>OpenAI API Key</label>
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'underline' }}>Get OpenAI Key ↗</a>
              </div>
              <input 
                type="password" 
                value={data.openaiApiKey || ''}
                onChange={(e) => setData({ ...data, openaiApiKey: e.target.value })}
                placeholder="sk-proj-..."
              />
            </div>

            {/* Anthropic Key */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: '#cbd5e1', fontSize: '14px', fontWeight: 500 }}>Anthropic Claude API Key</label>
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'underline' }}>Get Claude Key ↗</a>
              </div>
              <input 
                type="password" 
                value={data.anthropicApiKey || ''}
                onChange={(e) => setData({ ...data, anthropicApiKey: e.target.value })}
                placeholder="sk-ant-api03-..."
              />
            </div>
          </div>
        </div>
      </div>


      {/* Save Action Footer */}
      <footer style={{ marginTop: '30px', display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'flex-end' }}>
        {saved && (
          <span className="animate-fade-in" style={{ color: '#34d399', fontWeight: 500, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ✨ Settings committed to local storage!
          </span>
        )}
        <button 
          className="btn-primary" 
          onClick={handleSave}
        >
          Save Configuration
        </button>
      </footer>
    </div>
  );
};

const rootEl = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootEl);
root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);