import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  return (window as any).process?.env?.API_KEY || '';
};

export const isAiEnabled = () => !!getApiKey();

export const getBusinessInsights = async (data: any) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("AI Insights disabled: API_KEY not found in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Analyze the following business performance data and provide a concise 3-bullet point executive summary.
    Focus on profit trends, best performing units, and any warning signs.
    Data: ${JSON.stringify(data)}
    Format the response as a short, professional summary for a CEO.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (err) {
    console.error("Gemini API Error:", err);
    throw err;
  }
};