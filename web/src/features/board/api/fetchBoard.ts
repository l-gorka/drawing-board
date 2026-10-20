import type { Board } from "@drawing-board/shared";

export async function fetchBoard(boardId: string): Promise<Board> {
  const response = await fetch(
    `/api/board/${encodeURIComponent(boardId)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load the Board: ${response.status}`);
  }
  return (await response.json()) as Board;
}
