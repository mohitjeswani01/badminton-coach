import { useState, useEffect, useRef, useCallback } from "react";

export interface TelemetryPayload {
    type?: string;
    // Nested structure from main.py
    smash?: {
        is_smash: boolean;
        arm_angle: number;
        racket_arm: string;
    };
    stance?: {
        is_ready_stance: boolean;
        avg_knee_flexion: number;
        torso_angle: number;
    };

    // Flat structure from test_connection.py
    arm_angle?: number;
    avg_knee_flexion?: number;
    is_smash?: boolean;
    feedback?: string;
    text?: string;
    timestamp?: number;

    // Array of keypoint objects for pose rendering
    keypoints?: { name: string, x: number, y: number, confidence: number }[];
}

const defaultWsUrl = `${(import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000").replace(/^http/, 'ws')}/ws/telemetry`;

export function useCoachTelemetry(url = defaultWsUrl) {
    const [isConnected, setIsConnected] = useState(false);
    const [latestPayload, setLatestPayload] = useState<TelemetryPayload | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);

    // Throttle updates to ~15 fps (every ~66ms) to prevent UI thrashing
    const THROTTLE_MS = 66;

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                console.log("WebSocket connected to telemetry");
            };

            ws.onmessage = (event) => {
                const now = Date.now();
                try {
                    const data: TelemetryPayload = JSON.parse(event.data);
                    // Always process if it has feedback or is a direct transcript to avoid dropping text, otherwise throttle
                    if (data.feedback || data.type === "transcript" || data.type === "pose_telemetry" || now - lastUpdateRef.current >= THROTTLE_MS) {
                        setLatestPayload(data);
                        lastUpdateRef.current = now;
                    }
                } catch (e) {
                    console.error("Failed to parse telemetry payload", e);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                // Automatic reconnection fallback
                reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
            };

            ws.onerror = (err) => {
                console.error("WebSocket telemetry error", err);
                ws.close();
            };
        } catch (e) {
            console.error("WebSocket setup error:", e);
            // Attempt reconnect if setup fails
            reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
        }
    }, [url]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    return { isConnected, latestPayload };
}
