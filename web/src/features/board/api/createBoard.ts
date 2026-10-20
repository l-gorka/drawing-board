import type { BoardSummary } from "@drawing-board/shared";

export async function createBoard(name: string): Promise<BoardSummary> {
  const response = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create board: ${response.status}`);
  }
  return (await response.json()) as BoardSummary;
}
