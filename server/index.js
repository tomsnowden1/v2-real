import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));

// ─── Cost Cap ────────────────────────────────────────────────────────────────
const MAX_DAILY_SPEND_USD = parseFloat(process.env.MAX_DAILY_SPEND_USD ?? '2');

let dailySpendUsd = 0;
let lastReset = new Date().toDateString();

function checkAndTrackSpend(estimatedCost) {
    const today = new Date().toDateString();
    if (today !== lastReset) {
        dailySpendUsd = 0;
        lastReset = today;
    }
    if (dailySpendUsd + estimatedCost > MAX_DAILY_SPEND_USD) return false;
    dailySpendUsd += estimatedCost;
    return true;
}

const COST_PER_TOKEN = {
    'gpt-4o': { prompt: 2.50 / 1_000_000, completion: 10.00 / 1_000_000 },
    'gpt-4o-mini': { prompt: 0.15 / 1_000_000, completion: 0.60 / 1_000_000 },
};

function estimateCost(model, promptTokens, completionTokens) {
    const rates = COST_PER_TOKEN[model] ?? COST_PER_TOKEN['gpt-4o-mini'];
    return (promptTokens * rates.prompt) + (completionTokens * rates.completion);
}

// ─── Proxy Route ─────────────────────────────────────────────────────────────
// The OpenAI JS SDK sends to: {baseURL}/chat/completions
// We set baseURL = "/api/openai/v1" in the frontend, so this handles:
//   POST /api/openai/v1/chat/completions
app.post('/api/openai/v1/chat/completions', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server is not configured with an OpenAI API key.' });
    }

    const model = req.body.model ?? 'gpt-4o-mini';
    const preFlight = estimateCost(model, 2000, 500);
    if (!checkAndTrackSpend(preFlight)) {
        return res.status(429).json({
            error: `Daily AI budget of $${MAX_DAILY_SPEND_USD.toFixed(2)} reached. Try again tomorrow.`
        });
    }

    try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(req.body),
        });

        const data = await openaiRes.json();

        // Refine cost tracking with actual usage
        if (data.usage) {
            const actual = estimateCost(model, data.usage.prompt_tokens, data.usage.completion_tokens);
            dailySpendUsd = Math.max(0, dailySpendUsd - preFlight) + actual;
        }

        return res.status(openaiRes.status).json(data);
    } catch (err) {
        console.error('[proxy] OpenAI request failed:', err);
        return res.status(502).json({ error: 'Failed to reach OpenAI API.' });
    }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, dailySpendUsd: dailySpendUsd.toFixed(4) }));

// ─── Serve Vite build ─────────────────────────────────────────────────────────
const distPath = join(__dirname, '..', 'dist');

// Hashed assets (e.g. /assets/index-abc123.js) → cache forever
app.use('/assets', express.static(join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
}));

// Everything else (non-hashed files like favicon, manifest, etc.)
app.use(express.static(distPath, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        // Never cache index.html — it's the entry point that references hashed assets
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    },
}));

// SPA fallback — all unmatched routes serve index.html (also no-cache)
app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(join(distPath, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '8080', 10);
createServer(app).listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
    console.log(`[server] Daily spend cap: $${MAX_DAILY_SPEND_USD}`);
    console.log(`[server] OpenAI key configured: ${!!process.env.OPENAI_API_KEY}`);
});
