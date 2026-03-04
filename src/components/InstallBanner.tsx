import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import './InstallBanner.css';

// How long to wait before showing the banner again after dismissal
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STORAGE_KEY = 'ironai_install_dismissed_at';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Don't show if already installed (running in standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) return;

        // Check if dismissed recently
        const dismissedAt = localStorage.getItem(STORAGE_KEY);
        if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_TTL_MS) return;

        // iOS / Safari detection — they don't fire beforeinstallprompt
        const ua = navigator.userAgent;
        const iosDevice = /iphone|ipad|ipod/i.test(ua);
        const standalone = (navigator as any).standalone === true;

        if (iosDevice && !standalone) {
            setIsIOS(true);
            setVisible(true);
            return;
        }

        // Chrome/Edge: capture the install prompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
            setVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setVisible(false);
        }
        setInstallPrompt(null);
    };

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="install-banner" role="banner" aria-label="Install IronAI">
            <div className="install-banner-icon">
                <img src="/pwa-64x64.png" alt="" width={36} height={36} />
            </div>

            <div className="install-banner-body">
                <p className="install-banner-title">Install IronAI</p>
                {isIOS ? (
                    <p className="install-banner-desc">
                        Tap <span className="install-share-icon">⎋</span> then <strong>Add to Home Screen</strong>
                    </p>
                ) : (
                    <p className="install-banner-desc">Get the full app experience — works offline</p>
                )}
            </div>

            {!isIOS && (
                <button
                    className="install-banner-btn"
                    onClick={handleInstall}
                    aria-label="Install app"
                >
                    <Download size={15} />
                    Install
                </button>
            )}

            <button
                className="install-banner-close"
                onClick={handleDismiss}
                aria-label="Dismiss install banner"
            >
                <X size={16} />
            </button>
        </div>
    );
}
