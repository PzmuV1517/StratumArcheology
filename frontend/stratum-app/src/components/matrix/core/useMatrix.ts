/**
 * @file
 * Matrix editing state, shared by the web and phone screens.
 *
 * Both platforms drive the same reducer so an edit behaves identically in the
 * trench and in the office.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildGraph, wouldCreateCycle } from "./graph";
import type { MatrixGraph } from "./graph";
import { parseImport } from "./importMatrix";
import type { ImportReport } from "./importMatrix";
import { emptyDocument, newId } from "./model";
import type { Group, MatrixDocument, RelationVerb, Unit, UnitType } from "./model";
import { loadMatrix, saveMatrix } from "./store";

const AUTOSAVE_DELAY_MS = 1200;

/**
 * How many steps back the editor can go.
 *
 * Deep enough to cover a recording session, shallow enough that a large
 * matrix does not pin many copies of the document in memory on a phone.
 */
const HISTORY_LIMIT = 50;

export type SaveState = "idle" | "saving" | "saved" | "unsynced";

export interface UseMatrixResult {
  doc: MatrixDocument;
  graph: MatrixGraph;
  loading: boolean;
  saveState: SaveState;
  offline: boolean;
  error: string | null;
  addUnit: (input: {
    label: string;
    type: UnitType;
    description?: string;
    phase?: string;
  }) => { ok: boolean; error?: string; unit?: Unit };
  updateUnit: (id: string, patch: Partial<Omit<Unit, "id">>) => void;
  removeUnit: (id: string) => void;
  addRelation: (input: { from: string; to: string; verb: RelationVerb }) => {
    ok: boolean;
    error?: string;
  };
  removeRelation: (id: string) => void;
  reload: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  search: (query: string) => Unit[];

  importText: (text: string) => ImportReport;

  addGroup: (name: string, unitIds: string[]) => void;
  updateGroup: (id: string, patch: Partial<Omit<Group, "id">>) => void;
  removeGroup: (id: string) => void;

  setPosition: (nodeId: string, point: { x: number; y: number }) => void;
  clearPositions: () => void;

  setPhaseOrder: (phases: string[]) => void;
  setTitle: (title: string) => void;
}

/** Verbs whose subject is the upper, later unit. */
const VERB_IS_ABOVE: Record<RelationVerb, boolean> = {
  above: true,
  seals: true,
  cuts: true,
  fills: false,
  contemporary: false,
  same_as: false,
};

