jest.mock('../../../assets/images/SVG/Edit.svg', () => 'Edit.svg');
jest.mock('../../../assets/images/SVG/Checkmark.svg', () => 'Checkmark.svg');
jest.mock('../../../assets/images/SVG/Clock.svg', () => 'Clock.svg');
jest.mock('../../../components/Screen', () => 'Screen');
jest.mock('../../../components/Header', () => 'Header');
jest.mock('../../../components/text/Body', () => ({ Body: 'Body' }));
jest.mock('../../../components/Button', () => 'Button');
jest.mock('../../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../../components/KeyValue', () => 'KeyValue');
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../../utils/ActionUtils', () => ({
    confirmAction: jest.fn()
}));
jest.mock('../../../utils/DateTimeUtils', () => ({}));
jest.mock('../../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../../utils/NostrConnectUtils', () => ({
    __esModule: true,
    default: {
        decodeInvoiceTags: jest.fn(),
        getFullAccessPermissions: jest.fn(() => []),
        getNotifications: jest.fn(() => [])
    }
}));
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000000')
}));
jest.mock('../../../models/NWCConnection', () => ({
    __esModule: true,
    default: class NWCConnection {}
}));
jest.mock('../../../stores/ModalStore', () => ({
    __esModule: true,
    default: class ModalStore {}
}));
jest.mock('../../../stores/NostrWalletConnectStore', () => ({
    __esModule: true,
    default: class NostrWalletConnectStore {}
}));
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));

import NWCConnectionDetails from './NWCConnectionDetails';

describe('NWCConnectionDetails regenerateConnection', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not delete the existing connection when regeneration fails validation', async () => {
        const navigation = {
            addListener: jest.fn().mockReturnValue(jest.fn()),
            navigate: jest.fn()
        };
        const store = {
            createConnection: jest
                .fn()
                .mockRejectedValue(new Error('INVALID_LIGHTNING_ADDRESS')),
            deleteConnection: jest.fn().mockResolvedValue(undefined),
            connections: []
        };
        const modalStore = {
            toggleInfoModal: jest.fn()
        };
        const component = new NWCConnectionDetails({
            navigation: navigation as any,
            route: { params: { connectionId: 'conn-1' } } as any,
            NostrWalletConnectStore: store as any,
            ModalStore: modalStore as any
        });

        (component as any).setState = (update: any) => {
            const nextState =
                typeof update === 'function'
                    ? update((component as any).state, (component as any).props)
                    : update;
            (component as any).state = {
                ...(component as any).state,
                ...nextState
            };
        };
        (component as any).state = {
            ...((component as any).state || {}),
            connection: {
                id: 'conn-1',
                name: 'Test connection',
                relayUrl: 'wss://old.relay',
                permissions: [],
                includeLightningAddress: true,
                totalSpendSats: 0,
                lastBudgetReset: undefined,
                activity: []
            }
        };

        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            return undefined;
        });

        await component.regenerateConnection();

        expect(store.createConnection).toHaveBeenCalledWith(
            expect.objectContaining({
                id: undefined,
                relayUrl: 'wss://old.relay',
                replaceConnectionId: 'conn-1'
            })
        );
        expect(store.deleteConnection).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
        expect((component as any).state.error).toBe('INVALID_LIGHTNING_ADDRESS');
        expect(errorSpy).toHaveBeenCalled();
    });
});
