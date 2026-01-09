
import { GoogleGenAI } from "@google/genai";
import { GameEvent } from "../types";

// Always use process.env.API_KEY directly as a named parameter
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getDerbyCommentary = async (event: GameEvent): Promise<string> => {
  try {
    const prompt = `You are a hype-man announcer for a high-stakes Smash Up Derby. 
    A ${event.type} just happened between ${event.participants.join(' and ')}.
    Intensity: ${event.intensity.toFixed(1)}/10.
    Provide a one-sentence, punchy, exciting, and slightly funny commentary for the live ticker.
    Examples:
    - "OH! That impact almost sent some parts into the next century!"
    - "Somebody call the insurance adjuster, that car is toast!"
    - "Absolute carnage! The blue racer is playing dirty today!"`;

    // Always specify model name and prompt in generateContent as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        // Avoiding maxOutputTokens without thinkingBudget as per guideline recommendations
        temperature: 0.9,
      }
    });

    // Access the .text property directly (do not call as a method)
    return response.text || "Unbelievable hit! The crowd is going wild!";
  } catch (err) {
    console.error("Gemini Error:", err);
    return "What a collision!";
  }
};
