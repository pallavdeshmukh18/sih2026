import { useState, useEffect, useRef, useCallback } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

// Log configuration: 0 (DEBUG), 1 (INFO), 2 (WARNING), 3 (ERROR), 4 (NONE)
AgoraRTC.setLogLevel(1);

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
    const localAudioTrackRef = useRef(null);
    const localVideoTrackRef = useRef(null);
    const screenTrackRef = useRef(null);
    const currentChannelRef = useRef(null);
    const joinSeqRef = useRef(0);

    // Helper to sync remote users state directly from Agora client's internal list
    const syncRemoteUsers = useCallback(() => {
        const client = clientRef.current;
        if (!client) {
            setRemoteUsers([]);
            return;
        }
        const users = (client.remoteUsers || []).map((u) => ({
            uid: u.uid,
            videoTrack: u.videoTrack || null,
            audioTrack: u.audioTrack || null,
            hasVideo: Boolean(u.videoTrack || u.hasVideo),
            hasAudio: Boolean(u.audioTrack || u.hasAudio),
        }));
        setRemoteUsers(users);
    }, []);

    /**
     * Leave Agora RTC Channel & Cleanup tracks
     */
    const leaveChannel = useCallback(async () => {
        // Invalidate any in-flight join sequence
        const currentSeq = ++joinSeqRef.current;

        // Clean up local audio track
        if (localAudioTrackRef.current) {
            try {
                localAudioTrackRef.current.stop();
                localAudioTrackRef.current.close();
            } catch (_) {}
            localAudioTrackRef.current = null;
        }

        // Clean up local video track
        if (localVideoTrackRef.current) {
            try {
                localVideoTrackRef.current.stop();
                localVideoTrackRef.current.close();
            } catch (_) {}
            localVideoTrackRef.current = null;
        }

        // Clean up screen sharing track
        if (screenTrackRef.current) {
            try {
                screenTrackRef.current.stop();
                screenTrackRef.current.close();
            } catch (_) {}
            screenTrackRef.current = null;
        }

        // Clean up client
        const client = clientRef.current;
        if (client) {
            try {
                client.removeAllListeners();
                if (client.connectionState === "CONNECTED" || client.connectionState === "CONNECTING") {
                    await client.leave().catch(() => {});
                }
            } catch (_) {}
            if (joinSeqRef.current === currentSeq) {
                clientRef.current = null;
            }
        }

        currentChannelRef.current = null;
        setJoined(false);
        setConnecting(false);
        setConnectionState("DISCONNECTED");
        setRemoteUsers([]);
        setLocalTracks({ audioTrack: null, videoTrack: null });
        setIsScreenSharing(false);
    }, []);

    /**
     * Initialize & Join Agora RTC Channel
     */
    const joinChannel = useCallback(async ({ appId, channelName, token, uid, callType = "video" }) => {
        if (!appId || !channelName) {
            setError("Missing Agora App ID or Channel Name.");
            return;
        }

        // If already connected to this channel with an active client, avoid duplicate join
        if (
            clientRef.current &&
            clientRef.current.connectionState === "CONNECTED" &&
            currentChannelRef.current === channelName
        ) {
            console.log(`[Agora RTC] Already connected to channel '${channelName}'.`);
            return;
        }

        // Increment sequence to cancel any prior in-flight join operations
        const seq = ++joinSeqRef.current;

        setConnecting(true);
        setConnectionState("CONNECTING");
        setError(null);

        // Clean up any stale client before creating a new one
        if (clientRef.current) {
            try {
                clientRef.current.removeAllListeners();
                await clientRef.current.leave().catch(() => {});
            } catch (_) {}
            clientRef.current = null;
        }

        if (joinSeqRef.current !== seq) return;

        try {
            console.log(`[Agora RTC] 🚀 Initializing RTC Client: App ID ${appId.slice(0, 6)}..., Channel: ${channelName}`);
            const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            clientRef.current = client;
            currentChannelRef.current = channelName;

            // 1. Connection state change listener
            client.on("connection-state-change", (curState, revState, reason) => {
                if (joinSeqRef.current !== seq) return;
                console.log(`[Agora RTC] State change: ${revState} -> ${curState} (${reason || "normal"})`);
                setConnectionState(curState);

                if (curState === "CONNECTED") {
                    setJoined(true);
                    setConnecting(false);
                    setError(null);
                } else if (curState === "DISCONNECTED") {
                    setJoined(false);
                    if (reason && reason !== "LEAVE") {
                        setError(`Agora connection disconnected: ${reason}`);
                    }
                }
            });

            // 2. Remote user joined listener
            client.on("user-joined", (user) => {
                if (joinSeqRef.current !== seq) return;
                console.log(`[Agora RTC] 👤 Remote user joined channel: UID=${user.uid}`);
                syncRemoteUsers();
            });

            // 3. Remote user published media listener
            client.on("user-published", async (user, mediaType) => {
                if (joinSeqRef.current !== seq) return;
                console.log(`[Agora RTC] 📡 Remote user published: UID=${user.uid}, mediaType=${mediaType}`);
                try {
                    await client.subscribe(user, mediaType);
                    console.log(`[Agora RTC] ✅ Subscribed to UID=${user.uid}, mediaType=${mediaType}`);

                    if (mediaType === "audio" && user.audioTrack) {
                        try {
                            user.audioTrack.play();
                        } catch (playErr) {
                            console.warn("[Agora RTC] Audio play warning:", playErr);
                        }
                    }
                    syncRemoteUsers();
                } catch (subErr) {
                    console.error("[Agora RTC] Subscribe error:", subErr);
                }
            });

            // 4. Remote user unpublished media listener
            client.on("user-unpublished", (user, mediaType) => {
                if (joinSeqRef.current !== seq) return;
                console.log(`[Agora RTC] 📴 Remote user unpublished: UID=${user.uid}, mediaType=${mediaType}`);
                if (mediaType === "audio" && user.audioTrack) {
                    try {
                        user.audioTrack.stop();
                    } catch (_) {}
                }
                syncRemoteUsers();
            });

            // 5. Remote user left listener
            client.on("user-left", (user, reason) => {
                if (joinSeqRef.current !== seq) return;
                console.log(`[Agora RTC] 🚪 Remote user left channel: UID=${user.uid}, reason=${reason}`);
                syncRemoteUsers();
            });

            // Join the Agora RTC Channel
            const targetUid = uid ? Number(uid) : null;
            console.log(`[Agora RTC] Joining channel '${channelName}' with UID: ${targetUid}, token present: ${Boolean(token)}`);
            const joinedUid = await client.join(appId, channelName, token || null, targetUid);
            console.log(`[Agora RTC] 🎉 Joined successfully with UID: ${joinedUid}`);

            if (joinSeqRef.current !== seq) {
                client.leave().catch(() => {});
                return;
            }

            // Check and subscribe to any remote users already active in channel
            if (client.remoteUsers && client.remoteUsers.length > 0) {
                console.log(`[Agora RTC] Found ${client.remoteUsers.length} existing remote user(s) in channel.`);
                for (const remoteUser of client.remoteUsers) {
                    if (remoteUser.hasAudio && !remoteUser.audioTrack) {
                        try {
                            await client.subscribe(remoteUser, "audio");
                            remoteUser.audioTrack?.play();
                        } catch (e) {
                            console.warn("[Agora RTC] Subscribe existing audio warning:", e);
                        }
                    }
                    if (remoteUser.hasVideo && !remoteUser.videoTrack) {
                        try {
                            await client.subscribe(remoteUser, "video");
                        } catch (e) {
                            console.warn("[Agora RTC] Subscribe existing video warning:", e);
                        }
                    }
                }
                syncRemoteUsers();
            }

            // Create and publish local tracks
            const tracksToPublish = [];

            // 1. Microphone track
            try {
                const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                    AEC: true,
                    ANS: true,
                });
                if (joinSeqRef.current === seq) {
                    localAudioTrackRef.current = audioTrack;
                    tracksToPublish.push(audioTrack);
                } else {
                    audioTrack.close();
                }
            } catch (micErr) {
                console.warn("[Agora RTC] Microphone not available or busy:", micErr?.message || micErr);
            }

            // 2. Camera video track (if callType === 'video')
            if (callType === "video") {
                try {
                    const videoTrack = await AgoraRTC.createCameraVideoTrack({
                        encoderConfig: "720p_1",
                    });
                    if (joinSeqRef.current === seq) {
                        localVideoTrackRef.current = videoTrack;
                        tracksToPublish.push(videoTrack);
                        setIsVideoMuted(false);
                    } else {
                        videoTrack.close();
                    }
                } catch (camErr) {
                    console.warn("[Agora RTC] Camera not available or busy in another tab/app:", camErr?.message || camErr);
                    setIsVideoMuted(true);
                }
            } else {
                setIsVideoMuted(true);
            }

            if (joinSeqRef.current !== seq) {
                client.leave().catch(() => {});
                return;
            }

            // Publish local tracks
            if (tracksToPublish.length > 0) {
                try {
                    await client.publish(tracksToPublish);
                    console.log(`[Agora RTC] Published ${tracksToPublish.length} local track(s).`);
                } catch (pubErr) {
                    console.error("[Agora RTC] Publish error:", pubErr);
                }
            }

            setLocalTracks({
                audioTrack: localAudioTrackRef.current,
                videoTrack: localVideoTrackRef.current,
            });

            setJoined(true);
            setConnecting(false);
            setConnectionState("CONNECTED");
            setIsAudioMuted(false);
        } catch (err) {
            if (joinSeqRef.current !== seq) return;
            console.error("[Agora RTC] Join Error:", err);
            setConnecting(false);
            setJoined(false);
            setConnectionState("DISCONNECTED");

            if (
                err.code === "OPERATION_ABORTED" ||
                err.message?.includes("cancel token canceled") ||
                err.message?.includes("OPERATION_ABORTED")
            ) {
                console.log("[Agora RTC] In-flight join operation cancelled cleanly.");
                return;
            }

            const errCode = err.code || err.name || "AgoraError";
            let friendlyMessage = `[${errCode}] ${err.message || "Failed to connect to Agora room."}`;

            if (err.code === "DYNAMIC_KEY_TIMEOUT" || err.code === "CAN_NOT_GET_GATEWAY_SERVER" || err.message?.includes("token")) {
                friendlyMessage = `[Agora Token Error] Please ensure AGORA_APP_CERTIFICATE in backend/.env matches your Agora Console project.`;
            } else if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
                friendlyMessage = "Camera or microphone permission denied. Please allow device access in your browser URL bar.";
            }
            setError(friendlyMessage);
        }
    }, [syncRemoteUsers]);

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
                    screenTrackRef.current.stop();
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
        localAudioTrack: localTracks.audioTrack || localAudioTrackRef.current,
        localVideoTrack: localTracks.videoTrack || localVideoTrackRef.current,
        screenTrack: screenTrackRef.current,
        joinChannel,
        leaveChannel,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
    };
}
