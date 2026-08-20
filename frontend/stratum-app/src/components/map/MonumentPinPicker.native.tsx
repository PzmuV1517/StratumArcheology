import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from "react-native-maps";

type Coordinates = { latitude: number; longitude: number };

type MonumentPinPickerProps = {
  value: unknown;
  editable: boolean;
  monumentCoordinate?: Coordinates | null;
  onChange: (nextValue: string) => void;
};

const ROMANIA_MAP_DEFAULT: Coordinates = { latitude: 45.9432, longitude: 24.9668 };

function parsePinValue(value: unknown): Coordinates | null {
  if (typeof value !== "string") return null;
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    return null;

  return { latitude, longitude };
}

function formatPinValue(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export default function MonumentPinPicker({
  value,
  editable,
  monumentCoordinate,
  onChange,
}: MonumentPinPickerProps) {
  const pinCoordinate = useMemo(() => parsePinValue(value), [value]);
  const mapCenter = pinCoordinate || monumentCoordinate || ROMANIA_MAP_DEFAULT;

  const handleMapPress = (event: MapPressEvent) => {
    if (!editable) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onChange(formatPinValue(latitude, longitude));
  };

  const handleDragEnd = (event: MarkerDragStartEndEvent) => {
    if (!editable) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onChange(formatPinValue(latitude, longitude));
  };

  return (
    <View style={styles.pinInputGroup}>
      <MapView
        style={styles.pinMap}
        initialRegion={{
          latitude: mapCenter.latitude,
          longitude: mapCenter.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
      >
        {pinCoordinate ? (
          <Marker
            coordinate={pinCoordinate}
            draggable={editable}
            onDragEnd={handleDragEnd}
          />
        ) : null}
      </MapView>
      <Text style={styles.pinHelperText}>
        Apasa pe harta pentru a seta PIN-ul exact. Poti trage marker-ul pentru
        ajustare fina.
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
