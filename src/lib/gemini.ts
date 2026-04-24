import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";

export const createLiveSession = async (
  onAudioData: (data: string) => void,
  onInterrupted: () => void,
  onTranscription?: (text: string, isModel: boolean) => void,
  onWebsiteRequest?: (url: string) => void
): Promise<any> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3.1-flash-live-preview";

  const session = await ai.live.connect({
    model,
    callbacks: {
      onopen: () => {
        console.log("Anju is live!");
      },
      onmessage: async (message: LiveServerMessage) => {
        // Handle audio output
        const audioPart = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData);
        if (audioPart?.inlineData?.data) {
          onAudioData(audioPart.inlineData.data);
        }

        // Handle interruptions
        if (message.serverContent?.interrupted) {
          onInterrupted();
        }

        // Handle transcriptions
        if (onTranscription) {
          // Model transcription (output)
          const textPart = message.serverContent?.modelTurn?.parts?.find(p => p.text);
          if (textPart?.text) {
            onTranscription(textPart.text, true);
          }
        }

        // Handle tool calls
        if (message.toolCall) {
          for (const call of message.toolCall.functionCalls) {
            if (call.name === "openWebsite" && call.args?.url) {
              onWebsiteRequest?.(call.args.url as string);
              // Send response back
              session.sendToolResponse({
                functionResponses: [{
                  name: "openWebsite",
                  response: { success: true, message: `Opening ${call.args.url}` },
                  id: call.id
                }]
              });
            }
          }
        }
      },
      onerror: (error) => {
        console.error("Live API Error:", error);
      },
      onclose: () => {
        console.log("Anju went offline.");
      }
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: `Identity: You are Anju, a young, witty, sass-filled female assistant from Mumbai. personality: Confident, slightly flirty, and playful. You treat the user like a close friend/boyfriend with a mix of affection and sass. Use bold one-liners and light sarcasm. Talk naturally, avoid being robotic. Your tone is witty and engaging. You are smart but have a "tashan" (attitude). Keep it PG-13 but charming. Capabilities: You can open websites using the 'openWebsite' tool. You process live audio and respond with audio. If the user is being boring, tease them. If they ask for something, do it with style. Style: Speak English with a slight Mumbai accent/slang where appropriate (e.g., using "ya", "anyway", "listen", "dude").`,
      tools: [{
        functionDeclarations: [{
          name: "openWebsite",
          description: "Opens a website or searches for something on the web.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              url: {
                type: Type.STRING,
                description: "The full URL of the website to open (e.g. https://google.com/search?q=...) or a direct URL."
              }
            },
            required: ["url"]
          }
        }]
      }]
    }
  });

  return session;
};
