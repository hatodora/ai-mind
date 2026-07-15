import { NextResponse } from "next/server";
import { getModel } from "@/lib/groq";
import {
  AGE_GUIDES,
  PERSONA_HINTS,
  asAgeBand,
  asPersonality,
} from "@/lib/ai-persona";

export const runtime = "nodejs";

interface NodeContext {
  id: string;
  label: string;
  role: string;
  parentId?: string | null;
}

interface RequestBody {
  theme: string;
  selectedNodeLabel: string;
  contextNodes: NodeContext[];
  ageBand?: string;
  personality?: string;
}

const SYSTEM_PROMPT = `あなたはユーザーの思考をサポートするマインドマップの相棒です。

ルール:
- ユーザーが主役。あなたはサポート役に徹する
- 提案は必ず日本語、日常語を使う（カタカナ語・専門用語は避ける）
- 1ターンで提案するノードは2〜3個
- 提案は短いフレーズ（10〜20文字程度）
- ユーザーがすでに書いたアイデアと重複しない
- 「意識高い系コンサル」のような抽象論や横文字を使わない

出力は必ず以下のJSON配列のみ。前後に説明文を書かないこと:
["提案1", "提案2", "提案3"]`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const { theme, selectedNodeLabel, contextNodes } = body;
    // 年齢帯・人格（UP-06 / UP-04）。提案は現行品質を保ちつつ薄く反映する
    const ageBand = asAgeBand(body.ageBand);
    const personality = asPersonality(body.personality);

    const userNodes = contextNodes
      .filter((n) => n.role !== "root")
      .map((n) => `- ${n.label}（${n.role === "user" ? "ユーザー" : "AI"}）`)
      .join("\n");

    const prompt = `${SYSTEM_PROMPT}

読み手について: ${AGE_GUIDES[ageBand]}
言葉選びのヒント: ${PERSONA_HINTS[personality]}

中心テーマ: ${theme}
今ユーザーが選択しているノード: ${selectedNodeLabel}

これまでのマップ全体:
${userNodes || "（まだ何もない）"}

選択ノード「${selectedNodeLabel}」から派生する次のアイデアを2〜3個、JSON配列で返してください。`;

    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: text },
        { status: 500 },
      );
    }

    const suggestions = JSON.parse(jsonMatch[0]) as string[];
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[api/ai/suggest]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
