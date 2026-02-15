
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Generates an action photograph using the Gemini 2.5 Flash Image model.
 * Enhanced to handle combined events with split-screen prompts.
 */
export async function generateSportImage(sport: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let dynamicPrompt = `A cinematic action photograph of a Winter Olympic athlete performing ${sport}. Professional sports photography, snow spray, high speed, authentic gear. Sharp focus, realistic lighting. No text, no logos.`;

  // Specialized prompts for combined events to ensure split/dual representation
  if (sport.toLowerCase().includes('nordic combined')) {
    dynamicPrompt = `A high-impact split-screen composite photograph showing the two disciplines of Nordic Combined: one side featuring a dramatic Ski Jumping flight, and the other side showing intense Cross-Country Skiing. Cinematic sports photography, authentic Olympic gear, professional lighting, snow spray.`;
  } else if (sport.toLowerCase().includes('biathlon')) {
    dynamicPrompt = `A cinematic split-screen or dual-action photograph of the Biathlon: one half showing a cross-country skier at peak exertion on the trail, the other half showing the focused rifle shooting at the target range. Professional Olympic photography style, crisp detail, realistic winter atmosphere.`;
  }

  try {
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
  
  // Specifically instructing search to find a YouTube video link for accuracy.
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

    // Extract YouTube link from grounding metadata with improved prioritization for official highlight accuracy
    let videoUrl = undefined;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      // Prioritize direct video links from youtube.com or youtu.be
      const youtubeLink = groundingChunks.find(chunk => {
        const uri = chunk.web?.uri?.toLowerCase() || '';
        return uri.includes('youtube.com/watch') || uri.includes('youtu.be/') || uri.includes('youtube.com/shorts');
      });
      
      if (youtubeLink?.web?.uri) {
        videoUrl = youtubeLink.web.uri;
      } else {
        // Fallback to the first available source
        videoUrl = groundingChunks[0]?.web?.uri;
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
