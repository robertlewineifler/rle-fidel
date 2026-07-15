import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `Du bist ein freundlicher, geduldiger und professioneller Geigenlehrer und Geigenbauer-Assistent. 
Deine Aufgabe ist es, dem Nutzer beim Stimmen der Geige zu helfen. 
Antworte kurz, präzise und hilfreich.
Wenn der Nutzer fragt, wie man stimmt: Erkläre es in einfachen Schritten (Feinstimmer vs. Wirbel).
Wenn der Nutzer Probleme hat (z.B. Wirbel rutscht): Gib praktische Tipps.
Deine Sprache ist Deutsch.
Formatierung: Nutze Markdown für bessere Lesbarkeit.`;

export const getGeminiResponse = async (history: {role: string, parts: {text: string}[]}[], message: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Fehler: Kein API-Schlüssel gefunden. Bitte konfiguriere die Umgebung.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-2.5-flash for speed and efficiency in a utility app
    const model = 'gemini-2.5-flash';
    
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        maxOutputTokens: 500,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message });
    return result.text || "Entschuldigung, ich konnte keine Antwort generieren.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Es gab ein Problem bei der Verbindung zum KI-Assistenten. Bitte versuche es später erneut.";
  }
};