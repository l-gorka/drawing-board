# Drawing Board

A real-time multiplayer pixel board: anyone who opens it can paint on a single shared grid and see everyone else's changes instantly.

## Language

**Board**:
The single shared 32×32 grid of Cells that all participants draw on. It is the source of truth held by the server.
_Avoid_: Canvas (for the data), grid, map

**Cell**:
One position on the Board, identified by its column and row, holding one color.
_Avoid_: Pixel (except in user-facing copy and the project name), tile, square

**Draw**:
The act of setting a Cell's color.
_Avoid_: Paint, place, update

**Reset**:
The act of clearing every Cell on the Board back to the Blank color, for all participants at once.
_Avoid_: Clear, wipe, erase

**Blank color**:
The dark gray a Cell has before anyone Draws on it. It is part of the Palette and acts as the eraser.
_Avoid_: Background color, white, empty

**Palette**:
The fixed set of colors a participant can choose from when drawing.
_Avoid_: Color picker, swatches

**Canvas**:
The client-side visual rendering of the Board. It displays the Board but is not the Board itself.
_Avoid_: Board (when meaning the rendering)
