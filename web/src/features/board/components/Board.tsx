import { useQuery } from "@tanstack/react-query";
import { fetchBoard } from "../api/fetchBoard";
import { BoardCanvas } from "./BoardCanvas";

export function Board() {
  const { data: board, isError } = useQuery({
    queryKey: ["board"],
    queryFn: fetchBoard,
  });

  if (isError) {
    return <p>Could not load the Board.</p>;
  }

  if (!board) {
    return <p>Loading the Board…</p>;
  }

  return <BoardCanvas board={board} />;
}
