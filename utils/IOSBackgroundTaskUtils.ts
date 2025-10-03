import { NativeModules, Platform } from 'react-native';

interface IOSBackgroundTaskManagerInterface {
    startBackgroundTask(): Promise<{ success: boolean }>;
    endBackgroundTask(): Promise<{ success: boolean }>;
    getRemainingBackgroundTime(): Promise<{ remainingTime: number }>;
    cleanup(): void;
}

class IOSBackgroundTaskUtils {
    private nativeModule: IOSBackgroundTaskManagerInterface | null = null;
    private moduleChecked: boolean = false;

    private getModule(): IOSBackgroundTaskManagerInterface | null {
        if (Platform.OS !== 'ios') {
            return null;
        }

        if (!this.moduleChecked) {
            this.moduleChecked = true;
            const { BackgroundTaskManager } = NativeModules;

            if (BackgroundTaskManager) {
                this.nativeModule = BackgroundTaskManager;
                console.log(
                    'iOS: BackgroundTaskManager native module loaded successfully'
                );
            } else {
                console.error(
                    'iOS: BackgroundTaskManager native module not found'
                );
                console.error(
                    'Available modules:',
                    Object.keys(NativeModules).join(', ')
                );
            }
        }

        return this.nativeModule;
    }

    async startBackgroundTask(): Promise<boolean> {
        const module = this.getModule();
        if (!module) {
            return false;
        }

        try {
            const result = await module.startBackgroundTask();
            return result.success;
        } catch (error) {
            console.error('iOS: Failed to start background task:', error);
            return false;
        }
    }

    async endBackgroundTask(): Promise<boolean> {
        const module = this.getModule();
        if (!module) {
            return false;
        }

        try {
            const result = await module.endBackgroundTask();
            return result.success;
        } catch (error) {
            console.error('iOS: Failed to end background task:', error);
            return false;
        }
    }

    async getRemainingBackgroundTime(): Promise<number> {
        const module = this.getModule();
        if (!module) {
            return 0;
        }

        try {
            const result = await module.getRemainingBackgroundTime();
            return result.remainingTime;
        } catch (error) {
            return 0;
        }
    }

    cleanup(): void {
        const module = this.getModule();
        if (module) {
            try {
                module.cleanup();
            } catch (error) {
                console.error('iOS: Failed to cleanup background task:', error);
            }
        }
    }

    isAvailable(): boolean {
        return this.getModule() !== null;
    }
}
export default new IOSBackgroundTaskUtils();
