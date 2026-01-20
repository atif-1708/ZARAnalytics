/**
 * AI Insights Service (Disabled)
 * The @google/genai dependency has been removed.
 */

export const isAiEnabled = () => false;

export const getBusinessInsights = async (_data: any): Promise<string> => {
  return "AI Insights are currently unavailable.";
};