/**
 * Formats a percentage value for display.
 * Shows whole numbers without decimal places, others with 1 decimal place.
 * This is a worklet function for use with react-native-circular-progress-indicator.
 */
export function formatProgressPercentage(value: number): string {
    'worklet';
    const num = Number(value);
    if (isNaN(num)) return '0';
    // Don't show decimal for whole numbers
    if (num % 1 === 0) return num.toFixed(0);
    return num.toFixed(1);
}
