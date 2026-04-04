import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type MonumentPinPickerProps = {
  value: unknown;
  editable: boolean;
  monumentCoordinate?: { latitude: number; longitude: number } | null;
  onChange: (nextValue: string) => void;
};

type Coordinates = { latitude: number; longitude: number };

const ROMANIA_MAP_DEFAULT: Coordinates = { latitude: 45.9432, longitude: 24.9668 };

function parsePinValue(value: unknown): Coordinates | null {
  if (typeof value !== "string") return null;
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function formatPinValue(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

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

export default function MonumentPinPicker({
  value,
  editable,
  monumentCoordinate,
  onChange,
}: MonumentPinPickerProps) {
  useInjectLeafletCss();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const editableRef = useRef(editable);
  const onChangeRef = useRef(onChange);
  editableRef.current = editable;
  onChangeRef.current = onChange;

  const pinCoordinate = useMemo(() => parsePinValue(value), [value]);
  const mapCenter = pinCoordinate || monumentCoordinate || ROMANIA_MAP_DEFAULT;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapContainerRef.current) return;
      if (!LRef.current) {
        try {
          const mod: any = await import("leaflet");
          if (cancelled) return;
          LRef.current = mod.default ?? mod;
          setLeafletReady(true);
        } catch {
          setLeafletReady(false);
        }
      } else {
        setLeafletReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const L = LRef.current;
    if (!leafletReady || !L || !mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [mapCenter.latitude, mapCenter.longitude],
        zoom: pinCoordinate ? 16 : 7,
        preferCanvas: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OSM & CARTO",
      }).addTo(map);

      map.on("click", (event: any) => {
        if (!editableRef.current) return;
        const { lat, lng } = event.latlng;
        onChangeRef.current(formatPinValue(lat, lng));
      });

      mapRef.current = map;
    }

    const map = mapRef.current;

    if (pinCoordinate) {
      if (!markerRef.current) {
        markerRef.current = L.marker([pinCoordinate.latitude, pinCoordinate.longitude], {
          draggable: editableRef.current,
        }).addTo(map);

        markerRef.current.on("dragend", (event: any) => {
          if (!editableRef.current) return;
          const ll = event.target.getLatLng();
          onChangeRef.current(formatPinValue(ll.lat, ll.lng));
        });
      } else {
        markerRef.current.setLatLng([pinCoordinate.latitude, pinCoordinate.longitude]);
        markerRef.current.dragging?.[editableRef.current ? "enable" : "disable"]?.();
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [leafletReady, pinCoordinate, mapCenter.latitude, mapCenter.longitude]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove?.();
      markerRef.current = null;
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, []);

  return (
    <View style={styles.pinInputGroup}>
      <div ref={mapContainerRef} style={styles.pinMap as any} />
      <Text style={styles.pinHelperText}>
        Click pe harta pentru a seta PIN-ul exact. Marker-ul poate fi tras pentru ajustare fina.
      </Text>
      <Text style={styles.pinValueText}>
        {pinCoordinate
          ? `PIN: ${formatPinValue(pinCoordinate.latitude, pinCoordinate.longitude)}`
          : "PIN necompletat"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pinInputGroup: {
    gap: 6,
  },
  pinMap: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#303030",
  },
  pinHelperText: {
    color: "#9F9F9F",
    fontSize: 11,
  },
  pinValueText: {
    color: "#DADADA",
    fontSize: 12,
    fontWeight: "600",
  },
});
