import { NextResponse } from "next/server";
import { getModel } from "@/lib/gemini";

export const runtime = "nodejs";

interface RequestBody {
  label: string;
  theme: string;
}

export async function POST(req: Request) {
  try {
    const { label, theme } = (await req.json()) as RequestBody;

    const prompt = `マインドマップで「${theme}」というテーマについて考えています。
そのなかの「${label}」というキーワードについて、小学校高学年でもわかるように2〜3文で説明してください。
難しい言葉は使わず、身近な例えを入れてください。出力は説明文のみ。前置きは不要です。`;

    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return NextResponse.json({ explanation: text });
  } catch (error) {
    console.error("[api/ai/explain]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
