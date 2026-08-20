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
import {
  listPhases,
  parseDocument,
  phaseColor,
} from "../src/components/matrix/core/model";
import { parseImport } from "../src/components/matrix/core/importMatrix";
import type { MatrixDocument, Unit } from "../src/components/matrix/core/model";

function unit(id: string): Unit {
  return { id, label: id, type: "deposit" };
}

type TestRelation = [string, string, "above" | "same_as" | "contemporary"];

function doc(unitIds: string[], relations: TestRelation[]): MatrixDocument {
  return {
    version: 3,
    units: unitIds.map(unit),
    relations: relations.map(([from, to, type], index) => ({
      id: `r${index}`,
      from,
      to,
      type,
    })),
    groups: [],
    positions: {},
    phaseOrder: [],
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
    const relations: TestRelation[] = [];
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
    const relations: TestRelation[] = [];
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

describe("contemporary units", () => {
  it("keeps contemporary deposits as separate nodes", () => {
    // Same-as merges; contemporary must not, or one context is erased.
    const graph = buildGraph(doc(["A", "B"], [["A", "B", "contemporary"]]));

    expect(graph.nodes).toHaveLength(2);
    expect(graph.contemporaries).toHaveLength(1);
    expect(graph.correlations).toHaveLength(0);
  });

  it("rejects units that are contemporary and also stratified", () => {
    const graph = buildGraph(
      doc(
        ["A", "B", "C"],
        [
          ["A", "B", "above"],
          ["B", "C", "above"],
          ["A", "C", "contemporary"],
        ],
      ),
    );

    expect(graph.problems.some((p) => p.kind === "contemporary_and_ordered")).toBe(
      true,
    );
  });
});

describe("import", () => {
  it("reads three-column CSV and creates units on first mention", () => {
    const report = parseImport("1001,above,1002\n1002,above,1003");

    expect(report.unitsAdded).toBe(3);
    expect(report.relationsAdded).toBe(2);
    expect(report.skipped).toEqual([]);
    expect(report.doc.units.map((u) => u.label).sort()).toEqual([
      "1001",
      "1002",
      "1003",
    ]);
  });

  it("reads the same thing written as prose", () => {
    const report = parseImport("1001 above 1002");
    expect(report.relationsAdded).toBe(1);
  });

  it("flips reversed verbs so the upper unit is stored first", () => {
    const report = parseImport("1001,below,1002");
    const relation = report.doc.relations[0];
    const label = (id: string) => report.doc.units.find((u) => u.id === id)!.label;

    expect(label(relation.from)).toBe("1002");
    expect(label(relation.to)).toBe("1001");
  });

  it("skips a header row without inventing contexts from it", () => {
    const report = parseImport("upper,relation,lower\n1001,above,1002");
    expect(report.unitsAdded).toBe(2);
  });

  it("reports unreadable lines instead of failing the file", () => {
    const report = parseImport(
      "1001,above,1002\n1003,sideways,1004\nnonsense\n1005,above,1006",
    );

    expect(report.relationsAdded).toBe(2);
    expect(report.skipped).toHaveLength(2);
    expect(report.skipped[0].line).toBe(2);
    expect(report.skipped[0].reason).toContain("sideways");
  });

  it("merges into an existing document without duplicating units", () => {
    const first = parseImport("1001,above,1002");
    const second = parseImport("1002,above,1003", first.doc);

    expect(second.unitsAdded).toBe(1);
    expect(second.doc.units).toHaveLength(3);
  });

  it("ignores a relationship it already holds", () => {
    const first = parseImport("1001,above,1002");
    const second = parseImport("1001,above,1002", first.doc);
    expect(second.relationsAdded).toBe(0);
  });

  it("handles quoted fields containing commas", () => {
    const report = parseImport('"1001","above","1002"');
    expect(report.relationsAdded).toBe(1);
  });

  it("imports a matrix that is consistent once built", () => {
    const report = parseImport(
      ["1001,above,1002", "1002,above,1003", "1001,above,1003"].join("\n"),
    );
    const graph = buildGraph(report.doc);

    // The recorded shortcut is kept in the record but not drawn.
    expect(graph.edges.filter((e) => !e.redundant)).toHaveLength(2);
    expect(graph.problems.filter((p) => p.severity === "error")).toHaveLength(0);
  });
});

describe("phases", () => {
  it("gives a phase the same colour wherever it is typed", () => {
    expect(phaseColor("Roman")).toBe(phaseColor("Roman"));
    expect(phaseColor("Roman")).not.toBe(phaseColor("Medieval"));
  });

  it("lists phases in the document's order, then the rest alphabetically", () => {
    const base = doc(["A", "B", "C"], []);
    base.units[0].phase = "Medieval";
    base.units[1].phase = "Roman";
    base.units[2].phase = "Iron Age";
    base.phaseOrder = ["Roman"];

    expect(listPhases(base)).toEqual(["Roman", "Iron Age", "Medieval"]);
  });
});
