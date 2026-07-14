// Vercel serverless function: POST /api/model
// Takes { description: string } and returns a proposed Data Vault model as JSON.
// Requires ANTHROPIC_API_KEY set as an environment variable in Vercel.

export default async function handler(req, res) {
  // CORS + method handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured in Vercel environment variables.' });
  }

  const { description } = req.body || {};
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return res.status(400).json({ error: 'Provide a scenario description (at least 10 characters).' });
  }
  if (description.length > 2000) {
    return res.status(400).json({ error: 'Description too long (max 2000 characters).' });
  }

  const systemPrompt = `You are a data modeling assistant. Given a plain-English business scenario, propose a Data Vault model.

Respond ONLY with valid JSON, no markdown fences, no preamble. Use exactly this shape:
{
  "scenarioName": "Short Title Case name",
  "hubs": ["Entity1", "Entity2"],
  "linkLabel": "LINK: <Name> — ties Entity1 + Entity2 + ... together",
  "columns": [
    { "id": "snake_case_column_name", "zone": "hub"|"hubsat"|"linksat", "hub": "Entity name or null for linksat", "why": "One-sentence justification written for someone learning Data Vault" }
  ],
  "sampleRows": [ { "col_name": "realistic sample value", ... }, ... ]
}

Rules:
- zone "hub" = business key columns (one per hub entity). hub field names the entity.
- zone "hubsat" = descriptive attribute of ONE entity. hub field names which entity.
- zone "linksat" = a measure/fact only meaningful for the combination of keys (amounts, quantities). hub field is null.
- Invent 10-16 realistic columns for the scenario, including one key column per hub.
- sampleRows: exactly 3 rows of realistic fake data covering every column.
- Column ids must be lowercase snake_case.
- "why" sentences should teach, referencing whether the value is stable/unique (hub), descriptive and changeable (hubsat), or combination-dependent (linksat).`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Scenario: ${description.trim()}` }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(502).json({ error: 'Anthropic API error', detail: errText.slice(0, 300) });
    }

    const data = await anthropicRes.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // Strip any accidental markdown fences and parse
    const clean = text.replace(/```json|```/g, '').trim();
    let model;
    try {
      model = JSON.parse(clean);
    } catch (e) {
      return res.status(502).json({ error: 'Model returned unparseable JSON', raw: clean.slice(0, 500) });
    }

    // Minimal validation
    if (!model.scenarioName || !Array.isArray(model.hubs) || !Array.isArray(model.columns)) {
      return res.status(502).json({ error: 'Model response missing required fields', raw: JSON.stringify(model).slice(0, 500) });
    }

    return res.status(200).json(model);
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err).slice(0, 300) });
  }
}
