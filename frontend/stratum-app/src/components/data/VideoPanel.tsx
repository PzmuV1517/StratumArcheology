import React from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { View, StyleSheet } from "react-native";

interface Props {
  src: string | null;
}

const guessType = (url: string) => {
  const u = url.split("?")[0].toLowerCase();
  if (u.endsWith(".webm")) return "video/webm";
  if (u.endsWith(".ogg") || u.endsWith(".ogv")) return "video/ogg";
  if (u.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
};

export default function VideoPanel({ src }: Props) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const playerRef = React.useRef<any>(null);
  React.useEffect(() => {
    if (videoRef.current && src) {
      playerRef.current = videojs(videoRef.current, {
        controls: true,
        sources: [{ src, type: guessType(src) }],
      });
    }
    return () => {
      if (playerRef.current) playerRef.current.dispose();
    };
  }, [src]);
  return (
    <View style={styles.container}>
      <video ref={videoRef} className="video-js vjs-default-skin" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
