import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface AudioTrack {
    index: number;
    name: string;
    isSelected: boolean;
}

export interface AudioKeepAliveStatus {
    isActive: boolean;
    playerPlaying: boolean;
    isMuted: boolean;
    currentTrackIndex: number;
    currentTrackName: string;
    availableTracks: string[];
    /** Seconds the audio session has been alive */
    uptimeSeconds: number;
    /** Seconds spent in background since last backgrounding */
    backgroundDuration: number;
    disconnectCount: number;
    lastDisconnectReason: string;
    iosVersion: string;
    deviceModel: string;
    currentOutput: string;
}

export interface AudioInterruptedPayload {
    reason: string;
    disconnectCount: number;
    uptimeSeconds: number;
}

export interface AudioInterruptionEndedPayload {
    shouldResume: boolean;
    uptimeSeconds: number;
}

export interface AudioRouteChangedPayload {
    reason: string;
    currentOutput: string;
    uptimeSeconds: number;
}

export interface AudioStatusUpdatePayload extends AudioKeepAliveStatus {
    reason?: string;
    suspectedSuspension?: boolean;
}

export interface AudioTrackChangedPayload {
    trackIndex: number;
    trackName: string;
}

export type AudioKeepAliveEventType =
    | 'NWCAudioInterrupted'
    | 'NWCAudioInterruptionEnded'
    | 'NWCAudioRouteChanged'
    | 'NWCAudioStatusUpdate'
    | 'NWCAudioSuspended'
    | 'NWCAudioTrackChanged';

interface NWCAudioKeepAliveModule {
    startAudioKeepAlive(): Promise<AudioKeepAliveStatus>;
    stopAudioKeepAlive(): Promise<AudioKeepAliveStatus>;
    getStatus(): Promise<AudioKeepAliveStatus>;
    getAvailableTracks(): Promise<AudioTrack[]>;
    setTrack(index: number): Promise<AudioKeepAliveStatus>;
    nextTrack(): Promise<AudioKeepAliveStatus>;
    previousTrack(): Promise<AudioKeepAliveStatus>;
    setMuted(muted: boolean): Promise<AudioKeepAliveStatus>;
    /** Call while app is in foreground so the Live Activity can start before backgrounding. */
    armNWCAudio(): Promise<boolean>;
    /** Call when NWC service is stopped/torn down. */
    disarmNWCAudio(): Promise<boolean>;
    addListener(eventType: string): void;
    removeListeners(count: number): void;
}

class IOSAudioKeepAliveUtils {
    private nativeModule: NWCAudioKeepAliveModule | null = null;
    private emitter: NativeEventEmitter | null = null;
    private moduleChecked = false;

    private getModule(): NWCAudioKeepAliveModule | null {
        if (Platform.OS !== 'ios') return null;

        if (!this.moduleChecked) {
            this.moduleChecked = true;
            const mod = NativeModules.NWCAudioKeepAlive as
                | NWCAudioKeepAliveModule
                | undefined;

            if (mod) {
                this.nativeModule = mod;
                this.emitter = new NativeEventEmitter(mod as any);
                console.log('[NWCAudio] Native module loaded');
            } else {
                console.error('[NWCAudio] Native module not found');
            }
        }

        return this.nativeModule;
    }

    private getEmitter(): NativeEventEmitter | null {
        this.getModule();
        return this.emitter;
    }

    async start(): Promise<AudioKeepAliveStatus | null> {
        const mod = this.getModule();
        if (!mod) return null;
        try {
            const status = await mod.startAudioKeepAlive();
            console.log(
                `[NWCAudio] Started – iOS ${status.iosVersion} on ${status.deviceModel}`
            );
            return status;
        } catch (e) {
            console.error('[NWCAudio] start() failed:', e);
            return null;
        }
    }

    async stop(): Promise<AudioKeepAliveStatus | null> {
        const mod = this.getModule();
        if (!mod) return null;
        try {
            const status = await mod.stopAudioKeepAlive();
            console.log(
                `[NWCAudio] Stopped – uptime ${status.uptimeSeconds.toFixed(
                    0
                )}s`
            );
            return status;
        } catch (e) {
            console.error('[NWCAudio] stop() failed:', e);
            return null;
        }
    }

