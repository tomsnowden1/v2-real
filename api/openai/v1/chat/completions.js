// Vercel serverless function — proxies OpenAI requests so the API key
// stays server-side and is never sent to the browser.
//
// The frontend OpenAI SDK sends POST requests to /api/openai/v1/chat/completions
// (configured via VITE_AI_PROXY_URL in .env.production).
//
// Cost cap note: The Express server (server/index.js) tracks daily spend
// in memory, which doesn't work in serverless. Use OpenAI's own usage
// limits (platform.openai.com → Settings → Limits) instead.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server is not configured with an OpenAI API key.' });
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
        return res.status(openaiRes.status).json(data);
    } catch (err) {
        console.error('[proxy] OpenAI request failed:', err);
        return res.status(502).json({ error: 'Failed to reach OpenAI API.' });
    }
}
