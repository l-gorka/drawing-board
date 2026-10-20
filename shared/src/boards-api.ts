export const DEFAULT_BOARD_ID = "main";

const MAX_BOARD_ID_LENGTH = 128;

export type BoardSummary = {
  id: string;
  name: string;
};

export type ListBoardsResponse = {
  boards: BoardSummary[];
};

export type CreateBoardRequest = {
  name: string;
};

export function parseCreateBoardRequest(
  input: unknown,
): CreateBoardRequest | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const name = (input as { name?: unknown }).name;
  if (typeof name !== "string") {
    return null;
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return { name: trimmed };
}

export function isBoardId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_BOARD_ID_LENGTH;
}