    async getStatus(): Promise<AudioKeepAliveStatus | null> {
        const mod = this.getModule();
        if (!mod) return null;
        try {
            return await mod.getStatus();
        } catch (e) {
            console.error('[NWCAudio] getStatus() failed:', e);
            return null;
        }
    }

    async getAvailableTracks(): Promise<AudioTrack[] | null> {
        const mod = this.getModule();
        if (!mod) return null;
        try {
            return await mod.getAvailableTracks();
        } catch (e) {
            console.error('[NWCAudio] getAvailableTracks() failed:', e);
            return null;
        }
    }

    async setTrack(index: number): Promise<AudioKeepAliveStatus | null> {
        const mod = this.getModule();
        if (!mod) return null;
        try {
            return await mod.setTrack(index);
        } catch (e) {
            console.error('[NWCAudio] setTrack() failed:', e);
            return null;
        }
    }

    async nextTrack(): Promise<AudioKeepAliveStatus | null> {
        const mod = this.getModule();
        if (!mod) return null;
        try {
            return await mod.nextTrack();
        } catch (e) {
            console.error('[NWCAudio] nextTrack() failed:', e);
            return null;
        }
    }

    async previousTrack(): Promise<AudioKeepAliveStatus | null> {
        const mod = this.getModule();
        if (!mod) return null;
        try {
            return await mod.previousTrack();
        } catch (e) {
            console.error('[NWCAudio] previousTrack() failed:', e);
            return null;
        }
    }

    async setMuted(muted: boolean): Promise<AudioKeepAliveStatus | null> {
        const mod = this.getModule();
        if (!mod) return null;
        try {
            return await mod.setMuted(muted);
        } catch (e) {
            console.error('[NWCAudio] setMuted() failed:', e);
            return null;
        }
    }

    /**
     * Call while the app is still in the foreground (when NWC becomes active).
     * Arms the native side so that UIApplicationWillResignActiveNotification
     * can start the Live Activity before the app fully enters the background –
     * the only window ActivityKit accepts Activity.request().
     */
    async arm(): Promise<void> {
        const mod = this.getModule();
        if (!mod) return;
        try {
            await mod.armNWCAudio();
        } catch (e) {
            console.error('[NWCAudio] arm() failed:', e);
        }
    }

    /** Call when the NWC service is stopped or torn down. */
    async disarm(): Promise<void> {
        const mod = this.getModule();
        if (!mod) return;
        try {
            await mod.disarmNWCAudio();
        } catch (e) {
            console.error('[NWCAudio] disarm() failed:', e);
        }
    }

    onInterrupted(
        handler: (payload: AudioInterruptedPayload) => void
    ): (() => void) | null {
        const emitter = this.getEmitter();
        if (!emitter) return null;
        const sub = emitter.addListener('NWCAudioInterrupted', handler);
        return () => sub.remove();
    }

    onInterruptionEnded(
        handler: (payload: AudioInterruptionEndedPayload) => void
    ): (() => void) | null {
        const emitter = this.getEmitter();
        if (!emitter) return null;
        const sub = emitter.addListener('NWCAudioInterruptionEnded', handler);
        return () => sub.remove();
    }

    onRouteChanged(
        handler: (payload: AudioRouteChangedPayload) => void
    ): (() => void) | null {
        const emitter = this.getEmitter();
        if (!emitter) return null;
        const sub = emitter.addListener('NWCAudioRouteChanged', handler);
        return () => sub.remove();
    }

    onStatusUpdate(
        handler: (payload: AudioStatusUpdatePayload) => void
    ): (() => void) | null {
        const emitter = this.getEmitter();
        if (!emitter) return null;
        const sub = emitter.addListener('NWCAudioStatusUpdate', handler);
        return () => sub.remove();
    }

    onSuspended(
        handler: (payload: { reason: string; uptimeSeconds: number }) => void
    ): (() => void) | null {
        const emitter = this.getEmitter();
        if (!emitter) return null;
        const sub = emitter.addListener('NWCAudioSuspended', handler);
        return () => sub.remove();
    }

    onTrackChanged(
        handler: (payload: AudioTrackChangedPayload) => void
    ): (() => void) | null {
        const emitter = this.getEmitter();
        if (!emitter) return null;
        const sub = emitter.addListener('NWCAudioTrackChanged', handler);
        return () => sub.remove();
    }

    isAvailable(): boolean {
        return this.getModule() !== null;
    }
}

export default new IOSAudioKeepAliveUtils();
