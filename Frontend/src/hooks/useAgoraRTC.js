import { useState, useEffect, useRef, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

// Log configuration: 0 (DEBUG), 1 (INFO), 2 (WARNING), 3 (ERROR), 4 (NONE)
AgoraRTC.setLogLevel(0);

/**
 * Custom Hook for managing Agora RTC Video and Voice Calls
 */
export default function useAgoraRTC() {
    const [joined, setJoined] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionState, setConnectionState] = useState("DISCONNECTED");
    const [error, setError] = useState(null);

    // Track states
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // Local & Remote user states
    const [localTracks, setLocalTracks] = useState({ audioTrack: null, videoTrack: null });
    const [remoteUsers, setRemoteUsers] = useState([]);

    // Client & Track refs
    const clientRef = useRef(null);
    const isJoiningRef = useRef(false);
    const isLeavingRef = useRef(false);
    const localAudioTrackRef = useRef(null);
    const localVideoTrackRef = useRef(null);
    const screenTrackRef = useRef(null);

    /**
     * Initialize & Join Agora RTC Channel
     */
    const joinChannel = useCallback(async ({ appId, channelName, token, uid, callType = "video" }) => {
        if (!appId || !channelName) {
            setError("Missing Agora App ID or Channel Name.");
            return;
        }

        if (isJoiningRef.current) {
            console.log("[Agora RTC] Join already in progress, skipping duplicate call.");
            return;
        }

        if (clientRef.current && clientRef.current.connectionState === "CONNECTED") {
            console.log("[Agora RTC] Already connected to channel.");
            return;
        }

        try {
            isJoiningRef.current = true;
            isLeavingRef.current = false;
            setConnecting(true);
            setConnectionState("CONNECTING");
            setError(null);

            // Cleanup any existing client before recreating
            if (clientRef.current) {
                try {
                    await clientRef.current.leave().catch(() => {});
                    clientRef.current.removeAllListeners();
                } catch (_) {}
                clientRef.current = null;
            }

            // Create RTC Client
            console.log(`[Agora RTC] Creating client for App ID: ${appId}, Channel: ${channelName}`);
            const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            clientRef.current = client;

            // Connection state listener
            client.on("connection-state-change", (curState, revState, reason) => {
                console.log(`[Agora RTC] Connection state change: ${revState} -> ${curState} (${reason || "normal"})`);
                setConnectionState(curState);

                if (curState === "CONNECTED") {
                    setJoined(true);
                    setConnecting(false);
                    setError(null);
                } else if (curState === "DISCONNECTED") {
                    setJoined(false);
                    if (reason && reason !== "LEAVE" && !isLeavingRef.current) {
                        setError(`Agora connection disconnected: ${reason}`);
                    }
                }
            });

            // 1. Remote user joined room listener
            client.on("user-joined", (user) => {
                console.log(`[Agora RTC] 👤 Remote user joined channel: UID=${user.uid}`);
                setRemoteUsers((prev) => {
                    const exists = prev.some((u) => u.uid === user.uid);
                    if (exists) return prev;
                    return [...prev, { ...user, hasVideo: !!user.videoTrack, hasAudio: !!user.audioTrack }];
                });
            });

            // 2. Remote user published media listener
            client.on("user-published", async (user, mediaType) => {
                console.log(`[Agora RTC] 📡 Remote user published: UID=${user.uid}, mediaType=${mediaType}`);
                try {
                    await client.subscribe(user, mediaType);
                    console.log(`[Agora RTC] ✅ Subscribed to UID=${user.uid}, mediaType=${mediaType}`);

                    setRemoteUsers((prev) => {
                        const filtered = prev.filter((u) => u.uid !== user.uid);
                        return [
                            ...filtered,
                            {
                                ...user,
                                videoTrack: user.videoTrack,
                                audioTrack: user.audioTrack,
                                hasVideo: !!user.videoTrack,
                                hasAudio: !!user.audioTrack,
                            },
                        ];
                    });

                    if (mediaType === "audio") {
                        user.audioTrack?.play();
                    }
                } catch (subErr) {
                    console.error("[Agora RTC] Subscribe error:", subErr);
                }
            });

            // 3. Remote user unpublished media listener
            client.on("user-unpublished", (user, mediaType) => {
                console.log(`[Agora RTC] 📴 Remote user unpublished: UID=${user.uid}, mediaType=${mediaType}`);
                if (mediaType === "audio") {
                    user.audioTrack?.stop();
                }
                setRemoteUsers((prev) => {
                    return prev.map((u) => {
                        if (u.uid === user.uid) {
                            return {
                                ...user,
                                videoTrack: user.videoTrack,
                                audioTrack: user.audioTrack,
                                hasVideo: !!user.videoTrack,
                                hasAudio: !!user.audioTrack,
                            };
                        }
                        return u;
                    });
                });
            });

            // 4. Remote user left channel listener
            client.on("user-left", (user, reason) => {
                console.log(`[Agora RTC] 🚪 Remote user left channel: UID=${user.uid}, reason=${reason}`);
                setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
            });

            // Join Channel
            const targetUid = uid ? Number(uid) : null;
            console.log(`[Agora RTC] Attempting to join channel '${channelName}' with UID: ${targetUid}, token present: ${Boolean(token)}`);

            const joinedUid = await client.join(appId, channelName, token || null, targetUid);
            console.log(`[Agora RTC] 🎉 Joined successfully with UID: ${joinedUid}`);

            // Check if remote users already exist in channel
            if (client.remoteUsers && client.remoteUsers.length > 0) {
                console.log(`[Agora RTC] Found ${client.remoteUsers.length} existing remote user(s) in channel.`);
                for (const existingUser of client.remoteUsers) {
                    if (existingUser.hasAudio) {
                        try {
                            await client.subscribe(existingUser, "audio");
                            existingUser.audioTrack?.play();
                        } catch (e) {
                            console.warn("Error subscribing existing audio:", e);
                        }
                    }
                    if (existingUser.hasVideo) {
                        try {
                            await client.subscribe(existingUser, "video");
                        } catch (e) {
                            console.warn("Error subscribing existing video:", e);
                        }
                    }
                }
                setRemoteUsers(
                    client.remoteUsers.map((u) => ({
                        ...u,
                        videoTrack: u.videoTrack,
                        audioTrack: u.audioTrack,
                        hasVideo: !!u.videoTrack,
                        hasAudio: !!u.audioTrack,
                    }))
                );
            }

            // Create Local Tracks
            const tracksToPublish = [];

            // 1. Microphone audio track
            try {
                const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                    AEC: true,
                    ANS: true,
                });
                localAudioTrackRef.current = audioTrack;
                tracksToPublish.push(audioTrack);
            } catch (micErr) {
                console.warn("[Agora RTC] Microphone not available or busy:", micErr.message);
            }

            // 2. Camera video track (if callType === 'video')
            if (callType === "video") {
                try {
                    const videoTrack = await AgoraRTC.createCameraVideoTrack({
                        encoderConfig: "720p_1",
                    });
                    localVideoTrackRef.current = videoTrack;
                    tracksToPublish.push(videoTrack);
                } catch (camErr) {
                    console.warn("[Agora RTC] Camera not available or busy in another tab/app:", camErr.message);
                    setIsVideoMuted(true);
                }
            } else {
                setIsVideoMuted(true);
            }

            // Publish local tracks if client is connected and not currently leaving
            if (tracksToPublish.length > 0 && client.connectionState === "CONNECTED") {
                await client.publish(tracksToPublish);
                console.log(`[Agora RTC] Published ${tracksToPublish.length} local track(s).`);
            }

            setLocalTracks({
                audioTrack: localAudioTrackRef.current,
                videoTrack: localVideoTrackRef.current,
            });

            setJoined(true);
            setConnecting(false);
            setConnectionState("CONNECTED");
            setIsAudioMuted(false);
            if (callType === "video") {
                setIsVideoMuted(!localVideoTrackRef.current);
            }
        } catch (err) {
            console.error("[Agora RTC] Join Error:", err);
            setConnecting(false);
            setJoined(false);
            setConnectionState("DISCONNECTED");

            // Ignore intentional abort cancellations
            if (
                err.code === "OPERATION_ABORTED" || 
                err.message?.includes("cancel token canceled") || 
                err.message?.includes("OPERATION_ABORTED")
            ) {
                console.log("[Agora RTC] In-flight join was safely cancelled.");
                return;
            }

            const errCode = err.code || err.name || "AgoraError";
            let friendlyMessage = `[${errCode}] ${err.message || "Failed to connect to Agora room."}`;

            if (err.code === "DYNAMIC_KEY_TIMEOUT" || err.code === "CAN_NOT_GET_GATEWAY_SERVER" || err.message?.includes("token")) {
                friendlyMessage = `[Agora Auth Failed: ${err.code || "TokenError"}] ${err.message || "Please restart backend server so AGORA_APP_CERTIFICATE is loaded from backend/.env."}`;
            } else if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
                friendlyMessage = "Camera or microphone permission denied. Please allow device access in your browser URL bar.";
            }
            setError(friendlyMessage);
        } finally {
            isJoiningRef.current = false;
        }
    }, []);

    /**
     * Toggle Local Audio (Mute / Unmute)
     */
    const toggleAudio = useCallback(async () => {
        if (!localAudioTrackRef.current) return;
        try {
            const nextState = !isAudioMuted;
            await localAudioTrackRef.current.setEnabled(!nextState);
            setIsAudioMuted(nextState);
        } catch (err) {
            console.error("Error toggling audio:", err);
        }
    }, [isAudioMuted]);

    /**
     * Toggle Local Video (Camera On / Off)
     */
    const toggleVideo = useCallback(async () => {
        try {
            if (!localVideoTrackRef.current) {
                const videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: "720p_1",
                });
                localVideoTrackRef.current = videoTrack;
                setLocalTracks((prev) => ({ ...prev, videoTrack }));
                if (clientRef.current && clientRef.current.connectionState === "CONNECTED") {
                    await clientRef.current.publish(videoTrack);
                }
                setIsVideoMuted(false);
                return;
            }

            const nextState = !isVideoMuted;
            await localVideoTrackRef.current.setEnabled(!nextState);
            setIsVideoMuted(nextState);
        } catch (err) {
            console.error("Error toggling video:", err);
        }
    }, [isVideoMuted]);

    /**
     * Toggle Screen Sharing
     */
    const toggleScreenShare = useCallback(async () => {
        if (!clientRef.current || clientRef.current.connectionState !== "CONNECTED") return;

        try {
            if (isScreenSharing) {
                if (screenTrackRef.current) {
                    await clientRef.current.unpublish(screenTrackRef.current);
                    screenTrackRef.current.close();
                    screenTrackRef.current = null;
                }
                if (localVideoTrackRef.current && !isVideoMuted) {
                    await clientRef.current.publish(localVideoTrackRef.current);
                }
                setIsScreenSharing(false);
            } else {
                const screenTrack = await AgoraRTC.createScreenVideoTrack({
                    encoderConfig: "1080p_1",
                });
                screenTrackRef.current = screenTrack;

                if (localVideoTrackRef.current) {
                    await clientRef.current.unpublish(localVideoTrackRef.current);
                }
                await clientRef.current.publish(screenTrack);

                screenTrack.on("track-ended", () => {
                    toggleScreenShare();
                });

                setIsScreenSharing(true);
            }
        } catch (err) {
            console.error("Screen share error:", err);
        }
    }, [isScreenSharing, isVideoMuted]);

    /**
     * Leave Agora RTC Channel & Cleanup
     */
    const leaveChannel = useCallback(async () => {
        isLeavingRef.current = true;
        try {
            if (localAudioTrackRef.current) {
                localAudioTrackRef.current.stop();
                localAudioTrackRef.current.close();
                localAudioTrackRef.current = null;
            }

            if (localVideoTrackRef.current) {
                localVideoTrackRef.current.stop();
                localVideoTrackRef.current.close();
                localVideoTrackRef.current = null;
            }

            if (screenTrackRef.current) {
                screenTrackRef.current.stop();
                screenTrackRef.current.close();
                screenTrackRef.current = null;
            }

            if (clientRef.current) {
                if (clientRef.current.connectionState === "CONNECTED" || clientRef.current.connectionState === "CONNECTING") {
                    await clientRef.current.leave().catch(() => {});
                }
                clientRef.current.removeAllListeners();
                clientRef.current = null;
            }

            setJoined(false);
            setConnecting(false);
            setConnectionState("DISCONNECTED");
            setRemoteUsers([]);
            setLocalTracks({ audioTrack: null, videoTrack: null });
            setIsScreenSharing(false);
        } catch (err) {
            console.error("Error leaving Agora channel:", err);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            leaveChannel();
        };
    }, [leaveChannel]);

    return {
        joined,
        connecting,
        connectionState,
        error,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
        remoteUsers,
        localAudioTrack: localAudioTrackRef.current,
        localVideoTrack: localVideoTrackRef.current,
        screenTrack: screenTrackRef.current,
        joinChannel,
        leaveChannel,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
    };
}
