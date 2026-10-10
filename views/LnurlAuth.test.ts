jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../components/SuccessErrorMessage', () => ({
    SuccessMessage: 'SuccessMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/SigningUtils', () => ({}));
jest.mock('../stores/SettingsStore', () => ({ LNDHUB_AUTH_MODES: [] }));
const mockNetworkFetch = jest.fn();
jest.mock('../utils/NetworkUtils', () => ({
    networkFetch: (...args: any[]) => mockNetworkFetch(...args)
}));

import { Alert } from 'react-native';

import LnurlAuth from './LnurlAuth';

const lnurlParams = {
    tag: 'login',
    domain: 'service.example.com',
    callback:
        'https://service.example.com/auth?tag=login&k1=k1value&action=login',
    k1: 'k1value',
    action: 'login'
};

const authenticate = async (enableTor?: boolean) => {
    const view = new LnurlAuth({
        navigation: {} as any,
        route: { params: { lnurlParams } } as any,
        SettingsStore: { enableTor } as any
    });
    view.setState = jest.fn();
    view.sendValues({
        linkingKeyPub: '02aa',
        signedMessageDERHex: '3044'
    });
    await new Promise((resolve) => setImmediate(resolve));
};

describe('LnurlAuth callback transport', () => {
    beforeEach(() => {
        mockNetworkFetch.mockReset();
        // An error envelope ends the flow right after the request
        mockNetworkFetch.mockResolvedValue({
            json: () => ({ status: 'ERROR', reason: 'stop' })
        });
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends the signed callback over Tor when Tor is enabled', async () => {
        await authenticate(true);

        expect(mockNetworkFetch).toHaveBeenCalledTimes(1);
        const [{ method, url, enableTor }] = mockNetworkFetch.mock.calls[0];
        expect(method).toBe('get');
        expect(enableTor).toBe(true);
        const query = new URL(url).searchParams;
        expect(query.get('key')).toBe('02aa');
        expect(query.get('sig')).toBe('3044');
    });

    it('sends the signed callback directly when Tor is disabled', async () => {
        await authenticate(false);

        expect(mockNetworkFetch).toHaveBeenCalledWith(
            expect.objectContaining({ enableTor: false })
        );
    });
});
