jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    Chip: 'Chip',
    Icon: 'Icon',
    ButtonGroup: 'ButtonGroup'
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
jest.mock('../../utils/AddressUtils', () => ({
    isValidLightningPubKey: (pubkey: string) => /^02a{64}$/.test(pubkey)
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../../assets/images/SVG/PeersContact.svg', () => 'ContactIcon');
jest.mock('./SendEcash', () => ({}));

import Clipboard from '@react-native-clipboard/clipboard';
import CashuLockSettings from './CashuLockSettings';

const PUBKEY =
    '02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const makeView = (clipboard: boolean) => {
    const view = new CashuLockSettings({
        navigation: { navigate: jest.fn() },
        route: { params: {} },
        ContactStore: {},
        SettingsStore: { settings: { privacy: { clipboard } } }
    } as any);
    // setState on a class that was never mounted does nothing, so apply it
    // directly
    jest.spyOn(view, 'setState').mockImplementation((update: any) => {
        view.state = { ...view.state, ...update };
    });
    return view;
};

describe('CashuLockSettings clipboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Clipboard.getString as jest.Mock).mockResolvedValue(PUBKEY);
    });

    describe('with clipboard reading off', () => {
        it('shows the paste button on focus without reading the clipboard', async () => {
            const view = makeView(false);

            await view.checkClipboardContent();

            expect(Clipboard.getString).not.toHaveBeenCalled();
            expect(view.state.hasClipboardContent).toBe(true);
        });

        it('shows the paste button when the field is cleared without reading the clipboard', () => {
            const view = makeView(false);

            view.handlePubkeyChange('');

            expect(Clipboard.getString).not.toHaveBeenCalled();
            expect(view.state.hasClipboardContent).toBe(true);
        });

        it('reads the clipboard when the paste button is pressed', async () => {
            const view = makeView(false);

            await view.handlePaste();

            expect(Clipboard.getString).toHaveBeenCalledTimes(1);
            expect(view.state.pubkey).toBe(PUBKEY);
            expect(view.state.isPubkeyValid).toBe(true);
        });
    });

    describe('with clipboard reading on', () => {
        it('shows the paste button when the clipboard has text', async () => {
            const view = makeView(true);

            await view.checkClipboardContent();

            expect(Clipboard.getString).toHaveBeenCalledTimes(1);
            expect(view.state.hasClipboardContent).toBe(true);
        });

        it('hides the paste button when the clipboard is empty', async () => {
            (Clipboard.getString as jest.Mock).mockResolvedValue('');
            const view = makeView(true);

            await view.checkClipboardContent();

            expect(view.state.hasClipboardContent).toBe(false);
        });

        it('hides the paste button when the clipboard read fails', async () => {
            (Clipboard.getString as jest.Mock).mockRejectedValue(
                new Error('denied')
            );
            const view = makeView(true);

            await view.checkClipboardContent();

            expect(view.state.hasClipboardContent).toBe(false);
        });
    });
});
