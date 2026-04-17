import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface AudioKeepAliveStatus {
    isActive: boolean;
    engineRunning: boolean;
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

export type AudioKeepAliveEventType =
    | 'NWCAudioInterrupted'
    | 'NWCAudioInterruptionEnded'
    | 'NWCAudioRouteChanged'
    | 'NWCAudioStatusUpdate'
    | 'NWCAudioSuspended';

interface NWCAudioKeepAliveModule {
    startAudioKeepAlive(): Promise<AudioKeepAliveStatus>;
    stopAudioKeepAlive(): Promise<AudioKeepAliveStatus>;
    getStatus(): Promise<AudioKeepAliveStatus>;
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

    isAvailable(): boolean {
        return this.getModule() !== null;
    }
}

export default new IOSAudioKeepAliveUtils();
