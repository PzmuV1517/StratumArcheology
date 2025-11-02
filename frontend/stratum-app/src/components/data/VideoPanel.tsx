import React from "react";
import video.js from "video.js";
import "video.js/dist/video-js.css";
import { View, StyleSheet } from "react-native";

interface Props {
    src: string | null;
}

export default function VideoPanel({ src }: Props) {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const playerRef = React.useRef<videojs.Player | null>(null);
    React.useEffect(() => {
        if (videoRef.current && src) {
            playerRef.current = videojs(videoRef.current, {
                controls: true,
                sources: [{ src, type: "video/mp4" }],
            });
        }
        return () => {
            if (playerRef.current) {
                playerRef.current.dispose();
            }
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