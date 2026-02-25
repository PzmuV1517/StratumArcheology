import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
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

import { projectService } from "../../services/projectService";

// ─── Types ────────────────────────────────────────────────────────────────────

type LatLng = { lat: number; lng: number };
type Mode = "work" | "site";

type Shape = {
  id: string;
  points: LatLng[];
  closed: boolean;
  color: string;
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
                  tracksViewChanges={false}
                >
                  <DotMarker color={SITE_COLOR} />
                </Marker>
              ))}
            </React.Fragment>
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
      {canEdit && !loading && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            {mode === "work"
              ? work
                ? work.closed
                  ? "Zonă lucru finalizată · Glisează markeri pentru a ajusta"
                  : `${work.points.length} puncte · Apasă «Închide» când ai ≥3 puncte`
                : "Apasă pe hartă pentru a începe zona de lucru"
              : activeSite != null && sites[activeSite] && !sites[activeSite].closed
                ? `${sites[activeSite].points.length} puncte · Apasă «Închide» când ai ≥3 puncte`
                : "Apasă pe hartă pentru a adăuga un sit"}
          </Text>
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
});

export default MapEditorMobile;
