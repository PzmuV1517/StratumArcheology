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
import { emptyDocument, newId } from "./model";
import type { MatrixDocument, RelationVerb, Unit, UnitType } from "./model";
import { loadMatrix, saveMatrix } from "./store";

const AUTOSAVE_DELAY_MS = 1200;

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
}

/** Verbs whose subject is the upper, later unit. */
const VERB_IS_ABOVE: Record<RelationVerb, boolean> = {
  above: true,
  seals: true,
  cuts: true,
  fills: false,
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
      setDoc(next);
      queueSave(next);
    },
    [queueSave],
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

      const type = verb === "same_as" ? "same_as" : "above";
      // "A fills B" means A is inside, and so later than, B.
      const upperFirst = VERB_IS_ABOVE[verb];
      const orderedFrom = type === "same_as" || upperFirst ? from : to;
      const orderedTo = type === "same_as" || upperFirst ? to : from;

      const duplicate = doc.relations.some(
        (relation) =>
          relation.type === type &&
          ((relation.from === orderedFrom && relation.to === orderedTo) ||
            (type === "same_as" &&
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
