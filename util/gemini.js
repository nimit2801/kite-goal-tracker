const { GoogleGenerativeAI } = require("@google/generative-ai");

async function getGeminiSuggestions(holdings, goals) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in .env");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // List of models to try in order of preference. 
  const modelsToTry = ["gemini-3-flash-preview", "gemini-1.5-flash", "gemini-1.5-pro"];
  
  let lastError = null;

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
  ],
  "personality_summary": "A 1-sentence motivating insight about the user's investment style/goals."
}

Note: Use the "id" of the goal in "goalId".
`;

  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting to generate suggestions with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      // Clean up potential markdown formatting if Gemini includes it
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      console.log(`Successfully generated with ${modelName}`);
      
      const usage = result.response.usageMetadata;
      const parsed = JSON.parse(text);
      
      return {
          suggestions: parsed.suggestions,
          personalitySummary: parsed.personality_summary,
          tokenUsage: usage
      };
    } catch (error) {
      console.warn(`Failed with model ${modelName}: ${error.message}`);
      lastError = error;
      // Continue to next model
    }
  }

  // If we get here, all models failed
  console.error("All Gemini models failed:", lastError);
  throw new Error("Failed to generate suggestions from AI after trying multiple models. Last error: " + (lastError ? lastError.message : "Unknown error"));
}

module.exports = { getGeminiSuggestions };
