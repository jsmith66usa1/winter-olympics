
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Generates an action photograph using the Gemini 2.5 Flash Image model.
 * This model follows standard quota rules and doesn't require the mandatory 
 * key selection UI, making it better for a public "shared" experience.
 */
export async function generateSportImage(sport: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `A cinematic action photograph of a Winter Olympic athlete performing ${sport}. 
  Professional sports photography, snow spray, high speed, authentic gear. 
  Sharp focus, realistic lighting. No text, no logos.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part?.inlineData) {
      throw new Error("No image data returned from Gemini.");
    }

    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  } catch (error: any) {
    console.error("Error generating image:", error);
    throw error;
  }
}

export async function verifySportAnswer(userInput: string, targetSport: string): Promise<{ isCorrect: boolean; feedback: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Game: Identify a Winter Olympic sport. 
  Correct Sport: "${targetSport}".
  User Answer: "${userInput}".
  Rules: Is this guess correct? Be lenient with synonyms (e.g., 'Skating' for 'Figure Skating' might be okay if the context matches). 
  Provide a 1-sentence interesting fact about the sport. Return JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
          },
          required: ["isCorrect", "feedback"]
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    const isClose = userInput.toLowerCase().includes(targetSport.toLowerCase().split(' ')[0]);
    return { isCorrect: isClose, feedback: `The judges say: It's ${targetSport}!` };
  }
}

export async function getGameIntroMessage(players: string[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Exciting 1-sentence intro for a Winter Olympic guessing game. Mention players: ${players.join(', ')}. Keep it sporty and cold!`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text;
  } catch (e) {
    return "The arena is set! Athletes, prepare to identify these frosty scenes!";
  }
}
