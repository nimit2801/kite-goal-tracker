const { Ollama } = require('ollama');

const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434' });

async function getOllamaSuggestions(holdings, goals) {
  // Use a model provided by env or default to qwen
  const modelName = process.env.OLLAMA_MODEL || 'qwen2.5:7b'; 

  const prompt = `
You are a financial advisor. Analyze stock holdings and suggest goal assignments.

HOLDINGS: ${JSON.stringify(holdings)}
GOALS: ${JSON.stringify(goals)}

Rules:
- Short-term goals (<2 years): stable stocks, ETFs
- Medium-term (2-5 years): mix of growth and stable
- Long-term (5+ years): high-growth stocks
- Diversify across goals

Return ONLY a valid JSON object with the following structure:
{
  "suggestions": [
    {"stock": "SYMBOL", "goalId": "goal_id", "reason": "explanation", "confidence": "high/medium/low"}
  ]
}

Note: Use the "id" of the goal in "goalId".
`;

  try {
    console.log(`Attempting to generate suggestions with Ollama model: ${modelName}`);
    
    // Check if model exists, if not pull it (this might be slow, usually assume user has it)
    // For better UX, we just run generate and catch error if missing.
    
    const response = await ollama.generate({
      model: modelName,
      prompt: prompt,
      format: 'json', // Ollama supports JSON mode natively
      stream: false
    });

    // Ollama generate response structure
    const text = response.response;
    const parsed = JSON.parse(text);

    // Approximate token usage if provided (Ollama provides eval_count etc.)
    const usage = {
        promptTokenCount: response.prompt_eval_count || 0,
        candidatesTokenCount: response.eval_count || 0,
        totalTokenCount: (response.prompt_eval_count || 0) + (response.eval_count || 0)
    };

    console.log(`Successfully generated with ${modelName}`);
    return {
        suggestions: parsed.suggestions,
        tokenUsage: usage,
        modelUsed: modelName
    };

  } catch (error) {
    console.warn(`Failed with Ollama model ${modelName}: ${error.message}`);
    throw new Error(`Failed to generate suggestions from Ollama (${modelName}): ` + error.message);
  }
}

module.exports = { getOllamaSuggestions };
