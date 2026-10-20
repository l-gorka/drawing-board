import type { ListBoardsResponse } from "@drawing-board/shared";

export async function fetchBoards(): Promise<ListBoardsResponse> {
  const response = await fetch("/api/boards");
  if (!response.ok) {
    throw new Error(`Failed to load boards: ${response.status}`);
  }
  return (await response.json()) as ListBoardsResponse;
}
