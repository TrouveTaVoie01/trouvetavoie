export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.length > 10000) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Try models in order: cheapest first
  const models = ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-20241022'];

  for (const model of models) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }

      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || '';

      // If model not found, try next model
      if (response.status === 400 || response.status === 404 || errMsg.includes('model')) {
        console.log(`Model ${model} not available, trying next...`);
        continue;
      }

      // For other errors (credits, auth), return immediately
      return res.status(response.status).json({
        error: errMsg || `API error (${response.status})`
      });

    } catch (err) {
      console.error(`Error with model ${model}:`, err);
      continue;
    }
  }

  return res.status(500).json({ error: 'Aucun modèle disponible. Vérifie tes crédits sur console.anthropic.com' });
}
