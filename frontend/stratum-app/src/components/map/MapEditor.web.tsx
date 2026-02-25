import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { projectService } from "../../services/projectService";

// Avoid importing 'leaflet' at module scope to prevent SSR "window is not defined".
// We'll dynamic-import it on the client inside useEffect.
type LatLngLiteral = { lat: number; lng: number };

type Mode = "work" | "site";

type Shape = {
  id: string;
  points: LatLngLiteral[];
  closed: boolean;
  markers: any[];
  layer: any;
  color: string;
};

function useInjectLeafletCss() {
  useEffect(() => {
    const id = "leaflet-css";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.crossOrigin = "";
    document.head.appendChild(link);
  }, []);
}

function pixelDist(a: any, b: any) {
  const dx = a.x - b.x,
    dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export default function MapEditor({
  projectId,
  canEdit = true,
}: {
  projectId: string;
  canEdit?: boolean;
}) {
  useInjectLeafletCss();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const [mode, setMode] = useState<Mode>("work");
  const [work, _setWork] = useState<Shape | null>(null);
  const [sites, _setSites] = useState<Shape[]>([]);
  const [activeSite, _setActiveSite] = useState<number | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  // Refs to avoid stale closures inside Leaflet event handlers
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

  const workColor = "#FF2A2A";
  const siteColor = "#00d4b3";

  // Debounced save handling
  const saveTimer = useRef<any>(null);
  const saveNow = async () => {
    if (!projectId || !canEdit) return; // Permission check: don't save if guest
    const curWork = workRef.current;
    const curSites = sitesRef.current || [];
    // Persist only CLOSED site polygons per requirement; work area can be saved open or closed
    const closedSites = curSites.filter((s) => !!s.closed);
    const payload = {
      work: curWork ? { points: curWork.points, closed: !!curWork.closed } : null,
      sites: closedSites.map((s) => ({ points: s.points, closed: !!s.closed })),
    };
    try {
      await projectService.setGps(projectId, payload);
    } catch {}
  };
  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, 800);
  };

  // Flush any pending save when the component unmounts or page is being hidden
  useEffect(() => {
    const onPageHide = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveNow();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") onPageHide();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveNow();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Load Leaflet dynamically on the client and initialize the map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current) return;
      if (!LRef.current) {
        try {
          const mod: any = await import("leaflet");
          if (cancelled) return;
          LRef.current = mod.default ?? mod;
          setLeafletReady(true);
        } catch {}
      } else {
        setLeafletReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize and update map interactions when state changes
  useEffect(() => {
    const L = LRef.current;
    if (!leafletReady || !L || !containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [45.9432, 24.9668],
        zoom: 6,
        preferCanvas: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OSM & CARTO",
      }).addTo(map);
      mapRef.current = map;
    }

    const map = mapRef.current as any;

    const getIcon = (color: string) =>
      (L as any).divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;border:2px solid ${color};background:#111111;border-radius:50%;box-shadow:0 0 0 1px #0A0A0A"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

    const onClick = (e: any) => {
      // Permission check: guests cannot edit the map
      if (!canEdit) return;

      const ll = e.latlng.wrap();
      const curWork = workRef.current;
      const curSites = sitesRef.current;
      const curActiveSite = activeSiteRef.current;

      if (mode === "work") {
        if (!curWork) {
          const shape: Shape = {
            id: "work",
            points: [ll],
            closed: false,
            markers: [],
            layer: null,
            color: workColor,
          };
          const mk = (L as any)
            .marker(ll, { draggable: true, icon: getIcon(workColor) })
            .addTo(map);
          mk.on("drag", (ev: any) => onMarkerDragWorkByMarker(ev));
          mk.on("dragend", async (ev: any) => {
            onMarkerDragWorkByMarker(ev);
            await saveNow();
          });
          shape.markers.push(mk);
          shape.layer = (L as any)
            .polyline(shape.points, { color: workColor, weight: 2, opacity: 0.9 })
            .addTo(map);
          setWorkSync({ ...shape });
          // Save immediately so incomplete shapes persist if user navigates away
          saveNow();
          return;
        }
        if (!curWork.closed) {
          const shouldClose = canClose(curWork.points[0], ll);
          if (curWork.points.length >= 3 && shouldClose) {
            const newPts = curWork.points.slice();
            const poly = curWork.layer as any;
            if (poly) map.removeLayer(poly);
            const polygon = (L as any)
              .polygon(newPts, {
                color: workColor,
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.1,
              })
              .addTo(map);
            const updated: Shape = { ...curWork, closed: true, layer: polygon };
            setWorkSync(updated);
            saveNow();
          } else {
            const idx = curWork.points.length;
            const newPts = [...curWork.points, ll];
            const poly = curWork.layer as any;
            if (poly) poly.setLatLngs(newPts as any);
            const mk = (L as any)
              .marker(ll, { draggable: true, icon: getIcon(workColor) })
              .addTo(map);
            mk.on("drag", (ev: any) => onMarkerDragWorkByMarker(ev));
            mk.on("dragend", async (ev: any) => {
              onMarkerDragWorkByMarker(ev);
              await saveNow();
            });
            const mks = curWork.markers.concat(mk);
            setWorkSync({ ...curWork, points: newPts, markers: mks });
            saveNow();
          }
        }
      } else {
        if (curActiveSite == null || curSites[curActiveSite]?.closed) {
          const shape: Shape = {
            id: `site-${Date.now()}`,
            points: [ll],
            closed: false,
            markers: [],
            layer: null,
            color: siteColor,
          };
          const mk = (L as any)
            .marker(ll, { draggable: true, icon: getIcon(siteColor) })
            .addTo(map);
          mk.on("drag", (ev: any) => onMarkerDragSiteByMarker(ev));
          mk.on("dragend", async (ev: any) => {
            onMarkerDragSiteByMarker(ev);
            await saveNow();
          });
          shape.markers.push(mk);
          shape.layer = (L as any)
            .polyline(shape.points, { color: siteColor, weight: 2, opacity: 0.9 })
            .addTo(map);
          setSitesSync([...curSites, shape]);
          setActiveSiteSync(curSites.length);
          saveNow();
          return;
        }
        const cur = curSites[curActiveSite];
        if (!cur.closed) {
          const shouldClose = canClose(cur.points[0], ll);
          if (cur.points.length >= 3 && shouldClose) {
            const newPts = cur.points.slice();
            if (cur.layer) map.removeLayer(cur.layer);
            const polygon = (L as any)
              .polygon(newPts, {
                color: siteColor,
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.08,
              })
              .addTo(map);
            const updated = curSites.slice();
            updated[curActiveSite] = { ...cur, closed: true, layer: polygon };
            setSitesSync(updated);
            saveNow();
          } else {
            const idx = cur.points.length;
            const newPts = [...cur.points, ll];
            (cur.layer as any)?.setLatLngs(newPts as any);
            const mk = (L as any)
              .marker(ll, { draggable: true, icon: getIcon(siteColor) })
              .addTo(map);
            mk.on("drag", (ev: any) => onMarkerDragSiteByMarker(ev));
            mk.on("dragend", async (ev: any) => {
              onMarkerDragSiteByMarker(ev);
              await saveNow();
            });
            const updated = curSites.slice();
            const mks = cur.markers.concat(mk);
            updated[curActiveSite] = { ...cur, points: newPts, markers: mks };
            setSitesSync(updated);
            saveNow();
          }
        }
      }
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [leafletReady, mode, work, sites, activeSite]);

  const canClose = (first: LatLngLiteral, click: LatLngLiteral) => {
    const map = mapRef.current;
    if (!map) return false;
    const p1 = map.latLngToContainerPoint(first as any);
    const p2 = map.latLngToContainerPoint(click as any);
    return pixelDist(p1, p2) <= 12;
  };

  const onMarkerDragWorkByMarker = (e: any) => {
    const map = mapRef.current;
    if (!map) return;
    const marker = e.target;
    const curWork = workRef.current;
    if (!curWork) return;
    const idx = curWork.markers.indexOf(marker);
    if (idx < 0) return;
    const ll = marker.getLatLng();
    const pts = curWork.points.slice();
    pts[idx] = { lat: ll.lat, lng: ll.lng };
    if (curWork.closed) (curWork.layer as any)?.setLatLngs(pts as any);
    else (curWork.layer as any)?.setLatLngs(pts as any);
    setWorkSync({ ...curWork, points: pts });
    scheduleSave();
  };

  const onMarkerDragSiteByMarker = (e: any) => {
    const map = mapRef.current;
    if (!map) return;
    const marker = e.target;
    const curSites = sitesRef.current || [];
    const siteIdx = curSites.findIndex((s) => s.markers.includes(marker));
    if (siteIdx < 0) return;
    const cur = curSites[siteIdx];
    const idx = cur.markers.indexOf(marker);
    if (idx < 0) return;
    const ll = marker.getLatLng();
    const pts = cur.points.slice();
    pts[idx] = { lat: ll.lat, lng: ll.lng };
    if (cur.closed) (cur.layer as any)?.setLatLngs(pts as any);
    else (cur.layer as any)?.setLatLngs(pts as any);
    const updated = curSites.slice();
    updated[siteIdx] = { ...cur, points: pts };
    setSitesSync(updated);
    scheduleSave();
  };

  const resetAll = () => {
    const map = mapRef.current;
    if (map) {
      const curWork = workRef.current;
      const curSites = sitesRef.current || [];
      if (curWork) {
        curWork.markers.forEach((m) => m.remove());
        curWork.layer?.remove();
      }
      curSites.forEach((s) => {
        s.markers.forEach((m) => m.remove());
        s.layer?.remove();
      });
    }
    setWorkSync(null);
    setSitesSync([]);
    setActiveSiteSync(null);
    saveNow();
  };

  // Load from backend when ready and projectId changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!leafletReady || !projectId || !mapRef.current || !LRef.current) return;
      try {
        const L = LRef.current;
        const map = mapRef.current;
        const state = await projectService.getGps(projectId);
        // Clear existing
        const curWork = workRef.current;
        const curSites = sitesRef.current || [];
        if (curWork) {
          curWork.markers.forEach((m) => m.remove());
          curWork.layer && map.removeLayer(curWork.layer);
          setWorkSync(null);
        }
        if (curSites.length) {
          curSites.forEach((s) => {
            s.markers.forEach((m) => m.remove());
            s.layer && map.removeLayer(s.layer);
          });
          setSitesSync([]);
          setActiveSiteSync(null);
        }
        // Rehydrate work
        if (state?.work?.points?.length) {
          const pts = state.work.points.map((p: any) => ({
            lat: p.lat,
            lng: p.lng,
          }));
          const shape: Shape = {
            id: "work",
            points: [],
            closed: !!state.work.closed,
            markers: [],
            layer: null,
            color: workColor,
          };
          // markers
          pts.forEach((ll: any) => {
            const mk = (L as any)
              .marker(ll, {
                draggable: true,
                icon: (L as any).divIcon({
                  className: "",
                  html: `<div style=\"width:12px;height:12px;border:2px solid ${workColor};background:#111111;border-radius:50%\"></div>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6],
                }),
              })
              .addTo(map);
            mk.on("drag", (ev: any) => onMarkerDragWorkByMarker(ev));
            mk.on("dragend", async (ev: any) => {
              onMarkerDragWorkByMarker(ev);
              await saveNow();
            });
            shape.markers.push(mk);
            shape.points.push(ll);
          });
          // layer
          if (shape.closed && shape.points.length >= 3) {
            shape.layer = (L as any)
              .polygon(shape.points, {
                color: workColor,
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.1,
              })
              .addTo(map);
          } else {
            shape.layer = (L as any)
              .polyline(shape.points, { color: workColor, weight: 2, opacity: 0.9 })
              .addTo(map);
          }
          setWorkSync(shape);
        }
        // Rehydrate sites
        if (state?.sites?.length) {
          const reSites: Shape[] = [];
          // Only rehydrate CLOSED site polygons
          (state.sites || [])
            .filter((s: any) => !!s.closed)
            .forEach((s: any) => {
              const pts = (s.points || []).map((p: any) => ({
                lat: p.lat,
                lng: p.lng,
              }));
              const shape: Shape = {
                id: `site-${Date.now()}-${Math.random()}`,
                points: [],
                closed: !!s.closed,
                markers: [],
                layer: null,
                color: siteColor,
              };
              pts.forEach((ll: any) => {
                const mk = (L as any)
                  .marker(ll, {
                    draggable: true,
                    icon: (L as any).divIcon({
                      className: "",
                      html: `<div style=\"width:12px;height:12px;border:2px solid ${siteColor};background:#111111;border-radius:50%\"></div>`,
                      iconSize: [12, 12],
                      iconAnchor: [6, 6],
                    }),
                  })
                  .addTo(map);
                mk.on("drag", (ev: any) => onMarkerDragSiteByMarker(ev));
                mk.on("dragend", async (ev: any) => {
                  onMarkerDragSiteByMarker(ev);
                  await saveNow();
                });
                shape.markers.push(mk);
                shape.points.push(ll);
              });
              if (shape.closed && shape.points.length >= 3) {
                shape.layer = (L as any)
                  .polygon(shape.points, {
                    color: siteColor,
                    weight: 2,
                    opacity: 0.9,
                    fillOpacity: 0.08,
                  })
                  .addTo(map);
              } else {
                shape.layer = (L as any)
                  .polyline(shape.points, {
                    color: siteColor,
                    weight: 2,
                    opacity: 0.9,
                  })
                  .addTo(map);
              }
              reSites.push(shape);
            });
          setSitesSync(reSites);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [leafletReady, projectId]);

  return (
    <View style={styles.wrapper}>
      {canEdit && (
        <View style={styles.toolbox}>
          <TouchableOpacity
            style={[styles.btn, mode === "work" && styles.btnActive]}
            onPress={() => setMode("work")}
          >
            <Text style={[styles.btnText, mode === "work" && styles.btnTextActive]}>
              Zonă lucru
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, mode === "site" && styles.btnActive]}
            onPress={() => setMode("site")}
          >
            <Text style={[styles.btnText, mode === "site" && styles.btnTextActive]}>
              Sit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={resetAll}>
            <Text style={styles.btnText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#111111" },
  toolbox: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 1000,
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnActive: { backgroundColor: "#FF2A2A", borderColor: "#FF2A2A" },
  btnText: { color: "#F5F5F5", fontWeight: "700", letterSpacing: 0.5 },
  btnTextActive: { color: "#111111" },
});
