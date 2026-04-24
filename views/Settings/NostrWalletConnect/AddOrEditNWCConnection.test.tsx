jest.mock(
    '../../../assets/images/SVG/Caret Right-3.svg',
    () => 'CaretRight.svg'
);
jest.mock('../../../components/Screen', () => 'Screen');
jest.mock('../../../components/Header', () => 'Header');
jest.mock('../../../components/text/Body', () => ({ Body: 'Body' }));
jest.mock('../../../components/Button', () => 'Button');
jest.mock('../../../components/TextInput', () => 'TextInput');
jest.mock('../../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../../components/Switch', () => 'Switch');
jest.mock('../../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000000')
}));
jest.mock('../../../utils/UnitsUtils', () => ({
    numberWithCommas: jest.fn((value: string | number) => String(value))
}));
jest.mock('../../../utils/NostrConnectUtils', () => ({
    __esModule: true,
    default: {
        getFullAccessPermissions: jest.fn(() => ['get_info', 'pay_invoice']),
        getBudgetRenewalOptions: jest.fn(() => [{ key: 'never' }]),
        getBudgetRenewalIndex: jest.fn(() => 0),
        getExpiryDateFromPreset: jest.fn(() => new Date()),
        getExpiryPresetIndex: jest.fn(() => 0),
        determinePermissionType: jest.fn(() => 'full-access'),
        TIME_UNITS: ['days', 'hours'],
        hasPaymentPermissions: jest.fn(() => false)
    }
}));
jest.mock('../../../models/NWCConnection', () => ({
    __esModule: true,
    default: class NWCConnection {},
    PermissionType: {
        FullAccess: 'full-access'
    }
}));
jest.mock('../../../stores/ModalStore', () => ({
    __esModule: true,
    default: class ModalStore {}
}));
jest.mock('../../../stores/NostrWalletConnectStore', () => ({
    __esModule: true,
    default: class NostrWalletConnectStore {},
    DEFAULT_NOSTR_RELAYS: ['wss://relay.getalby.com/v1']
}));
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    ButtonGroup: 'ButtonGroup',
    Icon: 'Icon'
}));
jest.mock('@react-native-community/slider', () => 'Slider');

import AddOrEditNWCConnection from './AddOrEditNWCConnection';

describe('AddOrEditNWCConnection lightning address defaults', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not opt in to LUD-16 by default when a lightning address is active', async () => {
        const store = {
            maxBudgetLimit: 25,
            lightningAddressStore: {
                lightningAddressActivated: true,
                lightningAddress: 'user@example.com'
            }
        };
        const navigation = {
            addListener: jest.fn().mockReturnValue(jest.fn())
        };
        const component = new AddOrEditNWCConnection({
            navigation: navigation as any,
            route: { params: {} } as any,
            NostrWalletConnectStore: store as any,
            ModalStore: {} as any
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

        await component.updateMaxBudgetLimit();

        expect((component as any).state.includeLightningAddress).toBe(false);
        expect(
            (component as any).state.includeLightningAddressInitialized
        ).toBe(true);
    });
});
