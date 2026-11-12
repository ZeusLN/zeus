import { device } from 'detox';

// Detox waits for the app to go idle before every action and expectation. A
// starting or syncing node keeps the app busy for minutes, so steps that run
// meanwhile switch that off and wait for elements explicitly.
export const withoutSynchronization = async <T>(
    steps: () => Promise<T>
): Promise<T> => {
    await device.disableSynchronization();
    try {
        return await steps();
    } finally {
        await device.enableSynchronization();
    }
};
