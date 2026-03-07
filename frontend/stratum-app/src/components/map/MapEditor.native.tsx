/**
 * @file
 * Map editor component for React Native.
 *
 * Interactive map with drawing tools for marking GPS
 * coordinates and polygons on archaeological sites.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polygon,
  Polyline,
  MapPressEvent,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import type { LatLng as RNLatLng } from "react-native-maps";

import { Ionicons } from "@expo/vector-icons";
import { projectService } from "../../services/projectService";
import { fileService } from "../../services/fileService";

// ─── Types ────────────────────────────────────────────────────────────────────

type LatLng = { lat: number; lng: number };
type Mode = "work" | "site";

type Shape = {
  id: string;
  points: LatLng[];
  closed: boolean;
  color: string;
};

type ArtefactPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type SelectedPoint = {
  shapeType: "work" | "site";
  siteIndex?: number;
  pointIndex: number;
  lat: number;
  lng: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toRN = (p: LatLng): RNLatLng => ({
  latitude: p.lat,
  longitude: p.lng,
});

const fromRN = (p: RNLatLng): LatLng => ({
  lat: p.latitude,
  lng: p.longitude,
});

const WORK_COLOR = "#FF2A2A";
const SITE_COLOR = "#00d4b3";

const ROMANIA_REGION = {
  latitude: 45.9432,
  longitude: 24.9668,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

// ─── Dot marker ───────────────────────────────────────────────────────────────

function DotMarker({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: "#111111",
        shadowColor: "#000",
        shadowOpacity: 0.5,
        shadowRadius: 2,
        elevation: 3,
      }}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MapEditorMobile: React.FC<{
  projectId: string;
  canEdit?: boolean;
}> = ({ projectId, canEdit = true }) => {
  const [mode, setMode] = useState<Mode>("work");
  const [work, _setWork] = useState<Shape | null>(null);
  const [sites, _setSites] = useState<Shape[]>([]);
  const [activeSite, _setActiveSite] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Artefact pins from manifests with GPS coordinates
  const [artefactPins, setArtefactPins] = useState<ArtefactPin[]>([]);

  // Selected point for coordinate editing (Feature 4)
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");

  // Refs to avoid stale closures in callbacks
  const workRef = useRef<Shape | null>(null);
  const sitesRef = useRef<Shape[]>([]);
  const activeSiteRef = useRef<number | null>(null);

  const setWorkSync = (val: Shape | null) => {
    workRef.current = val;
    _setWork(val);
  };
  const setSitesSync = (val: Shape[]) => {
    sitesRef.current = val;
    _setSites(val);
  };
  const setActiveSiteSync = (val: number | null) => {
    activeSiteRef.current = val;
    _setActiveSite(val);
  };

  // ─── Save ────────────────────────────────────────────────────────────────

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNow = useCallback(async () => {
    if (!projectId || !canEdit) return;
    const curWork = workRef.current;
    const curSites = sitesRef.current || [];
    const closedSites = curSites.filter((s) => s.closed);
    const payload = {
      work: curWork ? { points: curWork.points, closed: !!curWork.closed } : null,
      sites: closedSites.map((s) => ({ points: s.points, closed: !!s.closed })),
    };
    try {
      await projectService.setGps(projectId, payload);
    } catch {}
  }, [projectId, canEdit]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(), 800);
  }, [saveNow]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveNow();
      }
    };
  }, [saveNow]);

  // ─── Load GPS state from backend ─────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const state = await projectService.getGps(projectId);
        if (cancelled) return;

        // Rehydrate work area
        if (state?.work?.points?.length) {
          const pts: LatLng[] = (state.work.points as any[]).map((p) => ({
            lat: p.lat,
            lng: p.lng,
          }));
          setWorkSync({
            id: "work",
            points: pts,
            closed: !!state.work.closed,
            color: WORK_COLOR,
          });
        }

        // Rehydrate sites (closed polygons only)
        if (state?.sites?.length) {
          const reSites: Shape[] = (state.sites as any[])
            .filter((s) => !!s.closed)
            .map((s, i) => ({
              id: `site-${i}-${Date.now()}`,
              points: (s.points || []).map((p: any) => ({
                lat: p.lat,
                lng: p.lng,
              })),
              closed: true,
              color: SITE_COLOR,
            }));
          setSitesSync(reSites);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ─── Load artefact pins from manifests ────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const root = await fileService.listRoot(projectId);
        const artefactsFolder = root.find(
          (n: any) => n.type === "folder" && n.name === "Artefacts",
        );
        if (!artefactsFolder) return;
        const folders = await fileService.listChildren(artefactsFolder.id);
        const pins: ArtefactPin[] = [];
        for (const folder of folders.filter((f: any) => f.type === "folder")) {
          try {
            const ch = await fileService.listChildren(folder.id);
            const metaFile = ch.find(
              (c: any) =>
                c.type === "file" &&
                (c.name === "artefact.json" || c.name.endsWith(".json")),
            );
            if (!metaFile) continue;
            const res = await fileService.downloadFile(metaFile.id);
            const text = await res.blob.text();
            if (!text) continue;
            const manifest = JSON.parse(text);
            if (
              manifest.latitude != null &&
              manifest.longitude != null &&
              !isNaN(manifest.latitude) &&
              !isNaN(manifest.longitude)
            ) {
              pins.push({
                id: folder.id,
                name: manifest.name || folder.name,
                lat: manifest.latitude,
                lng: manifest.longitude,
              });
            }
          } catch {}
        }
        if (!cancelled) setArtefactPins(pins);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ─── Map press: add a point ───────────────────────────────────────────────

  const handleMapPress = useCallback(
    (e: MapPressEvent) => {
      if (!canEdit) return;
      const ll = fromRN(e.nativeEvent.coordinate);

      if (mode === "work") {
        const curWork = workRef.current;
        if (!curWork) {
          setWorkSync({
            id: "work",
            points: [ll],
            closed: false,
            color: WORK_COLOR,
          });
          saveNow();
          return;
        }
        if (!curWork.closed) {
          setWorkSync({ ...curWork, points: [...curWork.points, ll] });
          scheduleSave();
        }
      } else {
        const curSites = sitesRef.current;
        const curActiveSite = activeSiteRef.current;

        if (curActiveSite == null || curSites[curActiveSite]?.closed) {
          const shape: Shape = {
            id: `site-${Date.now()}`,
            points: [ll],
            closed: false,
            color: SITE_COLOR,
          };
          const newSites = [...curSites, shape];
          setSitesSync(newSites);
          setActiveSiteSync(curSites.length);
          saveNow();
          return;
        }

        const cur = curSites[curActiveSite];
        if (!cur.closed) {
          const updated = curSites.slice();
          updated[curActiveSite] = { ...cur, points: [...cur.points, ll] };
          setSitesSync(updated);
          scheduleSave();
        }
      }
    },
    [canEdit, mode, saveNow, scheduleSave],
  );

  // ─── Close the active open shape ─────────────────────────────────────────

  const closeActiveShape = useCallback(() => {
    if (!canEdit) return;
    if (mode === "work") {
      const curWork = workRef.current;
      if (curWork && !curWork.closed && curWork.points.length >= 3) {
        setWorkSync({ ...curWork, closed: true });
        saveNow();
      }
    } else {
      const curSites = sitesRef.current;
      const curActiveSite = activeSiteRef.current;
      if (curActiveSite == null) return;
      const cur = curSites[curActiveSite];
      if (cur && !cur.closed && cur.points.length >= 3) {
        const updated = curSites.slice();
        updated[curActiveSite] = { ...cur, closed: true };
        setSitesSync(updated);
        saveNow();
      }
    }
  }, [canEdit, mode, saveNow]);

  // ─── Drag a marker to reposition a point ─────────────────────────────────

  const onWorkMarkerDragEnd = useCallback(
    (markerIndex: number, coord: RNLatLng) => {
      const curWork = workRef.current;
      if (!curWork) return;
      const pts = curWork.points.slice();
      pts[markerIndex] = fromRN(coord);
      setWorkSync({ ...curWork, points: pts });
      scheduleSave();
    },
    [scheduleSave],
  );

  const onSiteMarkerDragEnd = useCallback(
    (siteIndex: number, markerIndex: number, coord: RNLatLng) => {
      const curSites = sitesRef.current;
      const cur = curSites[siteIndex];
      if (!cur) return;
      const pts = cur.points.slice();
      pts[markerIndex] = fromRN(coord);
      const updated = curSites.slice();
      updated[siteIndex] = { ...cur, points: pts };
      setSitesSync(updated);
      scheduleSave();
    },
    [scheduleSave],
  );

  // ─── Reset everything ─────────────────────────────────────────────────────

  const resetAll = useCallback(() => {
    setWorkSync(null);
    setSitesSync([]);
    setActiveSiteSync(null);
    saveNow();
  }, [saveNow]);

  // ─── Point tap: show exact coordinates ────────────────────────────────────

  const onWorkPointTap = useCallback((markerIndex: number) => {
    const curWork = workRef.current;
    if (!curWork) return;
    const pt = curWork.points[markerIndex];
    setSelectedPoint({
      shapeType: "work",
      pointIndex: markerIndex,
      lat: pt.lat,
      lng: pt.lng,
    });
    setEditLat(pt.lat.toFixed(8));
    setEditLng(pt.lng.toFixed(8));
  }, []);

  const onSitePointTap = useCallback((siteIndex: number, markerIndex: number) => {
    const curSites = sitesRef.current;
    const cur = curSites[siteIndex];
    if (!cur) return;
    const pt = cur.points[markerIndex];
    setSelectedPoint({
      shapeType: "site",
      siteIndex,
      pointIndex: markerIndex,
      lat: pt.lat,
      lng: pt.lng,
    });
    setEditLat(pt.lat.toFixed(8));
    setEditLng(pt.lng.toFixed(8));
  }, []);

  const applyCoordinateEdit = useCallback(() => {
    if (!selectedPoint || !canEdit) return;
    const newLat = parseFloat(editLat);
    const newLng = parseFloat(editLng);
    if (isNaN(newLat) || isNaN(newLng)) return;

    if (selectedPoint.shapeType === "work") {
      const curWork = workRef.current;
      if (!curWork) return;
      const pts = curWork.points.slice();
      pts[selectedPoint.pointIndex] = { lat: newLat, lng: newLng };
      setWorkSync({ ...curWork, points: pts });
      scheduleSave();
    } else {
      const curSites = sitesRef.current;
      const si = selectedPoint.siteIndex ?? 0;
      const cur = curSites[si];
      if (!cur) return;
      const pts = cur.points.slice();
      pts[selectedPoint.pointIndex] = { lat: newLat, lng: newLng };
      const updated = curSites.slice();
      updated[si] = { ...cur, points: pts };
      setSitesSync(updated);
      scheduleSave();
    }
    setSelectedPoint(null);
  }, [selectedPoint, editLat, editLng, canEdit, scheduleSave]);

  // ─── Derived UI flags ─────────────────────────────────────────────────────

  const canCloseWork =
    canEdit && mode === "work" && !!work && !work.closed && work.points.length >= 3;
  const canCloseSite =
    canEdit &&
    mode === "site" &&
    activeSite != null &&
    !!sites[activeSite] &&
    !sites[activeSite].closed &&
    sites[activeSite].points.length >= 3;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={SITE_COLOR} />
          <Text style={styles.loadingHint}>Se încarcă harta…</Text>
          <Text style={styles.loadingSubHint}>
            Dacă vezi un ecran alb, așteaptă puțin — încărcarea depinde de conexiune.
          </Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={ROMANIA_REGION}
          mapType="hybrid"
          onPress={handleMapPress}
          onMapReady={() => setMapReady(true)}
          showsUserLocation
          showsMyLocationButton
        >
          {/* ── Work area ── */}
          {work && work.points.length >= 2 && !work.closed && (
            <Polyline
              coordinates={work.points.map(toRN)}
              strokeColor={WORK_COLOR}
              strokeWidth={2}
            />
          )}
          {work && work.closed && work.points.length >= 3 && (
            <Polygon
              coordinates={work.points.map(toRN)}
              strokeColor={WORK_COLOR}
              strokeWidth={2}
              fillColor="rgba(255,42,42,0.12)"
            />
          )}
          {work &&
            work.points.map((pt, i) => (
              <Marker
                key={`work-pt-${i}`}
                coordinate={toRN(pt)}
                anchor={{ x: 0.5, y: 0.5 }}
                draggable={canEdit}
                onDragEnd={(e) => onWorkMarkerDragEnd(i, e.nativeEvent.coordinate)}
                onPress={() => onWorkPointTap(i)}
                tracksViewChanges={false}
              >
                <DotMarker color={WORK_COLOR} />
              </Marker>
            ))}

          {/* ── Excavation sites ── */}
          {sites.map((site, si) => (
            <React.Fragment key={site.id}>
              {!site.closed && site.points.length >= 2 && (
                <Polyline
                  coordinates={site.points.map(toRN)}
                  strokeColor={SITE_COLOR}
                  strokeWidth={2}
                />
              )}
              {site.closed && site.points.length >= 3 && (
                <Polygon
                  coordinates={site.points.map(toRN)}
                  strokeColor={SITE_COLOR}
                  strokeWidth={2}
                  fillColor="rgba(0,212,179,0.1)"
                />
              )}
              {site.points.map((pt, pi) => (
                <Marker
                  key={`site-${si}-pt-${pi}`}
                  coordinate={toRN(pt)}
                  anchor={{ x: 0.5, y: 0.5 }}
                  draggable={canEdit}
                  onDragEnd={(e) =>
                    onSiteMarkerDragEnd(si, pi, e.nativeEvent.coordinate)
                  }
                  onPress={() => onSitePointTap(si, pi)}
                  tracksViewChanges={false}
                >
                  <DotMarker color={SITE_COLOR} />
                </Marker>
              ))}
            </React.Fragment>
          ))}

          {/* ── Artefact pins ── */}
          {artefactPins.map((pin) => (
            <Marker
              key={`artefact-${pin.id}`}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              title={pin.name}
              description={`${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`}
              pinColor="#FFA726"
            />
          ))}
        </MapView>
      )}

      {/* ── Toolbar ── */}
      {canEdit && (
        <View style={styles.toolbox}>
          <TouchableOpacity
            style={[styles.btn, mode === "work" && styles.btnActiveWork]}
            onPress={() => setMode("work")}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, mode === "work" && styles.btnTextActive]}>
              Zonă lucru
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, mode === "site" && styles.btnActiveSite]}
            onPress={() => setMode("site")}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, mode === "site" && styles.btnTextActive]}>
              Sit
            </Text>
          </TouchableOpacity>

          {(canCloseWork || canCloseSite) && (
            <TouchableOpacity
              style={[styles.btn, styles.btnClose]}
              onPress={closeActiveShape}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>Închide</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.btn}
            onPress={resetAll}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Map-tiles loading overlay ── */}
      {!loading && !mapReady && (
        <View style={styles.tilesOverlay} pointerEvents="none">
          <Text style={styles.tilesHint}>
            {"Ecranul alb dispare în câteva secunde pe măsură ce se încarcă harta."}
          </Text>
        </View>
      )}

      {/* ── Hint label ── */}
      {canEdit && !loading && !selectedPoint && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            {mode === "work"
              ? work
                ? work.closed
                  ? "Zonă lucru finalizată · Glisează markeri / Apasă pe punct pt coordonate exacte"
                  : `${work.points.length} puncte · Apasă «Închide» când ai ≥3 puncte`
                : "Apasă pe hartă pentru a începe zona de lucru"
              : activeSite != null && sites[activeSite] && !sites[activeSite].closed
                ? `${sites[activeSite].points.length} puncte · Apasă «Închide» când ai ≥3 puncte`
                : "Apasă pe hartă pentru a adăuga un sit"}
          </Text>
        </View>
      )}

      {/* ── Coordinate edit panel ── */}
      {selectedPoint && (
        <View style={styles.coordPanel}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "#F5F5F5", fontWeight: "700", fontSize: 14 }}>
              <Ionicons
                name="location"
                size={14}
                color={selectedPoint.shapeType === "work" ? WORK_COLOR : SITE_COLOR}
              />{" "}
              {selectedPoint.shapeType === "work" ? "Work" : "Site"} Point #
              {selectedPoint.pointIndex + 1}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedPoint(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#9A9A9A" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#666", fontSize: 11, marginBottom: 3 }}>
                Latitude
              </Text>
              <TextInput
                style={styles.coordInput}
                value={editLat}
                onChangeText={setEditLat}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#666", fontSize: 11, marginBottom: 3 }}>
                Longitude
              </Text>
              <TextInput
                style={styles.coordInput}
                value={editLng}
                onChangeText={setEditLng}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.btn, { flex: 1, alignItems: "center" }]}
              onPress={() => setSelectedPoint(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                {
                  flex: 1,
                  alignItems: "center",
                  backgroundColor:
                    selectedPoint.shapeType === "work" ? WORK_COLOR : SITE_COLOR,
                  borderColor:
                    selectedPoint.shapeType === "work" ? WORK_COLOR : SITE_COLOR,
                },
              ]}
              onPress={applyCoordinateEdit}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: "#111111" }]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#111111",
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingHint: {
    color: "#999999",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  loadingSubHint: {
    color: "#555555",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  tilesOverlay: {
    position: "absolute",
    bottom: 72,
    left: 16,
    right: 16,
    backgroundColor: "rgba(17,17,17,0.75)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  tilesHint: {
    color: "#555555",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  toolbox: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
    zIndex: 10,
  },
  btn: {
    backgroundColor: "rgba(26,26,26,0.92)",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnActiveWork: {
    backgroundColor: "#FF2A2A",
    borderColor: "#FF2A2A",
  },
  btnActiveSite: {
    backgroundColor: "#00d4b3",
    borderColor: "#00d4b3",
  },
  btnClose: {
    backgroundColor: "rgba(255,200,42,0.15)",
    borderColor: "#FFC82A",
  },
  btnText: {
    color: "#F5F5F5",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.4,
  },
  btnTextActive: {
    color: "#111111",
  },
  hint: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(17,17,17,0.85)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  hintText: {
    color: "#999999",
    fontSize: 12,
    textAlign: "center",
  },
  coordPanel: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(17,17,17,0.95)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 16,
  },
  coordInput: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: "#F5F5F5",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    fontVariant: ["tabular-nums"] as any,
  },
});

export default MapEditorMobile;
