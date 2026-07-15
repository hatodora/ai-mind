import { NextResponse } from "next/server";
import { getModel } from "@/lib/groq";
import { asAgeBand, asPersonality, personaAgeBlock } from "@/lib/ai-persona";
import {
  MAX_LABEL_LEN,
  MAX_THEME_LEN,
  asBoundedString,
} from "@/lib/ai-validate";

export const runtime = "nodejs";

interface RequestBody {
  label: string;
  theme: string;
  ageBand?: string;
  personality?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    // 認証なしで叩ける経路のため、型・長さを必ず検証する
    const label = asBoundedString(body.label, MAX_LABEL_LEN);
    const theme = asBoundedString(body.theme, MAX_THEME_LEN);
    if (!label || !theme) {
      return NextResponse.json(
        { error: "リクエストが不正です" },
        { status: 400 },
      );
    }
    // 年齢帯・人格（UP-06 / UP-04）で語り口を切り替える
    const ageBand = asAgeBand(body.ageBand);
    const personality = asPersonality(body.personality);

    const prompt = `${personaAgeBlock(personality, ageBand)}

マインドマップで「${theme}」というテーマについて考えています。
そのなかの「${label}」というキーワードについて、2〜3文で説明してください。
身近な例えを入れると伝わりやすくなります。出力は説明文のみ。前置きは不要です。`;

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
