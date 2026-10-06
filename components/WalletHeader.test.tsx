jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Badge: 'Badge' }));
jest.mock('react-native-safe-area-context', () => ({
    initialWindowMetrics: null
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
jest.mock('../utils/handleAnything', () => ({
    __esModule: true,
    default: jest.fn(),
    isClipboardValue: jest.fn()
}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/PhotoUtils', () => ({ getPhoto: jest.fn() }));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/NavigationUtils', () => ({
    protectedNavigation: jest.fn()
}));
jest.mock('../utils/PrivacyUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../stores/ChannelsStore', () => ({ ChannelsView: {} }));
jest.mock('../stores/SettingsStore', () => ({ PosEnabled: {} }));
jest.mock('./Header', () => 'Header');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/NodeIdenticon', () => 'NodeIdenticon');
jest.mock('./ToggleButton', () => 'ToggleButton');

import Clipboard from '@react-native-clipboard/clipboard';
import WalletHeader from './WalletHeader';
import { isClipboardValue } from '../utils/handleAnything';

const INVOICE = 'lnbcrt1pexample';

const makeHeader = ({
    clipboard,
    connecting
}: {
    clipboard: boolean;
    connecting?: boolean;
}) => {
    const header = new WalletHeader({
        navigation: { addListener: jest.fn() },
        connecting,
        SettingsStore: { settings: { privacy: { clipboard } } }
    } as any);
    // setState on a class that was never mounted does nothing, so apply it
    // directly
    jest.spyOn(header, 'setState').mockImplementation((update: any) => {
        header.state = { ...header.state, ...update };
    });
    return header;
};

describe('WalletHeader.readClipboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Clipboard.getString as jest.Mock).mockResolvedValue(INVOICE);
        (isClipboardValue as jest.Mock).mockResolvedValue(true);
    });

    it('does not read the clipboard while connecting', async () => {
        // on cold start the connecting header mounts while settings still
        // hold the in-memory defaults (clipboard: true)
        const header = makeHeader({ clipboard: true, connecting: true });

        await header.readClipboard();

        expect(Clipboard.getString).not.toHaveBeenCalled();
        expect(header.state.clipboard).toBe('');
    });

    it('reads the clipboard once connected with clipboard reading on', async () => {
        const header = makeHeader({ clipboard: true });

        await header.readClipboard();

        expect(Clipboard.getString).toHaveBeenCalledTimes(1);
        expect(header.state.clipboard).toBe(INVOICE);
    });

    it('does not read the clipboard with clipboard reading off', async () => {
        const header = makeHeader({ clipboard: false });

        await header.readClipboard();

        expect(Clipboard.getString).not.toHaveBeenCalled();
        expect(header.state.clipboard).toBe('');
    });

    it('ignores clipboard text that is not a payable value', async () => {
        (isClipboardValue as jest.Mock).mockResolvedValue(false);
        const header = makeHeader({ clipboard: true });

        await header.readClipboard();

        expect(Clipboard.getString).toHaveBeenCalledTimes(1);
        expect(header.state.clipboard).toBe('');
    });
});
