import type { BoardSummary } from "@drawing-board/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { createBoard } from "../api/createBoard";
import { fetchBoards } from "../api/fetchBoards";

type BoardSwitcherProps = {
  activeBoardId: string;
  onActiveBoardChange: (boardId: string) => void;
};

export function BoardSwitcher({
  activeBoardId,
  onActiveBoardChange,
}: BoardSwitcherProps) {
  const queryClient = useQueryClient();
  const [newBoardName, setNewBoardName] = useState("");

  const { data, isError } = useQuery({
    queryKey: ["boards"],
    queryFn: fetchBoards,
  });

  const createMutation = useMutation({
    mutationFn: createBoard,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setNewBoardName("");
      onActiveBoardChange(created.id);
    },
  });

  const boards = data?.boards ?? [];
  const activeName =
    boards.find((board) => board.id === activeBoardId)?.name ?? activeBoardId;

  if (isError) {
    return <p>Could not load boards.</p>;
  }

  function handleCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = newBoardName.trim();
    if (trimmed.length === 0) {
      return;
    }
    createMutation.mutate(trimmed);
  }

  return (
    <div className="board-switcher">
      <p>
        Board: <strong>{activeName}</strong>
      </p>
      <label>
        Switch board
        <select
          value={activeBoardId}
          onChange={(event) => onActiveBoardChange(event.target.value)}
        >
          {boards.map((board: BoardSummary) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={handleCreate}>
        <label>
          New board name
          <input
            value={newBoardName}
            onChange={(event) => setNewBoardName(event.target.value)}
          />
        </label>
        <button
          disabled={newBoardName.trim().length === 0 || createMutation.isPending}
          type="submit"
        >
          Create board
        </button>
      </form>
    </div>
  );
}
