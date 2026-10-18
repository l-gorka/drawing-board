import { BLANK_COLOR, BOARD_SIZE } from "./board";

export const Palette = [
  BLANK_COLOR,
  "#FFFFFF",
  "#E4E4E4",
  "#888888",
  "#FFA7D1",
  "#E50000",
  "#E59500",
  "#A06A42",
  "#E5D900",
  "#94E044",
  "#02BE01",
  "#00D3DD",
  "#0083C7",
  "#0000EA",
  "#CF6EE4",
  "#820080",
] as const;

export type Color = (typeof Palette)[number];

export type DrawMessage = {
  type: "DRAW";
  x: number;
  y: number;
  color: Color;
};

export function parseDrawMessage(input: unknown): DrawMessage | null {
  if (typeof input !== "string") {
    return null;
  }

  try {
    const value: unknown = JSON.parse(input);
    if (
      !isRecord(value) ||
      value.type !== "DRAW" ||
      !isCellCoordinate(value.x) ||
      !isCellCoordinate(value.y) ||
      !isPaletteColor(value.color)
    ) {
      return null;
    }

    return {
      type: value.type,
      x: value.x,
      y: value.y,
      color: value.color,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCellCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < BOARD_SIZE
  );
}

function isPaletteColor(value: unknown): value is Color {
  return typeof value === "string" && Palette.includes(value as Color);
}
