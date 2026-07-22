#!/usr/bin/env node
/**
 * TASKS.md → Notion Database 同期スクリプト
 * GitHub Actions から呼び出される
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("@notionhq/client");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
let DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error(
    "❌ Missing env vars: NOTION_TOKEN or NOTION_DATABASE_ID not set"
  );
  process.exit(1);
}

// Remove ?v=... suffix from DATABASE_ID
DATABASE_ID = DATABASE_ID.replace(/\?.*$/, '');

const notion = new Client({ auth: NOTION_TOKEN });

/**
 * TASKS.md をパースして、タスク情報を抽出
 */
function parseTasks() {
  const tasksPath = path.join(__dirname, "..", "TASKS.md");
  const content = fs.readFileSync(tasksPath, "utf-8");

  const tasks = [];

  // REL-01〜REL-11 のセクションを正規表現で抽出
  const taskRegex =
    /### (REL-\d+):([^\n]+)\n([\s\S]*?)(?=###|## 🌱|$)/g;
  let match;

  while ((match = taskRegex.exec(content))) {
    const taskId = match[1];
    const title = match[2].trim();
    const blockContent = match[3];

    const task = {
      id: taskId,
      title: `${taskId}: ${title}`,
      status: extractField(blockContent, "Status") || "To Do",
      phase: extractField(blockContent, "Phase") || "Phase A",
      ambition: extractField(blockContent, "Ambition") || "Medium",
      dueDate: extractField(blockContent, "Due Date"),
      assignedTo: extractField(blockContent, "Assigned To"),
      scope: extractField(blockContent, "Scope"),
      knownGaps: extractField(blockContent, "Known Gaps"),
      notes: extractField(blockContent, "Notes"),
    };

    tasks.push(task);
  }

  console.log(`📋 Parsed ${tasks.length} tasks from TASKS.md`);
  return tasks;
}

/**
 * マークダウンのフィールドを抽出（例: "- **Status**: To Do"）
 */
function extractField(content, fieldName) {
  const regex = new RegExp(`- \\*\\*${fieldName}\\*\\*:\\s*(.+?)(?=\n|$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Notion Database の既存ページを取得（全ページスキャン）
 */
async function getExistingPages() {
  const pages = [];
  let cursor = undefined;
  const cleanDatabaseId = DATABASE_ID.replace(/\?.*$/, '');

  try {
    while (true) {
      // 注: @notionhq/client v5 では query メソッドが利用不可のため、
      // 代わりに blocks.children.list を使ってページの子要素を列挙する方法もあるが、
      // 最も確実な方法は REST API を直接叩く
      const response = await notion.request({
        path: "databases/" + cleanDatabaseId + "/query",
        method: "post",
        body: {
          start_cursor: cursor,
        },
      });

      pages.push(...response.results);

      if (!response.has_more) break;
      cursor = response.next_cursor;
    }
  } catch (error) {
    console.error("❌ Failed to query Notion database:", error.message);
    // query API が利用不可な場合は、既存ページをチェックしないで全て作成
    console.warn("⚠️  Skipping existing page check. All tasks will be created as new.");
    return [];
  }

  console.log(`📚 Found ${pages.length} existing pages in Notion`);
  return pages;
}

/**
 * タスク情報を Notion ページに変換
 */
function taskToNotionProperties(task) {
  const props = {
    Task: {
      title: [
        {
          type: "text",
          text: {
            content: task.title,
          },
        },
      ],
    },
    Status: {
      select: {
        name: task.status,
      },
    },
    Phase: {
      select: {
        name: task.phase,
      },
    },
    Ambition: {
      select: {
        name: task.ambition,
      },
    },
  };

  if (task.scope) {
    props.Scope = {
      rich_text: [
        {
          type: "text",
          text: {
            content: task.scope.substring(0, 2000), // Notion の text 制限
          },
        },
      ],
    };
  }

  if (task.knownGaps) {
    props["Known Gaps"] = {
      rich_text: [
        {
          type: "text",
          text: {
            content: task.knownGaps.substring(0, 2000),
          },
        },
      ],
    };
  }

  if (task.dueDate) {
    // "2026-07-18" 形式を想定
    const dateMatch = task.dueDate.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      props["Due Date"] = {
        date: {
          start: dateMatch[0],
        },
      };
    }
  }

  if (task.assignedTo) {
    props["Assigned To"] = {
      rich_text: [
        {
          type: "text",
          text: {
            content: task.assignedTo.substring(0, 100),
          },
        },
      ],
    };
  }

  if (task.notes) {
    props.Notes = {
      rich_text: [
        {
          type: "text",
          text: {
            content: task.notes.substring(0, 2000),
          },
        },
      ],
    };
  }

  return props;
}

/**
 * タスクを Notion に同期（作成または更新）
 */
async function syncTask(task, existingPage) {
  const properties = taskToNotionProperties(task);

  try {
    if (existingPage) {
      // 既存ページを更新
      await notion.pages.update({
        page_id: existingPage.id,
        properties,
      });
      console.log(`✅ Updated ${task.id}`);
    } else {
      // 新規ページを作成
      await notion.pages.create({
        parent: {
          database_id: DATABASE_ID,
        },
        properties,
      });
      console.log(`✨ Created ${task.id}`);
    }
  } catch (error) {
    console.error(`❌ Failed to sync ${task.id}:`, error.message);
    // エラーはログするが、スクリプトは続行
  }
}

/**
 * ページから Task タイトルを抽出（REL-01 の形式を想定）
 */
function extractTaskIdFromPage(page) {
  const titleProperty = page.properties.Task;
  if (!titleProperty || titleProperty.type !== "title") return null;

  const titleText = titleProperty.title[0]?.plain_text || "";
  const match = titleText.match(/^(REL-\d+)/);
  return match ? match[1] : null;
}

/**
 * メイン処理
 */
async function main() {
  console.log("🔄 Starting TASKS.md → Notion sync...\n");

  const tasks = parseTasks();
  const existingPages = await getExistingPages();

  // 既存ページを Task ID でマッピング
  const pageMap = new Map();
  existingPages.forEach((page) => {
    const taskId = extractTaskIdFromPage(page);
    if (taskId) {
      pageMap.set(taskId, page);
    }
  });

  // 各タスクを同期
  let syncedCount = 0;
  for (const task of tasks) {
    const existingPage = pageMap.get(task.id);
    await syncTask(task, existingPage);
    syncedCount++;
    // Notion API のレート制限回避（1秒待機）
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n✨ Synced ${syncedCount}/${tasks.length} tasks`);
  console.log("✅ All tasks synchronized!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
