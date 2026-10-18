import type { Board } from "@drawing-board/shared";

export async function fetchBoard(): Promise<Board> {
  const response = await fetch("/api/board");
  if (!response.ok) {
    throw new Error(`Failed to load the Board: ${response.status}`);
  }
  return (await response.json()) as Board;
}
