import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIProvider } from '../hooks/useAIProvider';
import { PROVIDERS, PROVIDER_MODELS } from '../lib/ai';
import { Key, BrainCircuit, CreditCard, ExternalLink, ActivitySquare, Save, ArrowLeft } from 'lucide-react';
import './AISettings.css';

export default function AISettings() {
    const navigate = useNavigate();
    const { config, updateConfig, isLoaded } = useAIProvider();

    // Local state for the form so we don't save on every keystroke
    const [localKey, setLocalKey] = useState(config.apiKey || '');
    const [localBudget, setLocalBudget] = useState(config.monthlyBudgetCap?.toString() || '');
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Derived values for live budget meter
    const currentUsd = config.currentUsageUsd || 0;
    const cap = config.monthlyBudgetCap ?? null;
    const usagePct = cap ? Math.min((currentUsd / cap) * 100, 100) : 0;
    const isBudgetExceeded = cap !== null && currentUsd >= cap;
    const isBudgetWarning = cap !== null && usagePct >= 80;

    useEffect(() => {
        if (isLoaded) {
            setLocalKey(config.apiKey || '');
            setLocalBudget(config.monthlyBudgetCap?.toString() || '');
        }
    }, [isLoaded, config.apiKey, config.monthlyBudgetCap]);

    if (!isLoaded) return null;

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();

        let parsedBudget: number | null = parseFloat(localBudget);
        if (isNaN(parsedBudget)) parsedBudget = null;

        updateConfig({
            apiKey: localKey.trim() || null,
            monthlyBudgetCap: parsedBudget
        });

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProviderId = e.target.value;
        updateConfig({ providerId: newProviderId });
        // Model will auto-update in the hook
    };

    const activeProvider = PROVIDERS[config.providerId];
    const availableModels = PROVIDER_MODELS[config.providerId] || [];

    return (
        <div className="page-content ai-settings-page">
            <header className="settings-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={24} />
                </button>
                <BrainCircuit size={24} className="header-icon" />
                <h1>AI Provider Settings</h1>
            </header>

            <form className="settings-form-container" onSubmit={handleSave}>

                {/* Provider Selection */}
                <section className="settings-section card">
                    <div className="section-title">
                        <ActivitySquare size={20} className="section-icon" />
                        <h2>Select Provider</h2>
                    </div>
                    <p className="section-desc">Choose the AI intelligence you want powering your IronAI Coach.</p>

                    <div className="input-group-col">
                        <label>AI Service</label>
                        <select
                            value={config.providerId}
                            onChange={handleProviderChange}
                            className="settings-select"
                        >
                            {Object.values(PROVIDERS).map(p => (
                                <option key={p.id} value={p.id} disabled={p.id !== 'openai'}>
                                    {p.name} {p.id !== 'openai' ? '(Coming Soon)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group-col">
                        <label>Language Model</label>
                        <select
                            value={config.selectedModel}
                            onChange={(e) => updateConfig({ selectedModel: e.target.value })}
                            className="settings-select"
                        >
                            {availableModels.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.name} {m.tags.length > 0 ? `(${m.tags.join(', ')})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </section>

                {/* API Key */}
                <section className="settings-section card">
                    <div className="section-title">
                        <Key size={20} className="section-icon" />
                        <h2>API Key / Authentication</h2>
                    </div>
                    <p className="section-desc">
                        Provide your own API key to connect directly to {activeProvider?.name}.
                        Your key is stored securely in your browser's local storage and is never sent to our servers.
                    </p>

                    <div className="input-group">
                        <Key size={18} className="input-icon-left" />
                        <input
                            type="password"
                            placeholder="Enter your API key..."
                            value={localKey}
                            onChange={(e) => setLocalKey(e.target.value)}
                            className="settings-input has-icon"
                        />
                    </div>

                    <div className="help-links">
                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="help-link">
                            <ExternalLink size={14} /> Get an OpenAI Key
                        </a>
                        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="help-link">
                            <ExternalLink size={14} /> Get a Claude Key
                        </a>
                    </div>

                    {/* Video Tutorial Embed */}
                    <div className="video-tutorial-container">
                        <p className="video-tutorial-label">📽️ Watch: How to get your API key</p>
                        <div className="video-embed-placeholder">
                            <iframe
                                src="https://www.youtube.com/embed/OB99E7Y1cMA?si=_9M-T9h14JLqg4Yp"
                                title="How to get your OpenAI API Key"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ width: '100%', aspectRatio: '16/9', borderRadius: '10px', border: 'none' }}
                            />
                        </div>
                    </div>
                </section>

                {/* Budget Guardrails */}
                <section className="settings-section card">
                    <div className="section-title">
                        <CreditCard size={20} className="section-icon" />
                        <h2>Budget Guardrails</h2>
                    </div>
                    <p className="section-desc">
                        Set a monthly limit to ensure you don't accidentally overspend on API usage.
                        (Note: App will warn you when approaching this limit based on estimated token counts).
                    </p>

                    <div className="input-group-col">
                        <label>Monthly Budget Cap (USD)</label>
                        <div className="budget-input-wrapper">
                            <span className="currency-symbol">$</span>
                            <input
                                type="number"
                                step="0.50"
                                min="0"
                                placeholder="5.00"
                                value={localBudget}
                                onChange={(e) => setLocalBudget(e.target.value)}
                                className="settings-input budget-input"
                            />
                        </div>
                    </div>

                    {/* Live usage meter */}
                    <div className="usage-meter-container">
                        <div className="usage-meter-header">
                            <span className="usage-label">Current Monthly Usage (Estimated)</span>
                            <span className={`usage-amount ${isBudgetExceeded ? 'exceeded' : isBudgetWarning ? 'warning' : ''}`}>
                                ${currentUsd.toFixed(4)} / {cap !== null ? `$${cap.toFixed(2)}` : '∞'}
                            </span>
                        </div>
                        <div className="usage-bar-bg">
                            <div
                                className={`usage-bar-fill ${isBudgetExceeded ? 'exceeded' : isBudgetWarning ? 'warning' : ''}`}
                                style={{ width: `${usagePct || 2}%` }}
                            />
                        </div>
                        {isBudgetExceeded && (
                            <p className="budget-exceeded-message">⚠️ Budget cap reached. AI features are paused until reset.</p>
                        )}
                        {!isBudgetExceeded && isBudgetWarning && (
                            <p className="budget-warning-message">You're approaching your monthly budget limit.</p>
                        )}
                        <button
                            type="button"
                            className="reset-usage-btn"
                            onClick={() => updateConfig({ currentUsageUsd: 0, lastUsageResetDate: Date.now() })}
                        >
                            Reset Usage Counter
                        </button>
                    </div>
                </section>

                {/* Save Button */}
                <div className="settings-actions">
                    <button type="submit" className={`save-btn ${saveSuccess ? 'success' : ''}`}>
                        {saveSuccess ? (
                            <>Saved Successfully!</>
                        ) : (
                            <><Save size={18} /> Save Settings</>
                        )}
                    </button>
                    {saveSuccess && <p className="save-hint">Changes applied immediately across the app.</p>}
                </div>

            </form>
        </div>
    );
}
