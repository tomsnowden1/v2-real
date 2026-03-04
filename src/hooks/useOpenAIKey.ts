import { useState, useEffect } from 'react';

const OPENAI_KEY_STORAGE = 'ironai_openai_key';

export function useOpenAIKey() {
    const [apiKey, setApiKeyState] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const envKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (envKey) {
            setApiKeyState(envKey);
            setIsLoaded(true);
            return;
        }

        const stored = localStorage.getItem(OPENAI_KEY_STORAGE);
        if (stored) {
            setApiKeyState(stored);
        }
        setIsLoaded(true);
    }, []);

    const setApiKey = (key: string | null) => {
        if (key) {
            localStorage.setItem(OPENAI_KEY_STORAGE, key);
        } else {
            localStorage.removeItem(OPENAI_KEY_STORAGE);
        }
        setApiKeyState(key);
    };

    return { apiKey, setApiKey, isLoaded };
}
