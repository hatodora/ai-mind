export type NodeRole = "user" | "ai" | "root";

export type Turn = "user" | "ai";

export interface MindMapNodeData {
  label: string;
  role: NodeRole;
}

export interface MindMapNode {
  id: string;
  data: MindMapNodeData;
  position: { x: number; y: number };
  type?: string;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
}

export interface MindMap {
  id: string;
  theme: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  currentTurn: Turn;
  turnCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AISuggestion {
  label: string;
  parentId: string;
}
