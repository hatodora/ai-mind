import Groq from "groq-sdk";

export const MODEL_NAME = "llama-3.3-70b-versatile";

export function getModel() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY が設定されていません。.env.local を確認してください。",
    );
  }
  const client = new Groq({ apiKey });

  return {
    async generateContent(prompt: string) {
      const completion = await client.chat.completions.create({
        model: MODEL_NAME,
        messages: [{ role: "user", content: prompt }],
      });
      const content = completion.choices[0].message.content ?? "";
      return {
        response: {
          text: () => content,
        },
      };
    },
  };
}
