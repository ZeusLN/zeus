import { useRef, useCallback } from 'react';

interface StealthTapDetectorOptions {
    requiredTaps?: number;
    timeWindow?: number;
    onUnlock: () => void;
}

/**
 * Hook to detect secret tap pattern for stealth mode unlock
 * Default: 5 taps within 4 seconds
 */
export const useStealthTapDetector = ({
    requiredTaps = 5,
    timeWindow = 4000,
    onUnlock
}: StealthTapDetectorOptions) => {
    const tapTimestamps = useRef<number[]>([]);

    const handleTap = useCallback(() => {
        const now = Date.now();

        // Filter out taps outside the time window
        tapTimestamps.current = tapTimestamps.current.filter(
            (timestamp) => now - timestamp < timeWindow
        );

        // Add current tap
        tapTimestamps.current.push(now);

        // Check if we've reached the required number of taps
        if (tapTimestamps.current.length >= requiredTaps) {
            tapTimestamps.current = [];
            onUnlock();
        }
    }, [requiredTaps, timeWindow, onUnlock]);

    const resetTaps = useCallback(() => {
        tapTimestamps.current = [];
    }, []);

    return { handleTap, resetTaps };
};

export default useStealthTapDetector;
