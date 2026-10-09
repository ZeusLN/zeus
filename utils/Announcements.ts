// Registry of one-time informational notices shown to existing users on
// startup (e.g. notable default changes, new features). Each entry is
// dismissed via a per-id Storage key the first time it triggers, so the
// notice is strictly one-shot per device regardless of how the user closes
// the modal.
//
// To add a new announcement:
//   1. Add a locale entry for the title/body/CTA strings.
//   2. Append a new entry to ANNOUNCEMENTS below with a stable, unique `id`.
//   3. (Optional) provide a `shouldShow` predicate for additional gating.
//
// Only one announcement is surfaced per check, and entries earlier in the
// array win. Ordering by importance is fine; reordering won't re-show
// already-dismissed entries. New users are marked as having seen every
// current announcement when onboarding starts (IntroSplash).

export interface Announcement {
    // Stable id, used in the dismissal Storage key.
    // Renaming an id will re-surface the announcement to all users.
    id: string;
    titleKey: string;
    bodyKey: string;
    cta?: {
        labelKey: string;
        onPress: (navigation: any) => void;
    };
    // Optional additional gate beyond "not yet dismissed".
    shouldShow?: () => boolean;
}

export const ANNOUNCEMENT_DISMISSED_KEY_PREFIX = 'announcement_';

export const getAnnouncementDismissedKey = (id: string) =>
    `${ANNOUNCEMENT_DISMISSED_KEY_PREFIX}${id}_dismissed`;

export const ANNOUNCEMENTS: Announcement[] = [
    {
        id: 'satsSymbolIntro',
        titleKey: 'views.SatsSymbolIntro.title',
        bodyKey: 'views.SatsSymbolIntro.body',
        cta: {
            labelKey: 'views.SatsSymbolIntro.openDisplaySettings',
            onPress: (navigation: any) => navigation.navigate('Display')
        }
    }
];
