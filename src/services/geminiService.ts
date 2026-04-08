import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateInitialStory = async (config: {
  genre: string;
  language: string;
  characters: string;
  tone: string;
  setting: string;
}) => {
  const prompt = `Start a new story in ${config.language}. 
  Genre: ${config.genre}. 
  Characters: ${config.characters}. 
  Tone: ${config.tone}. 
  Setting: ${config.setting}.
  Provide the first segment of the story (about 150-200 words). 
  Make it engaging and end with a slight cliffhanger or a point where a choice can be made.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
};

export const generateStoryNextSegment = async (
  currentStory: string,
  userCommand: string,
  language: string
) => {
  const prompt = `The story so far:
  "${currentStory}"
  
  User wants to: "${userCommand}"
  
  Continue the story in ${language} based on the user's command. 
  Provide the next segment (about 150-200 words). 
  Maintain the tone and style of the previous parts.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
};

export const generateTTS = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!base64Audio) {
      console.warn("TTS: No audio data in response", response);
    }
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

export const getStorySuggestions = async (currentStory: string, lastCommand?: string) => {
  const prompt = `You are a creative writing assistant. Analyze the following story segment:
  "${currentStory}"
  ${lastCommand ? `The last action taken was: "${lastCommand}"` : ''}
  
  Based on this context, provide 4 highly specific and relevant suggestions for the next part of the story:
  1. A "twist": An unexpected plot development that changes the narrative direction.
  2. A "dialogue": A specific line of dialogue or a conversation starter for a character present in the scene.
  3. A "description": A vivid sensory description of the current setting or a new element introduced to the environment.
  4. An "action": A direct physical action or decision for the protagonist to take.
  
  Ensure the suggestions feel like a natural but exciting progression of the current scene.
  Return as a JSON array of objects with 'type' (twist, dialogue, description, action) and 'text' properties.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["type", "text"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const translateStory = async (content: string, targetLanguage: string) => {
  const prompt = `Translate the following story segment into ${targetLanguage}. 
  Maintain the original tone, style, and formatting (it's in Markdown).
  
  Content:
  "${content}"`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
};
