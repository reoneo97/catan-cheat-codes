import { describe, it, expect } from "vitest";
import { generateBoard } from "../board.js";
import { cubeKey, CUBE_DIRECTIONS, cubeAdd } from "../hex.js";

describe("generateBoard", () => {
  it("produces 19 land tiles", () => {
    const board = generateBoard();
    const land = board.tiles.filter((t) => t.terrain !== "sea");
    expect(land).toHaveLength(19);
  });

  it("has exactly one desert tile", () => {
    const board = generateBoard();
    const deserts = board.tiles.filter((t) => t.terrain === "desert");
    expect(deserts).toHaveLength(1);
  });

  it("desert tile has no number token", () => {
    const board = generateBoard();
    const desert = board.tiles.find((t) => t.terrain === "desert")!;
    expect(desert.number).toBeUndefined();
  });

  it("exactly one tile starts with the robber (on desert)", () => {
    const board = generateBoard();
    const withRobber = board.tiles.filter((t) => t.hasRobber);
    expect(withRobber).toHaveLength(1);
    expect(withRobber[0].terrain).toBe("desert");
  });

  it("no two 6/8 tiles are adjacent", () => {
    // Run multiple boards to check the constraint holds consistently
    for (let attempt = 0; attempt < 5; attempt++) {
      const board = generateBoard();
      const byKey = new Map(board.tiles.map((t) => [cubeKey(t.coord), t]));

      for (const tile of board.tiles) {
        if (tile.number !== 6 && tile.number !== 8) continue;
        for (const dir of CUBE_DIRECTIONS) {
          const neighbour = byKey.get(cubeKey(cubeAdd(tile.coord, dir)));
          if (!neighbour?.number) continue;
          expect(
            neighbour.number === 6 || neighbour.number === 8,
            `Two red numbers (${tile.number} and ${neighbour.number}) found adjacent`
          ).toBe(false);
        }
      }
    }
  });

  it("no two 2/12 tiles are adjacent", () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const board = generateBoard();
      const byKey = new Map(board.tiles.map((t) => [cubeKey(t.coord), t]));

      for (const tile of board.tiles) {
        if (tile.number !== 2 && tile.number !== 12) continue;
        for (const dir of CUBE_DIRECTIONS) {
          const neighbour = byKey.get(cubeKey(cubeAdd(tile.coord, dir)));
          if (!neighbour?.number) continue;
          expect(
            neighbour.number === 2 || neighbour.number === 12,
            `Two extreme numbers (${tile.number} and ${neighbour.number}) found adjacent`
          ).toBe(false);
        }
      }
    }
  });

  it("has 9 ports", () => {
    const board = generateBoard();
    expect(board.ports).toHaveLength(9);
  });

  it("number tokens appear in correct quantities", () => {
    const board = generateBoard();
    const counts: Record<number, number> = {};
    for (const tile of board.tiles) {
      if (tile.number) counts[tile.number] = (counts[tile.number] ?? 0) + 1;
    }
    // Official distribution: 2×1, 3×2, 4×2, 5×2, 6×2, 8×2, 9×2, 10×2, 11×2, 12×1
    expect(counts[2]).toBe(1);
    expect(counts[12]).toBe(1);
    expect(counts[6]).toBe(2);
    expect(counts[8]).toBe(2);
  });
});
