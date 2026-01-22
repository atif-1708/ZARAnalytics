// Use correct import for GoogleGenAI as per guidelines
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client using process.env.API_KEY directly
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * AI Insights Service
 * Provides automated analysis of business performance data using Gemini models.
 */

// Check if AI features should be available (API key presence)
export const isAiEnabled = () => !!process.env.API_KEY;

/**
 * Generates narrative insights based on provided business data.
 * @param data The performance data to analyze
 * @returns A promise resolving to the generated insight text
 */
export const getBusinessInsights = async (data: any): Promise<string> => {
  if (!isAiEnabled()) {
    return "AI Insights are currently unavailable. Please ensure a valid API_KEY is configured.";
  }

  try {
    // Call generateContent with the appropriate model for complex text tasks
    // Utilizing systemInstruction in the config as recommended for setting persona and constraints.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze the following performance data: ${JSON.stringify(data, null, 2)}`,
      config: {
        systemInstruction: "You are a professional business analyst. Analyze business performance data and provide 3-4 concise, high-impact bullet points identifying trends, concerns, or opportunities for growth. Focus on revenue, profit margins, and expense management.",
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Access the .text property directly as per guidelines (it is a property, not a method)
    return response.text || "The model did not return any insights. Please try again later.";
  } catch (error) {
    console.error("Gemini AI Insight Error:", error);
    return "An error occurred while generating business insights. Our team has been notified.";
  }
};
