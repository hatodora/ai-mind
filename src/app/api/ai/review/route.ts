import { NextResponse } from "next/server";
import { getModel } from "@/lib/gemini";

export const runtime = "nodejs";

interface RequestBody {
  theme: string;
  nodes: { label: string; role: string }[];
}

export async function POST(req: Request) {
  try {
    const { theme, nodes } = (await req.json()) as RequestBody;

    const nodeList = nodes
      .filter((n) => n.role !== "root")
      .map((n) => `- ${n.label}`)
      .join("\n");

    const prompt = `あなたはユーザーの問題解決を支援するパートナーです。
以下はユーザーが「${theme}」について作ったマインドマップです。

${nodeList}

このマップを見て、以下の3つを日常語で答えてください:

1. 良いところ（具体的に1〜2点）
2. もう少し深掘りすると面白そうなところ（1〜2点）
3. 次のアクション（具体的に2〜3個、明日からできること）

意識高い系の横文字や抽象論は禁止。中学生でもわかる具体的な言葉で、優しいトーンで答えてください。`;

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
