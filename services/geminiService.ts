
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Generates an action photograph using the Gemini 2.5 Flash Image model.
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

export interface VerificationResult {
  isCorrect: boolean;
  feedback: string;
  detailedDescription: string;
  videoUrl?: string;
}

export async function verifySportAnswer(userInput: string, targetSport: string): Promise<VerificationResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // We use googleSearch to find a YouTube video link and detailed info.
  // Note: responseSchema is not allowed when using googleSearch tool.
  const prompt = `Game: Identify a Winter Olympic sport. 
  Target Sport: "${targetSport}".
  User Guess: "${userInput}".
  
  TASK:
  1. Determine if the guess is correct (be lenient with synonyms).
  2. Provide a short punchy feedback sentence.
  3. Provide a detailed 3-4 sentence historical and technical description of the sport.
  4. Search for a high-quality official YouTube video link for this sport's Olympic highlights.
  
  FORMAT YOUR RESPONSE EXACTLY LIKE THIS (delimited by |):
  STATUS: [CORRECT or INCORRECT] | FEEDBACK: [Short Sentence] | DESCRIPTION: [Detailed Description]`;

  try {
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

    // Extract YouTube link from grounding metadata
    let videoUrl = undefined;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      const youtubeLink = groundingChunks.find(chunk => 
        chunk.web?.uri?.includes('youtube.com') || chunk.web?.uri?.includes('youtu.be')
      );
      if (youtubeLink?.web?.uri) {
        videoUrl = youtubeLink.web.uri;
      } else if (groundingChunks[0]?.web?.uri) {
        // Fallback to first grounding link if no explicit YouTube found
        videoUrl = groundingChunks[0].web.uri;
      }
    }

    return {
      isCorrect,
      feedback,
      detailedDescription,
      videoUrl
    };
  } catch (error) {
    console.error("Verification error:", error);
    const isClose = userInput.toLowerCase().includes(targetSport.toLowerCase().split(' ')[0]);
    return { 
      isCorrect: isClose, 
      feedback: `The judges say: It's ${targetSport}!`,
      detailedDescription: `This is ${targetSport}, one of the most exciting events in the Winter Games. It requires immense skill, precision, and years of dedicated training.`
    };
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
