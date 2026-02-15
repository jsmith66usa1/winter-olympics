
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Helper to perform retries with exponential backoff for API calls.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isTransient = error.message?.includes("503") || 
                          error.message?.includes("UNAVAILABLE") || 
                          error.message?.includes("Deadline") ||
                          error.message?.includes("429"); // Rate limit can also benefit from backoff
      
      if (isTransient && i < maxRetries - 1) {
        console.warn(`Gemini API error (attempt ${i + 1}): ${error.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Generates an action photograph using the Gemini 2.5 Flash Image model.
 * Enhanced to handle combined events with split-screen prompts.
 */
export async function generateSportImage(sport: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let dynamicPrompt = `A cinematic action photograph of a Winter Olympic athlete performing ${sport}. Professional sports photography, snow spray, high speed, authentic gear. Sharp focus, realistic lighting. No text, no logos.`;

  if (sport.toLowerCase().includes('nordic combined')) {
    dynamicPrompt = `A high-impact split-screen composite photograph showing the two disciplines of Nordic Combined: one side featuring a dramatic Ski Jumping flight, and the other side showing intense Cross-Country Skiing. Cinematic sports photography, authentic Olympic gear, professional lighting, snow spray.`;
  } else if (sport.toLowerCase().includes('biathlon')) {
    dynamicPrompt = `A cinematic split-screen or dual-action photograph of the Biathlon: one half showing a cross-country skier at peak exertion on the trail, the other half showing the focused rifle shooting at the target range. Professional Olympic photography style, crisp detail, realistic winter atmosphere.`;
  }

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: dynamicPrompt }],
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
  });
}

export interface VerificationResult {
  isCorrect: boolean;
  feedback: string;
  detailedDescription: string;
  videoUrl?: string;
}

export async function verifySportAnswer(userInput: string, targetSport: string): Promise<VerificationResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Evaluate the user's guess for the Winter Olympic sport.
  Target Sport: "${targetSport}"
  User Guess: "${userInput}"
  
  Search for: "Official action highlights for ${targetSport} Winter Olympics on YouTube.com"
  
  TASK:
  1. Determine if the guess is correct (be lenient with spelling and common synonyms like 'skating' for 'figure skating').
  2. Provide a short punchy feedback sentence.
  3. Provide a detailed 3-4 sentence historical and technical description of the sport.
  
  FORMAT YOUR RESPONSE EXACTLY LIKE THIS (delimited by |):
  STATUS: [CORRECT or INCORRECT] | FEEDBACK: [Short Sentence] | DESCRIPTION: [Detailed Description]`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const parts = text.split('|');
    
    let isCorrect = text.toUpperCase().includes('STATUS: CORRECT');
    let feedback = "The judges have spoken!";
    let detailedDescription = "A fascinating Winter Olympic event with a rich history of competition and skill.";
    
    parts.forEach(p => {
      if (p.includes('FEEDBACK:')) feedback = p.replace('FEEDBACK:', '').trim();
      if (p.includes('DESCRIPTION:')) detailedDescription = p.replace('DESCRIPTION:', '').trim();
    });

    let videoUrl = undefined;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      const youtubeLink = groundingChunks.find(chunk => {
        const uri = chunk.web?.uri?.toLowerCase() || '';
        return uri.includes('youtube.com/watch') || uri.includes('youtu.be/') || uri.includes('youtube.com/shorts');
      });
      
      if (youtubeLink?.web?.uri) {
        videoUrl = youtubeLink.web.uri;
      } else {
        videoUrl = groundingChunks[0]?.web?.uri;
      }
    }

    return {
      isCorrect,
      feedback,
      detailedDescription,
      videoUrl
    };
  });
}

export async function getGameIntroMessage(players: string[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Exciting 1-sentence intro for a Winter Olympic guessing game. Mention players: ${players.join(', ')}. Keep it sporty and cold!`;
  try {
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      return response.text;
    });
  } catch (e) {
    return "The arena is set! Athletes, prepare to identify these frosty scenes!";
  }
}