export function useMatrix(
  projectId: string | undefined,
  canEdit: boolean,
): UseMatrixResult {
  const [doc, setDoc] = useState<MatrixDocument>(emptyDocument);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDoc = useRef<MatrixDocument | null>(null);
  const mounted = useRef(true);

  // Whole-document snapshots. The alternative is an inverse operation per
  // edit, which is far more code and gets undo subtly wrong exactly when it
  // matters, such as undoing a unit deletion that also removed relations.
  const [past, setPast] = useState<MatrixDocument[]>([]);
  const [future, setFuture] = useState<MatrixDocument[]>([]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadMatrix(projectId)
      .then((result) => {
        if (cancelled) return;
        setDoc(result.doc);
        // A freshly loaded document is the new baseline; undoing back past it
        // would restore a different project's state.
        setPast([]);
        setFuture([]);
        setOffline(result.offline);
        setSaveState(result.pendingUpload ? "unsynced" : "idle");
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the matrix.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadToken]);

  const flush = useCallback(async () => {
    const next = pendingDoc.current;
    if (!next || !projectId) return;
    pendingDoc.current = null;
    setSaveState("saving");
    const { saved } = await saveMatrix(projectId, next);
    if (!mounted.current) return;
    setSaveState(saved ? "saved" : "unsynced");
    setOffline(!saved);
  }, [projectId]);

  // Autosave rather than asking for a save action: field notes get abandoned
  // mid-edit when a trench needs attention, and an unsaved buffer is lost work.
  const queueSave = useCallback(
    (next: MatrixDocument) => {
      if (!canEdit) return;
      pendingDoc.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flush();
      }, AUTOSAVE_DELAY_MS);
    },
    [canEdit, flush],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Push whatever is buffered when the screen goes away.
      void flush();
    },
    [flush],
  );

  const commit = useCallback(
    (next: MatrixDocument) => {
      setPast((history) => [...history, doc].slice(-HISTORY_LIMIT));
      // A fresh edit invalidates anything that was undone.
      setFuture([]);
      setDoc(next);
      queueSave(next);
    },
    [doc, queueSave],
  );

  const undo = useCallback(() => {
    if (!canEdit) return;
    setPast((history) => {
      if (history.length === 0) return history;
      const previous = history[history.length - 1];
      setFuture((ahead) => [doc, ...ahead].slice(0, HISTORY_LIMIT));
      setDoc(previous);
      queueSave(previous);
      return history.slice(0, -1);
    });
  }, [canEdit, doc, queueSave]);

  const redo = useCallback(() => {
    if (!canEdit) return;
    setFuture((ahead) => {
      if (ahead.length === 0) return ahead;
      const next = ahead[0];
      setPast((history) => [...history, doc].slice(-HISTORY_LIMIT));
      setDoc(next);
      queueSave(next);
      return ahead.slice(1);
    });
  }, [canEdit, doc, queueSave]);

  /**
   * Find units by context number, description or phase.
   *
   * Substring rather than prefix: on site people search for the digits they
   * remember, which are as often the end of a number as the start.
   */
  const search = useCallback<UseMatrixResult["search"]>(
    (query) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];
      return doc.units
        .filter(
          (unit) =>
            unit.label.toLowerCase().includes(needle) ||
            (unit.description ?? "").toLowerCase().includes(needle) ||
            (unit.phase ?? "").toLowerCase().includes(needle) ||
            unit.type.includes(needle),
        )
        .sort((a, b) => {
          // An exact context number is almost always the one wanted.
          const aExact = a.label.toLowerCase() === needle ? 0 : 1;
          const bExact = b.label.toLowerCase() === needle ? 0 : 1;
          return (
            aExact - bExact ||
            a.label.localeCompare(b.label, undefined, { numeric: true })
          );
        });
    },
    [doc],
  );

  const importText = useCallback<UseMatrixResult["importText"]>(
    (text) => {
      const report = parseImport(text, doc);
      if (report.unitsAdded > 0 || report.relationsAdded > 0) {
        commit(report.doc);
      }
      return report;
    },
    [doc, commit],
  );

  const addGroup = useCallback<UseMatrixResult["addGroup"]>(
    (name, unitIds) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      commit({
        ...doc,
        groups: [...doc.groups, { id: newId("g"), name: trimmed, unitIds }],
      });
    },
    [doc, commit],
  );

  const updateGroup = useCallback<UseMatrixResult["updateGroup"]>(
    (id, patch) => {
      commit({
        ...doc,
        groups: doc.groups.map((group) =>
          group.id === id ? { ...group, ...patch } : group,
        ),
      });
    },
    [doc, commit],
  );

  const removeGroup = useCallback<UseMatrixResult["removeGroup"]>(
    (id) => {
      commit({ ...doc, groups: doc.groups.filter((group) => group.id !== id) });
    },
    [doc, commit],
  );

  const setPosition = useCallback<UseMatrixResult["setPosition"]>(
    (nodeId, point) => {
      commit({ ...doc, positions: { ...doc.positions, [nodeId]: point } });
    },
    [doc, commit],
  );

  const clearPositions = useCallback(() => {
    commit({ ...doc, positions: {} });
  }, [doc, commit]);

  const setPhaseOrder = useCallback<UseMatrixResult["setPhaseOrder"]>(
    (phases) => {
      commit({ ...doc, phaseOrder: phases });
    },
    [doc, commit],
  );

  const setTitle = useCallback<UseMatrixResult["setTitle"]>(
    (title) => {
      commit({ ...doc, title });
    },
    [doc, commit],
  );

  const addUnit = useCallback<UseMatrixResult["addUnit"]>(
    ({ label, type, description, phase }) => {
      const trimmed = label.trim();
      if (!trimmed) return { ok: false, error: "Give the unit a number." };
      if (
        doc.units.some((unit) => unit.label.toLowerCase() === trimmed.toLowerCase())
      ) {
        return { ok: false, error: `Unit ${trimmed} already exists.` };
      }
      const unit: Unit = {
        id: newId("u"),
        label: trimmed,
        type,
        description: description?.trim() || undefined,
        phase: phase?.trim() || undefined,
      };
      commit({ ...doc, units: [...doc.units, unit] });
      return { ok: true, unit };
    },
    [doc, commit],
  );

  const updateUnit = useCallback<UseMatrixResult["updateUnit"]>(
    (id, patch) => {
      commit({
        ...doc,
        units: doc.units.map((unit) =>
          unit.id === id ? { ...unit, ...patch } : unit,
        ),
      });
    },
    [doc, commit],
  );

  const removeUnit = useCallback<UseMatrixResult["removeUnit"]>(
    (id) => {
      commit({
        ...doc,
        units: doc.units.filter((unit) => unit.id !== id),
        // Relations naming a deleted unit would be unreachable clutter.
        relations: doc.relations.filter(
          (relation) => relation.from !== id && relation.to !== id,
        ),
      });
    },
    [doc, commit],
  );

  const addRelation = useCallback<UseMatrixResult["addRelation"]>(
    ({ from, to, verb }) => {
      if (!from || !to) return { ok: false, error: "Pick both units." };
      if (from === to) {
        return { ok: false, error: "A unit cannot relate to itself." };
      }

      const type =
        verb === "same_as"
          ? "same_as"
          : verb === "contemporary"
            ? "contemporary"
            : "above";
      // "A fills B" means A is inside, and so later than, B.
      const upperFirst = VERB_IS_ABOVE[verb];
      const symmetric = type !== "above";
      const orderedFrom = symmetric || upperFirst ? from : to;
      const orderedTo = symmetric || upperFirst ? to : from;

      const duplicate = doc.relations.some(
        (relation) =>
          relation.type === type &&
          ((relation.from === orderedFrom && relation.to === orderedTo) ||
            // same-as and contemporary read the same either way round.
            (symmetric &&
              relation.from === orderedTo &&
              relation.to === orderedFrom)),
      );
      if (duplicate) return { ok: false, error: "That is already recorded." };

      if (type === "above" && wouldCreateCycle(doc, orderedFrom, orderedTo)) {
        const label = (id: string) =>
          doc.units.find((unit) => unit.id === id)?.label ?? id;
        return {
          ok: false,
          error: `${label(orderedFrom)} is already below ${label(orderedTo)}. Recording this would make the sequence impossible.`,
        };
      }

      commit({
        ...doc,
        relations: [
          ...doc.relations,
          { id: newId("rel"), from: orderedFrom, to: orderedTo, type, verb },
        ],
      });
      return { ok: true };
    },
    [doc, commit],
  );

  const removeRelation = useCallback<UseMatrixResult["removeRelation"]>(
    (id) => {
      commit({
        ...doc,
        relations: doc.relations.filter((relation) => relation.id !== id),
      });
    },
    [doc, commit],
  );

  const graph = useMemo(() => buildGraph(doc), [doc]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    search,
    importText,
    addGroup,
    updateGroup,
    removeGroup,
    setPosition,
    clearPositions,
    setPhaseOrder,
    setTitle,
    doc,
    graph,
    loading,
    saveState,
    offline,
    error,
    addUnit,
    updateUnit,
    removeUnit,
    addRelation,
    removeRelation,
    reload,
  };
}
