/**
 * @file
 * Tests for the Harris Matrix graph reasoning.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import { buildGraph, wouldCreateCycle } from "../src/components/matrix/core/graph";
import { parseDocument } from "../src/components/matrix/core/model";
import type { MatrixDocument, Unit } from "../src/components/matrix/core/model";

function unit(id: string): Unit {
  return { id, label: id, type: "deposit" };
}

function doc(
  unitIds: string[],
  relations: [string, string, "above" | "same_as"][],
): MatrixDocument {
  return {
    version: 3,
    units: unitIds.map(unit),
    relations: relations.map(([from, to, type], index) => ({
      id: `r${index}`,
      from,
      to,
      type,
    })),
  };
}

function drawnEdges(graph: ReturnType<typeof buildGraph>): string[] {
  return graph.edges
    .filter((edge) => !edge.redundant)
    .map((edge) => `${edge.from}>${edge.to}`)
    .sort();
}

describe("transitive reduction", () => {
  it("drops a relationship implied by a longer chain", () => {
    // 1001 above 1002 above 1003, plus the redundant 1001 above 1003.
    const graph = buildGraph(
      doc(
        ["1001", "1002", "1003"],
        [
          ["1001", "1002", "above"],
          ["1002", "1003", "above"],
          ["1001", "1003", "above"],
        ],
      ),
    );

    expect(drawnEdges(graph)).toEqual(["1001>1002", "1002>1003"]);
    expect(
      graph.edges.find((e) => e.from === "1001" && e.to === "1003")?.redundant,
    ).toBe(true);
  });

  it("keeps both edges of a genuine diamond", () => {
    // A above B and C, both above D. Nothing here is implied.
    const graph = buildGraph(
      doc(
        ["A", "B", "C", "D"],
        [
          ["A", "B", "above"],
          ["A", "C", "above"],
          ["B", "D", "above"],
          ["C", "D", "above"],
        ],
      ),
    );

    expect(drawnEdges(graph)).toEqual(["A>B", "A>C", "B>D", "C>D"]);
    expect(graph.edges.every((edge) => !edge.redundant)).toBe(true);
  });

  it("reduces a long chain with every shortcut recorded", () => {
    const ids = ["1", "2", "3", "4", "5"];
    const relations: [string, string, "above"][] = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        relations.push([ids[i], ids[j], "above"]);
      }
    }

    const graph = buildGraph(doc(ids, relations));

    // Only the consecutive hops survive.
    expect(drawnEdges(graph)).toEqual(["1>2", "2>3", "3>4", "4>5"]);
  });
});

describe("levels", () => {
  it("places each node below everything it is under", () => {
    const graph = buildGraph(
      doc(
        ["A", "B", "C", "D"],
        [
          ["A", "B", "above"],
          ["A", "C", "above"],
          ["B", "D", "above"],
          ["C", "D", "above"],
        ],
      ),
    );

    const level = (id: string) => graph.nodes.find((node) => node.id === id)!.level;

    expect(level("A")).toBe(0);
    expect(level("B")).toBe(1);
    expect(level("C")).toBe(1);
    // D sits below both B and C, so it takes the longest path.
    expect(level("D")).toBe(2);
  });

  it("uses the longest path, not the shortest", () => {
    const graph = buildGraph(
      doc(
        ["A", "B", "C"],
        [
          ["A", "B", "above"],
          ["B", "C", "above"],
        ],
      ),
    );
    expect(graph.nodes.find((n) => n.id === "C")!.level).toBe(2);
  });
});

describe("correlation", () => {
  it("merges units recorded as the same deposit into one node", () => {
    const graph = buildGraph(
      doc(
        ["1004", "1017", "1020"],
        [
          ["1004", "1017", "same_as"],
          ["1004", "1020", "above"],
        ],
      ),
    );

    expect(graph.nodes).toHaveLength(2);
    const merged = graph.nodes.find((node) => node.members.length === 2)!;
    expect(merged.label).toBe("1004 = 1017");
  });

  it("inherits relationships from every correlated member", () => {
    // 1017 is above 1020, and 1004 is the same deposit as 1017.
    const graph = buildGraph(
      doc(
        ["1004", "1017", "1020"],
        [
          ["1004", "1017", "same_as"],
          ["1017", "1020", "above"],
        ],
      ),
    );

    const merged = graph.nodes.find((node) => node.members.length === 2)!;
    const lower = graph.nodes.find((node) => node.id !== merged.id)!;
    expect(drawnEdges(graph)).toEqual([`${merged.id}>${lower.id}`]);
  });

  it("flags units both correlated and placed in sequence", () => {
    const graph = buildGraph(
      doc(
        ["A", "B"],
        [
          ["A", "B", "same_as"],
          ["A", "B", "above"],
        ],
      ),
    );

    expect(graph.problems.some((p) => p.kind === "correlated_and_ordered")).toBe(
      true,
    );
  });
});

describe("contradictions", () => {
  it("reports a two-unit loop", () => {
    const graph = buildGraph(
      doc(
        ["A", "B"],
        [
          ["A", "B", "above"],
          ["B", "A", "above"],
        ],
      ),
    );

    expect(graph.problems.some((p) => p.kind === "contradiction")).toBe(true);
  });

  it("reports a longer loop and still returns a drawable graph", () => {
    const graph = buildGraph(
      doc(
        ["A", "B", "C"],
        [
          ["A", "B", "above"],
          ["B", "C", "above"],
          ["C", "A", "above"],
        ],
      ),
    );

    const cycle = graph.problems.find((p) => p.kind === "cycle");
    expect(cycle).toBeDefined();
    expect(cycle!.severity).toBe("error");
    // The diagram must still render so the excavator can see the problem.
    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.every((node) => Number.isFinite(node.level))).toBe(true);
  });

  it("rejects a unit recorded above itself", () => {
    const graph = buildGraph(doc(["A"], [["A", "A", "above"]]));
    expect(graph.problems.some((p) => p.kind === "self_relation")).toBe(true);
    expect(drawnEdges(graph)).toEqual([]);
  });

  it("warns about the same pair recorded twice", () => {
    const graph = buildGraph(
      doc(
        ["A", "B"],
        [
          ["A", "B", "above"],
          ["A", "B", "above"],
        ],
      ),
    );
    expect(graph.problems.some((p) => p.kind === "duplicate")).toBe(true);
    expect(drawnEdges(graph)).toEqual(["A>B"]);
  });

  it("predicts a cycle before the relation is saved", () => {
    const existing = doc(
      ["A", "B", "C"],
      [
        ["A", "B", "above"],
        ["B", "C", "above"],
      ],
    );

    expect(wouldCreateCycle(existing, "C", "A")).toBe(true);
    expect(wouldCreateCycle(existing, "A", "C")).toBe(false);
    expect(wouldCreateCycle(existing, "A", "A")).toBe(true);
  });
});

describe("scale", () => {
  it("handles a deep sequence without overflowing the stack", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `u${i}`);
    const relations: [string, string, "above"][] = [];
    for (let i = 0; i < ids.length - 1; i += 1) {
      relations.push([ids[i], ids[i + 1], "above"]);
    }

    const graph = buildGraph(doc(ids, relations));

    expect(graph.nodes).toHaveLength(400);
    expect(graph.levelCount).toBe(400);
    expect(graph.problems.filter((p) => p.severity === "error")).toHaveLength(0);
  });
});

describe("parsing stored documents", () => {
  it("reads the current format", () => {
    const parsed = parseDocument({
      version: 3,
      units: [{ id: "A", label: "1001", type: "deposit" }],
      relations: [{ id: "r", from: "A", to: "A", type: "above" }],
    });
    expect(parsed.units).toHaveLength(1);
    expect(parsed.units[0].label).toBe("1001");
  });

  it("migrates the previous format, including reversed verbs", () => {
    const parsed = parseDocument({
      contexts: [
        ["1001", { type: "layer", description: "topsoil" }],
        ["1002", { type: "cut" }],
      ],
      relationships: [{ from: "1001", to: "1002", type: "below" }],
    });

    expect(parsed.units.map((u) => u.id).sort()).toEqual(["1001", "1002"]);
    expect(parsed.units[0].type).toBe("deposit");
    // "1001 below 1002" is stored as "1002 above 1001".
    expect(parsed.relations).toEqual([
      expect.objectContaining({ from: "1002", to: "1001", type: "above" }),
    ]);
  });

  it("drops relationships pointing at units that no longer exist", () => {
    const parsed = parseDocument({
      contexts: [["1001", {}]],
      relationships: [{ from: "1001", to: "9999", type: "above" }],
    });
    expect(parsed.relations).toEqual([]);
  });

  it("returns an empty document for unusable input", () => {
    expect(parseDocument(null).units).toEqual([]);
    expect(parseDocument("nonsense").units).toEqual([]);
    expect(parseDocument({}).units).toEqual([]);
  });
});
