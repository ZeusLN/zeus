jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(true)
}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/Announcements', () => ({
    ANNOUNCEMENTS: [],
    getAnnouncementDismissedKey: (id: string) => `announcement_${id}_dismissed`
}));

import Storage from '../storage';
import { ANNOUNCEMENTS } from '../utils/Announcements';
import ModalStore from './ModalStore';

const mockAnnouncements = ANNOUNCEMENTS as any[];

const mockStorage = Storage as unknown as {
    getItem: jest.Mock;
    setItem: jest.Mock;
};

const intro = {
    id: 'intro',
    titleKey: 'intro.title',
    bodyKey: 'intro.body',
    cta: { labelKey: 'intro.cta', onPress: jest.fn() }
};
const second = {
    id: 'second',
    titleKey: 'second.title',
    bodyKey: 'second.body'
};

describe('ModalStore announcements', () => {
    let store: ModalStore;
    let stored: Record<string, string>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAnnouncements.length = 0;
        stored = {};
        mockStorage.getItem.mockImplementation(async (key: string) =>
            key in stored ? stored[key] : null
        );
        mockStorage.setItem.mockImplementation(
            async (key: string, value: string) => {
                stored[key] = value;
                return true;
            }
        );
        store = new ModalStore();
    });

    describe('checkAndTriggerAnnouncements', () => {
        it('shows the first unseen announcement and marks it seen', async () => {
            mockAnnouncements.push(intro);
            await store.checkAndTriggerAnnouncements({});

            expect(store.showInfoModal).toBe(true);
            expect(store.infoModalTitle).toBe('intro.title');
            expect(store.infoModalText).toBe('intro.body');
            expect(stored.announcement_intro_dismissed).toBe('true');
        });

        it('wires the CTA button to the announcement with the navigation', async () => {
            mockAnnouncements.push(intro);
            const navigation = { navigate: jest.fn() };
            await store.checkAndTriggerAnnouncements(navigation);

            const buttons = store.infoModalAdditionalButtons!;
            expect(buttons).toHaveLength(1);
            expect(buttons[0].title).toBe('intro.cta');
            buttons[0].callback!();
            expect(intro.cta.onPress).toHaveBeenCalledWith(navigation);
        });

        it('passes no buttons when the announcement has no CTA', async () => {
            mockAnnouncements.push(second);
            await store.checkAndTriggerAnnouncements({});

            expect(store.showInfoModal).toBe(true);
            expect(store.infoModalAdditionalButtons).toBeUndefined();
        });

        it('skips announcements that were already seen', async () => {
            mockAnnouncements.push(intro);
            stored.announcement_intro_dismissed = 'true';
            await store.checkAndTriggerAnnouncements({});

            expect(store.showInfoModal).toBe(false);
            expect(mockStorage.setItem).not.toHaveBeenCalled();
        });

        it('skips an announcement whose shouldShow returns false', async () => {
            mockAnnouncements.push({ ...intro, shouldShow: () => false });
            mockAnnouncements.push(second);
            await store.checkAndTriggerAnnouncements({});

            expect(store.infoModalTitle).toBe('second.title');
            expect(stored.announcement_intro_dismissed).toBeUndefined();
            expect(stored.announcement_second_dismissed).toBe('true');
        });

        it('shows only one announcement per check', async () => {
            mockAnnouncements.push(intro, second);
            await store.checkAndTriggerAnnouncements({});

            expect(store.infoModalTitle).toBe('intro.title');
            expect(stored.announcement_second_dismissed).toBeUndefined();

            store.closeVisibleModalDialog();
            await store.checkAndTriggerAnnouncements({});
            expect(store.infoModalTitle).toBe('second.title');
        });

        it('waits without marking it seen while another modal is open', async () => {
            mockAnnouncements.push(intro);
            store.toggleRatingModal(true);
            await store.checkAndTriggerAnnouncements({});

            expect(store.showInfoModal).toBe(false);
            expect(stored.announcement_intro_dismissed).toBeUndefined();

            store.toggleRatingModal(false);
            await store.checkAndTriggerAnnouncements({});
            expect(store.infoModalTitle).toBe('intro.title');
        });

        it('swallows Storage errors', async () => {
            mockAnnouncements.push(intro);
            mockStorage.getItem.mockRejectedValueOnce(new Error('keychain'));
            const log = jest.spyOn(console, 'log').mockImplementation();

            await expect(
                store.checkAndTriggerAnnouncements({})
            ).resolves.toBeUndefined();
            expect(store.showInfoModal).toBe(false);
            log.mockRestore();
        });
    });

    describe('markAnnouncementsSeen', () => {
        it('marks every announcement seen so none is shown later', async () => {
            mockAnnouncements.push(intro, second);
            await store.markAnnouncementsSeen();

            expect(stored.announcement_intro_dismissed).toBe('true');
            expect(stored.announcement_second_dismissed).toBe('true');

            await store.checkAndTriggerAnnouncements({});
            expect(store.showInfoModal).toBe(false);
        });
    });
});
