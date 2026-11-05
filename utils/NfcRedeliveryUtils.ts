// Android hands a tag that is still in the field to the app again, as an
// NDEF_DISCOVERED intent, about a second after a reader mode session ends.
// The window covers that and still lets the user tap the same tag again
// on purpose soon after.
export const REDELIVERY_WINDOW_MS = 5000;

let lastTag: { text: string; endedAt: number } | undefined;

/** Records the text of the tag an NFC session read, as the session ends */
export function noteTagSessionEnded(text: string): void {
    lastTag = { text: text.trim(), endedAt: Date.now() };
}

/**
 * Whether NFC intent data is the tag the last session read, delivered again
 * by Android. Each session's tag is matched once.
 */
export function isTagRedelivery(text: string): boolean {
    if (
        !lastTag ||
        lastTag.text !== text.trim() ||
        Date.now() - lastTag.endedAt >= REDELIVERY_WINDOW_MS
    ) {
        return false;
    }
    lastTag = undefined;
    return true;
}
