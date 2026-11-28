/**
 * Resolves which recommended mints the user has opted into during onboarding.
 *
 * Mint recommendations come from a permissionless nostr popularity/rating signal
 * and are never trusted with funds unless the user keeps them ticked. A `null`
 * selection means the user has not touched the checkboxes yet, so every
 * recommended mint is treated as selected (the low-friction default). Once the
 * user has made an explicit selection we honor it verbatim, filtered to the
 * mints currently on offer. The result may be empty when the user deselected
 * every mint.
 *
 * @param selectedMintUrls the user's explicit selection, or null if untouched
 * @param recommendedMintUrls the mint URLs currently shown as recommendations
 */
export const resolveSelectedMintUrls = (
    selectedMintUrls: string[] | null,
    recommendedMintUrls: string[]
): string[] => {
    if (selectedMintUrls === null) {
        return [...recommendedMintUrls];
    }
    return selectedMintUrls.filter((url) => recommendedMintUrls.includes(url));
};
