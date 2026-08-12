/**
 * @file
 * Harris Matrix editor, phone and tablet.
 *
 * One view at a time rather than a side-by-side layout, because the diagram
 * needs the whole screen to be legible and recording happens one context at a
 * time anyway. Shares the graph, layout and storage code with the web editor,
 * so a matrix drawn in the trench is the same matrix opened in the office.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import Svg, { Line, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { layoutGraph, PHONE_LAYOUT, polylinePoints } from "./core/layout";
import { RELATION_VERBS, UNIT_TYPES } from "./core/model";
import type { RelationVerb, UnitType } from "./core/model";
import { useMatrix } from "./core/useMatrix";

interface HarrisMatrixProps {
  projectId: string;
  canEdit?: boolean;
}

type View_ = "diagram" | "units" | "relations" | "problems";

export const HarrisMatrix: React.FC<HarrisMatrixProps> = ({
  projectId,
  canEdit = true,
}) => {
  const dark = (useColorScheme() ?? "light") === "dark";
  const matrix = useMatrix(projectId, canEdit);
  const [view, setView] = useState<View_>("diagram");
  const [zoom, setZoom] = useState(1);

  const layout = useMemo(
    () => layoutGraph(matrix.graph, PHONE_LAYOUT),
    [matrix.graph],
  );

  const c = useMemo(
    () => ({
      bg: dark ? "#111111" : "#F6F6F6",
      panel: dark ? "#0A0A0A" : "#FFFFFF",
      border: dark ? "#2A2A2A" : "#D9D9D9",
      text: dark ? "#EDEDED" : "#111111",
      muted: dark ? "#9A9A9A" : "#666666",
      error: dark ? "#FF6B6B" : "#C0392B",
      warn: dark ? "#E0A458" : "#9A6700",
      accent: dark ? "#2A2A2A" : "#E8E8E8",
    }),
    [dark],
  );

  const errors = matrix.graph.problems.filter((p) => p.severity === "error");
  const warnings = matrix.graph.problems.filter((p) => p.severity === "warning");

  if (matrix.loading) {
    return (
      <View style={[styles.centre, { backgroundColor: c.bg }]}>
        <ActivityIndicator />
        <Text style={{ color: c.muted, marginTop: 8 }}>Loading matrix...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={[
          styles.tabs,
          { borderBottomColor: c.border, backgroundColor: c.panel },
        ]}
      >
        {(["diagram", "units", "relations", "problems"] as View_[]).map((name) => (
          <Pressable
            key={name}
            onPress={() => setView(name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === name }}
            accessibilityLabel={
              name === "problems" && errors.length > 0
                ? `Problems, ${errors.length} to fix`
                : name
            }
            style={[styles.tab, view === name && { backgroundColor: c.accent }]}
          >
            <Text style={{ color: c.text, textTransform: "capitalize" }}>
              {name}
              {name === "problems" && errors.length > 0 ? ` (${errors.length})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {view === "diagram" && (
        <View style={{ flex: 1 }}>
          <View style={[styles.toolbar, { borderBottomColor: c.border }]}>
            <Pressable
              onPress={() => setZoom((z) => Math.max(0.4, z - 0.2))}
              style={[styles.button, { backgroundColor: c.accent }]}
              accessibilityLabel="Zoom out"
            >
              <Text style={{ color: c.text, fontSize: 18 }}>-</Text>
            </Pressable>
            <Text style={{ color: c.muted, minWidth: 56, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </Text>
            <Pressable
              onPress={() => setZoom((z) => Math.min(3, z + 0.2))}
              style={[styles.button, { backgroundColor: c.accent }]}
              accessibilityLabel="Zoom in"
            >
              <Text style={{ color: c.text, fontSize: 18 }}>+</Text>
            </Pressable>
            <Text style={{ color: c.muted, marginLeft: "auto", fontSize: 12 }}>
              Earliest at the bottom
            </Text>
          </View>

          {layout.nodes.length === 0 ? (
            <View style={styles.centre}>
              <Text style={{ color: c.muted, textAlign: "center", padding: 24 }}>
                No units yet. Add contexts under Units and the matrix builds itself.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 12 }}
              maximumZoomScale={3}
              minimumZoomScale={1}
            >
              <ScrollView horizontal contentContainerStyle={{ padding: 4 }}>
                <Svg
                  width={layout.width * zoom}
                  height={layout.height * zoom}
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                >
                  {layout.edges.map((edge) => (
                    <Polyline
                      key={`${edge.from}-${edge.to}`}
                      points={polylinePoints(edge.points)}
                      fill="none"
                      stroke={c.text}
                      strokeWidth={1.5}
                    />
                  ))}
                  {layout.correlations.map((link, index) => (
                    <Line
                      key={index}
                      x1={link.from.x}
                      y1={link.from.y}
                      x2={link.to.x}
                      y2={link.to.y}
                      stroke={c.text}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                    />
                  ))}
                  {layout.nodes.map((node) => (
                    <React.Fragment key={node.id}>
                      <Rect
                        x={node.x}
                        y={node.y}
                        width={node.width}
                        height={node.height}
                        fill={c.panel}
                        stroke={node.hasProblem ? c.error : c.text}
                        strokeWidth={node.hasProblem ? 2.5 : 1.5}
                      />
                      <SvgText
                        x={node.x + node.width / 2}
                        y={node.y + node.height / 2 + 5}
                        textAnchor="middle"
                        fontSize={14}
                        fill={c.text}
                      >
                        {node.label}
                      </SvgText>
                    </React.Fragment>
                  ))}
                </Svg>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      )}

      {view === "units" && (
        <UnitsView matrix={matrix} canEdit={canEdit} colors={c} />
      )}
      {view === "relations" && (
        <RelationsView matrix={matrix} canEdit={canEdit} colors={c} />
      )}
      {view === "problems" && (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {errors.length === 0 && warnings.length === 0 && (
            <Text style={{ color: c.muted }}>
              No contradictions. Every recorded relationship fits one sequence.
            </Text>
          )}
          {errors.map((problem, index) => (
            <View
              key={`e${index}`}
              style={[styles.problem, { borderLeftColor: c.error }]}
            >
              <Text style={{ color: c.error, fontWeight: "600" }}>Must fix</Text>
              <Text style={{ color: c.text }}>{problem.message}</Text>
            </View>
          ))}
          {warnings.map((problem, index) => (
            <View
              key={`w${index}`}
              style={[styles.problem, { borderLeftColor: c.warn }]}
            >
              <Text style={{ color: c.warn, fontWeight: "600" }}>Note</Text>
              <Text style={{ color: c.text }}>{problem.message}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={[styles.status, { borderTopColor: c.border }]}>
        <Text style={{ color: c.muted, fontSize: 12 }}>
          {statusLine(matrix.saveState, matrix.offline, canEdit)}
        </Text>
      </View>
    </View>
  );
};

function statusLine(saveState: string, offline: boolean, canEdit: boolean): string {
  if (!canEdit) return "Read only.";
  if (saveState === "unsynced" || offline) {
    return "Saved on this device. Will upload when back in signal.";
  }
  if (saveState === "saving") return "Saving...";
  if (saveState === "saved") return "Saved to the project.";
  return "Up to date.";
}

interface ViewProps {
  matrix: ReturnType<typeof useMatrix>;
  canEdit: boolean;
  colors: Record<string, string>;
}

const UnitsView: React.FC<ViewProps> = ({ matrix, canEdit, colors }) => {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<UnitType>("deposit");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = matrix.addUnit({ label, type });
    if (!result.ok) {
      setError(result.error ?? "Could not add the unit.");
      return;
    }
    setError(null);
    setLabel("");
  };

  const units = [...matrix.doc.units].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      {canEdit && (
        <View style={{ marginBottom: 16 }}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Context number, e.g. 1001"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Context number"
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.panel,
              },
            ]}
          />
          <View style={styles.chips}>
            {UNIT_TYPES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setType(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: type === option }}
                style={[
                  styles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: type === option ? colors.accent : "transparent",
                  },
                ]}
              >
                <Text style={{ color: colors.text }}>{option}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={submit}
            style={[
              styles.primary,
              { backgroundColor: colors.accent, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.text }}>Add unit</Text>
          </Pressable>
          {error && <Text style={{ color: colors.error }}>{error}</Text>}
        </View>
      )}

      {units.length === 0 && (
        <Text style={{ color: colors.muted }}>No units recorded.</Text>
      )}

      {units.map((unit) => (
        <View key={unit.id} style={[styles.row, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {unit.label}
            </Text>
            <Text style={{ color: colors.muted }}>{unit.type}</Text>
          </View>
          {canEdit && (
            <Pressable
              accessibilityLabel={`Delete unit ${unit.label}`}
              onPress={() =>
                Alert.alert(
                  `Delete ${unit.label}?`,
                  "Its recorded relationships go too. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => matrix.removeUnit(unit.id),
                    },
                  ],
                )
              }
              style={[styles.button, { backgroundColor: colors.accent }]}
            >
              <Text style={{ color: colors.text }}>Delete</Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const RelationsView: React.FC<ViewProps> = ({ matrix, canEdit, colors }) => {
  const [from, setFrom] = useState<string | null>(null);
  const [verb, setVerb] = useState<RelationVerb>("above");
  const [to, setTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const units = [...matrix.doc.units].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  const label = (id: string) =>
    matrix.doc.units.find((unit) => unit.id === id)?.label ?? id;

  const submit = () => {
    if (!from || !to) {
      setError("Pick both units.");
      return;
    }
    const result = matrix.addRelation({ from, to, verb });
    if (!result.ok) {
      setError(result.error ?? "Could not record that.");
      return;
    }
    setError(null);
    setTo(null);
  };

  const picker = (
    title: string,
    value: string | null,
    onChange: (id: string) => void,
  ) => (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: colors.muted, marginBottom: 4 }}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {units.map((unit) => (
          <Pressable
            key={unit.id}
            onPress={() => onChange(unit.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === unit.id }}
            style={[
              styles.chip,
              {
                borderColor: colors.border,
                backgroundColor: value === unit.id ? colors.accent : "transparent",
              },
            ]}
          >
            <Text style={{ color: colors.text }}>{unit.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      {canEdit && units.length >= 2 && (
        <View style={{ marginBottom: 16 }}>
          {picker("Upper unit", from, setFrom)}
          <View style={styles.chips}>
            {RELATION_VERBS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setVerb(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: verb === option }}
                style={[
                  styles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: verb === option ? colors.accent : "transparent",
                  },
                ]}
              >
                <Text style={{ color: colors.text }}>
                  {option.replace("_", " ")}
                </Text>
              </Pressable>
            ))}
          </View>
          {picker("Lower unit", to, setTo)}
          <Pressable
            onPress={submit}
            style={[
              styles.primary,
              { backgroundColor: colors.accent, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.text }}>Record relationship</Text>
          </Pressable>
          {error && <Text style={{ color: colors.error }}>{error}</Text>}
        </View>
      )}

      {units.length < 2 && (
        <Text style={{ color: colors.muted, marginBottom: 12 }}>
          Add at least two units before recording a relationship.
        </Text>
      )}

      {matrix.doc.relations.map((relation) => (
        <View key={relation.id} style={[styles.row, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, flex: 1 }}>
            {label(relation.from)}{" "}
            {(relation.verb ?? relation.type).replace("_", " ")} {label(relation.to)}
          </Text>
          {canEdit && (
            <Pressable
              accessibilityLabel="Remove relationship"
              onPress={() => matrix.removeRelation(relation.id)}
              style={[styles.button, { backgroundColor: colors.accent }]}
            >
              <Text style={{ color: colors.text }}>Remove</Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
  },
  // 44pt is the smallest reliable touch target, and this gets used with
  // muddy gloves on.
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  primary: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: "center",
    marginRight: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  problem: {
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  status: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});

export default HarrisMatrix;
