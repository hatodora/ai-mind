import { NextResponse } from "next/server";
import { getModel } from "@/lib/groq";
import { asAgeBand, asPersonality, personaAgeBlock } from "@/lib/ai-persona";
import {
  MAX_THEME_LEN,
  asBoundedString,
  asNodeList,
} from "@/lib/ai-validate";

export const runtime = "nodejs";

interface RequestBody {
  theme: string;
  nodes: { label: string; role: string }[];
  ageBand?: string;
  personality?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    // 認証なしで叩ける経路のため、型・長さ・件数を必ず検証する
    const theme = asBoundedString(body.theme, MAX_THEME_LEN);
    const nodes = asNodeList(body.nodes);
    if (!theme || nodes.length === 0) {
      return NextResponse.json(
        { error: "リクエストが不正です" },
        { status: 400 },
      );
    }
    // 年齢帯・人格（UP-06 / UP-04）で語り口を切り替える
    const ageBand = asAgeBand(body.ageBand);
    const personality = asPersonality(body.personality);

    const nodeList = nodes
      .filter((n) => n.role !== "root")
      .map((n) => `- ${n.label}`)
      .join("\n");

    const prompt = `あなたはユーザーの問題解決を支援するパートナーです。
${personaAgeBlock(personality, ageBand)}

以下はユーザーが「${theme}」について作ったマインドマップです。

${nodeList}

このマップを見て、以下の3つを日常語で答えてください:

1. 良いところ（具体的に1〜2点）
2. もう少し深掘りすると面白そうなところ（1〜2点）
3. 次のアクション（具体的に2〜3個、明日からできること）

意識高い系の横文字や抽象論は禁止。人格と読み手のガイドに沿ったトーンで答えてください。`;

    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return NextResponse.json({ review: text });
  } catch (error) {
    console.error("[api/ai/review]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
