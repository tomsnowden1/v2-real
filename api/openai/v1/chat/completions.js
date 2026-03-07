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
    // 1. Method validation
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Origin validation (development-aware)
    const referer = req.headers.referer || '';
    const isLocalhost = referer.startsWith('http://localhost:') || referer.startsWith('http://127.0.0.1:');
    const isProduction = !isLocalhost && (
        referer.startsWith('https://ironai-workout.vercel.app') ||
        referer.startsWith('https://ironai.vercel.app')
    );

    if (!isLocalhost && !isProduction) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server is not configured with an OpenAI API key.' });
    }

    const body = req.body;

    // 3. Request body validation
    if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    // 4. Model whitelist
    const allowedModels = ['gpt-4o-mini', 'gpt-4o'];
    if (!allowedModels.includes(body.model)) {
        return res.status(400).json({
            error: `Model '${body.model}' not allowed. Allowed models: ${allowedModels.join(', ')}`
        });
    }

    // 5. Messages validation
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    // 6. Token limit cap
    const maxTokens = 4000;
    if (body.max_tokens && body.max_tokens > maxTokens) {
        return res.status(400).json({
            error: `max_tokens cannot exceed ${maxTokens}`
        });
    }

    // 7. Sanitize request — only pass allowed fields to OpenAI
    const sanitizedBody = {
        model: body.model,
        messages: body.messages,
        temperature: body.temperature !== undefined ? Math.min(Math.max(body.temperature, 0), 2) : 0.7,
        top_p: body.top_p !== undefined ? Math.min(Math.max(body.top_p, 0), 1) : 1,
    };

    // Only include max_tokens if provided
    if (body.max_tokens) {
        sanitizedBody.max_tokens = body.max_tokens;
    }

    try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(sanitizedBody),
        });

        const data = await openaiRes.json();
        return res.status(openaiRes.status).json(data);
    } catch (err) {
        console.error('[proxy] OpenAI request failed:', err);
        return res.status(502).json({ error: 'Failed to reach OpenAI API.' });
    }
}
