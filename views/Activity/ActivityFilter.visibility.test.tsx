import React from 'react';
import { render, screen } from '@testing-library/react-native';
import cloneDeep from 'lodash/cloneDeep';

// The filter screen reads the connected node's capabilities. Each test sets
// them with setBackend().
jest.mock('../../utils/BackendUtils', () => ({
    isLNDBased: jest.fn(),
    supportsCashuWallet: jest.fn(),
    supportsKeysend: jest.fn(),
    supportsOnchainReceiving: jest.fn(),
    supportsOnchainSends: jest.fn(),
    supportsAMP: jest.fn(),
    supportsCircularRebalancing: jest.fn(),
    supportsLightningAddress: jest.fn(),
    supportsLSPS1native: jest.fn(),
    supportsLSPScustomMessage: jest.fn(),
    supportsLSPS1rest: jest.fn(),
    supportsLSPS7native: jest.fn()
}));
// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { View, Text } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Content = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    const Icon = ({ accessibilityLabel }: any) => (
        <Text>{`icon:${accessibilityLabel}`}</Text>
    );
    return { Button: () => null, Icon, ListItem };
});
// Renders the title, the header and the children, which the real accordion
// hides until it is opened
jest.mock('../../components/Accordion', () => {
    const { View, Text } = require('react-native');
    return {
        __esModule: true,
        default: ({ title, renderHeader, children }: any) => (
            <View>
                {title ? <Text>{title}</Text> : null}
                {renderHeader ? renderHeader(false, false) : null}
                {children}
            </View>
        ),
        AnimatedRotateWrapper: ({ children }: any) => <View>{children}</View>
    };
});
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => {
    const { View } = require('react-native');
    return ({ rightComponent }: any) => <View>{rightComponent}</View>;
});
// Shows what each switch is given, so a test can read the Services switch:
// the secondaryText track means partial
jest.mock('../../components/Switch', () => {
    const { Text } = require('react-native');
    return ({ value, trackEnabledColor }: any) => (
        <Text>{`switch:${value}:${trackEnabledColor}`}</Text>
    );
});
jest.mock('../../components/TextInput', () => () => null);
jest.mock('../../assets/images/SVG/Caret Down.svg', () => () => null);
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => key)
}));
// ActivityStore is only needed for DEFAULT_FILTERS and SERVICES_CONFIG; its
// store imports pull in native modules
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/PaymentsStore', () => ({}));
jest.mock('../../stores/InvoicesStore', () => ({}));
jest.mock('../../stores/TransactionsStore', () => ({}));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/SwapStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'lsps' }));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../storage', () => ({}));

import BackendUtils from '../../utils/BackendUtils';
import { BACKEND_CAPABILITIES } from '../../utils/backendCapabilityFixtures';
import { DEFAULT_FILTERS } from '../../stores/ActivityStore';
import ActivityFilter, { SWAP_FILTER_STATES } from './ActivityFilter';

const setBackend = (flags: Record<string, boolean>) => {
    Object.keys(BackendUtils).forEach((key) =>
        ((BackendUtils as any)[key] as jest.Mock).mockReturnValue(!!flags[key])
    );
};

// what each kind of node offers, as the real backends report it
const LNDHUB = BACKEND_CAPABILITIES.lndhub;
const NWC = BACKEND_CAPABILITIES['nostr-wallet-connect'];
const CLN = BACKEND_CAPABILITIES['cln-rest'];
const LDK_NODE = BACKEND_CAPABILITIES['ldk-node'];
const LND = BACKEND_CAPABILITIES.lnd;
const EMBEDDED_LND = BACKEND_CAPABILITIES['embedded-lnd'];
const LNC_RECEIVE_ONLY =
    BACKEND_CAPABILITIES['lightning-node-connect-receive-only'];

const CIRCULAR = 'views.Activity.circularRebalance';
const AMP = 'views.ActivityFilter.ampInvoices';
const STANDARD = 'views.ActivityFilter.standardInvoices';
const KEYSEND = 'views.Channel.keysend';
const SERVICES = 'views.ActivityFilter.services';
const SWAPS = 'views.Swaps.title';
const LSPS1 = 'views.LSPS1.type';
const LSPS7 = 'views.LSPS7.type';
const ZEUS_PAY = 'ZEUS Pay';
const ON_CHAIN = 'views.ActivityFilter.onChainPayments';
const UNCONFIRMED = 'general.unconfirmed';
const CASHU = 'views.ActivityFilter.cashuPayments';

const filtersWith = (override: any = {}) => ({
    ...cloneDeep(DEFAULT_FILTERS),
    ...override
});

const renderFilter = async ({
    testnet = false,
    lightningAddressEnabled = false,
    cashuEnabled = false,
    filters = filtersWith(),
    effectiveFilters = filters
}: {
    testnet?: boolean;
    lightningAddressEnabled?: boolean;
    cashuEnabled?: boolean;
    filters?: any;
    effectiveFilters?: any;
} = {}) => {
    const ActivityStore = {
        filters,
        getFilters: jest.fn(),
        getEffectiveFilters: jest.fn(() => effectiveFilters),
        resetFilters: jest.fn(),
        setFilters: jest.fn(),
        setAmountFilter: jest.fn(),
        setMaximumAmountFilter: jest.fn(),
        setStartDateFilter: jest.fn(),
        setEndDateFilter: jest.fn(),
        clearStartDateFilter: jest.fn(),
        clearEndDateFilter: jest.fn(),
        setMemoFilter: jest.fn()
    };
    const ref = React.createRef<any>();
    await render(
        <ActivityFilter
            ref={ref}
            navigation={{ goBack: jest.fn() } as any}
            ActivityStore={ActivityStore as any}
            SettingsStore={
                {
                    settings: {
                        locale: 'en',
                        lightningAddress: { enabled: lightningAddressEnabled },
                        ecash: { enableCashu: cashuEnabled }
                    }
                } as any
            }
            SwapStore={{ formatStatus: (s: string) => s } as any}
            NodeInfoStore={{ testnet } as any}
        />
    );
    return { ActivityStore, filter: ref.current };
};

const shown = (label: string) => screen.queryAllByText(label).length > 0;

const swapsOff = () => {
    const filters = filtersWith({
        swaps: false,
        submarine: false,
        reverse: false
    });
    for (const group of ['submarine', 'reverse'] as const) {
        Object.keys(filters.swapFilter[group]).forEach(
            (state) => (filters.swapFilter[group][state] = false)
        );
    }
    return filters;
};

describe('ActivityFilter visibility', () => {
    it('hides circular rebalance and AMP on LDK Node, and keeps its LSPS filters', async () => {
        setBackend(LDK_NODE);
        await renderFilter();

        expect(shown(CIRCULAR)).toBe(false);
        expect(shown(AMP)).toBe(false);
        expect(shown(STANDARD)).toBe(false);
        expect(shown(KEYSEND)).toBe(true);
        expect(shown(SERVICES)).toBe(true);
        expect(shown(SWAPS)).toBe(true);
        expect(shown(LSPS1)).toBe(true);
        expect(shown(LSPS7)).toBe(true);
    });

    it('shows circular rebalance, the invoice filters and both LSPS filters on LND', async () => {
        setBackend(LND);
        await renderFilter();

        expect(shown(CIRCULAR)).toBe(true);
        expect(shown(AMP)).toBe(true);
        expect(shown(STANDARD)).toBe(true);
        expect(shown(LSPS1)).toBe(true);
        // LSPS7 runs over custom messages on LND, and its orders show in Activity
        expect(shown(LSPS7)).toBe(true);
    });

    it('shows both LSPS filters on embedded LND, which has no LSPS1 over REST', async () => {
        setBackend(EMBEDDED_LND);
        await renderFilter();

        expect(shown(LSPS1)).toBe(true);
        expect(shown(LSPS7)).toBe(true);
    });

    it('shows LSPS1 but not LSPS7 on Core Lightning', async () => {
        setBackend(CLN);
        await renderFilter();

        expect(shown(CIRCULAR)).toBe(true);
        expect(shown(LSPS1)).toBe(true);
        expect(shown(LSPS7)).toBe(false);
        expect(shown(AMP)).toBe(false);
    });

    it('keeps the standard invoice filter on LND without AMP', async () => {
        setBackend({ ...LND, supportsAMP: false });
        await renderFilter();

        expect(shown(AMP)).toBe(false);
        expect(shown(STANDARD)).toBe(true);
    });

    it('shows only swaps under Services on NWC', async () => {
        setBackend(NWC);
        await renderFilter();

        expect(shown(SERVICES)).toBe(true);
        expect(shown(SWAPS)).toBe(true);
        expect(shown(LSPS1)).toBe(false);
        expect(shown(LSPS7)).toBe(false);
        expect(shown(CIRCULAR)).toBe(false);
        expect(shown(KEYSEND)).toBe(false);
    });

    it('hides the Services section when no service applies', async () => {
        setBackend(NWC);
        await renderFilter({ testnet: true });

        expect(shown(SERVICES)).toBe(false);
        expect(shown(SWAPS)).toBe(false);
    });

    it('drops swaps on testnet and keeps the LSPS filters', async () => {
        setBackend(LDK_NODE);
        await renderFilter({ testnet: true });

        expect(shown(SERVICES)).toBe(true);
        expect(shown(SWAPS)).toBe(false);
        expect(shown(LSPS1)).toBe(true);
        expect(shown(LSPS7)).toBe(true);
    });

    it('keeps Services and LSPS1 on testnet for a node with only LSPS1', async () => {
        setBackend(CLN);
        await renderFilter({ testnet: true });

        expect(shown(SERVICES)).toBe(true);
        expect(shown(SWAPS)).toBe(false);
        expect(shown(LSPS1)).toBe(true);
        expect(shown(LSPS7)).toBe(false);
    });

    it('keeps Services and LSPS7 on testnet for a node with only LSPS7', async () => {
        setBackend({ ...NWC, supportsLSPS7native: true });
        await renderFilter({ testnet: true });

        expect(shown(SERVICES)).toBe(true);
        expect(shown(SWAPS)).toBe(false);
        expect(shown(LSPS1)).toBe(false);
        expect(shown(LSPS7)).toBe(true);
    });

    it('shows the on-chain rows on LND', async () => {
        setBackend(LND);
        await renderFilter();
        expect(shown(ON_CHAIN)).toBe(true);
        expect(shown(UNCONFIRMED)).toBe(true);
    });

    it('hides the on-chain rows on LndHub, which only receives on-chain', async () => {
        setBackend(LNDHUB);
        await renderFilter();

        expect(shown(ON_CHAIN)).toBe(false);
        expect(shown(UNCONFIRMED)).toBe(false);
    });

    it('hides the on-chain rows on an LNC session that cannot send on-chain', async () => {
        setBackend(LNC_RECEIVE_ONLY);
        await renderFilter();

        expect(shown(ON_CHAIN)).toBe(false);
        expect(shown(UNCONFIRMED)).toBe(false);
    });

    it('shows the Cashu row when ecash is on', async () => {
        setBackend(LDK_NODE);
        await renderFilter({ cashuEnabled: true });
        expect(shown(CASHU)).toBe(true);
    });

    it('hides the Cashu row when ecash is off in the settings', async () => {
        setBackend(LDK_NODE);
        await renderFilter({ cashuEnabled: false });
        expect(shown(CASHU)).toBe(false);
    });

    it('hides the Cashu row on a node without ecash', async () => {
        setBackend(LND);
        await renderFilter({ cashuEnabled: true });
        expect(shown(CASHU)).toBe(false);
    });

    it('shows ZEUS Pay with the Lightning address setting and backend support', async () => {
        setBackend(LND);
        await renderFilter({ lightningAddressEnabled: true });
        expect(shown(ZEUS_PAY)).toBe(true);
    });

    it('hides ZEUS Pay on testnet, where the menu has no Lightning address', async () => {
        setBackend(LND);
        await renderFilter({ lightningAddressEnabled: true, testnet: true });
        expect(shown(ZEUS_PAY)).toBe(false);
    });

    it('hides ZEUS Pay when the setting is off', async () => {
        setBackend(LND);
        await renderFilter({ lightningAddressEnabled: false });
        expect(shown(ZEUS_PAY)).toBe(false);
    });

    it('hides ZEUS Pay when the backend has no Lightning address', async () => {
        setBackend(CLN);
        await renderFilter({ lightningAddressEnabled: true });
        expect(shown(ZEUS_PAY)).toBe(false);
    });
});

describe('ActivityFilter Services switch state', () => {
    const PARTIAL = 'switch:true:secondaryText';

    it('shows off when the shown service is off and a hidden one is on', async () => {
        setBackend(NWC);
        await renderFilter({ filters: swapsOff() });

        expect(screen.queryByText(PARTIAL)).toBeNull();
    });

    it('shows partial when one of the shown services is off', async () => {
        setBackend(LDK_NODE);
        await renderFilter({ filters: swapsOff() });

        expect(screen.queryByText(PARTIAL)).not.toBeNull();
    });
});

describe('ActivityFilter Services switch', () => {
    it('turns the shown services on with one tap, whatever the hidden ones hold', async () => {
        // swaps are the only shown service, all off; the hidden LSPS filters
        // keep their default (on)
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter({
            filters: swapsOff()
        });

        await filter.handleToggle('services');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.swaps).toBe(true);
        expect(applied.submarine).toBe(true);
        expect(applied.reverse).toBe(true);
    });

    it('leaves the hidden services as they are', async () => {
        setBackend(NWC);
        const filters = swapsOff();
        filters.lsps1 = false;
        filters.lsps7 = true;
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle('services');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.lsps1).toBe(false);
        expect(applied.lsps7).toBe(true);
        expect(applied.lsps7State).toEqual(filters.lsps7State);
    });

    it('leaves the hidden swap filters as they are on testnet', async () => {
        // swaps are not offered on testnet, but the node has LSPS
        setBackend(LDK_NODE);
        const { ActivityStore, filter } = await renderFilter({
            testnet: true
        });

        await filter.handleToggle('services');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.lsps1).toBe(false);
        expect(applied.lsps7).toBe(false);
        expect(applied.swaps).toBe(true);
        expect(applied.submarine).toBe(true);
        expect(applied.reverse).toBe(true);
        expect(applied.swapFilter).toEqual(DEFAULT_FILTERS.swapFilter);
    });

    it('turns all shown services off when they are on', async () => {
        setBackend(LDK_NODE);
        const { ActivityStore, filter } = await renderFilter();

        await filter.handleToggle('services');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.swaps).toBe(false);
        expect(applied.lsps1).toBe(false);
        expect(applied.lsps7).toBe(false);
    });

    it('turns all shown services on when they are all off', async () => {
        setBackend(LDK_NODE);
        const filters = swapsOff();
        filters.lsps1 = false;
        filters.lsps7 = false;
        Object.keys(filters.lsps1State).forEach(
            (state) => (filters.lsps1State[state] = false)
        );
        Object.keys(filters.lsps7State).forEach(
            (state) => (filters.lsps7State[state] = false)
        );
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle('services');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.swaps).toBe(true);
        expect(applied.lsps1).toBe(true);
        expect(applied.lsps7).toBe(true);
    });

    it('decides from the children when swaps was saved on with every child off', async () => {
        // filters saved before swaps followed its children can hold this
        setBackend(NWC);
        const filters = swapsOff();
        filters.swaps = true;
        filters.submarine = true;
        filters.reverse = true;
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle('services');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.swaps).toBe(true);
        Object.values(applied.swapFilter.submarine).forEach((on) =>
            expect(on).toBe(true)
        );
    });

    it('turns swaps off when submarine is off and reverse is on', async () => {
        setBackend(NWC);
        const filters = filtersWith({ submarine: false });
        Object.keys(filters.swapFilter.submarine).forEach(
            (state) => (filters.swapFilter.submarine[state] = false)
        );
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle('swaps');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.swaps).toBe(false);
        Object.values(applied.swapFilter.reverse).forEach((on) =>
            expect(on).toBe(false)
        );
    });

    it('turns swaps off when reverse is off and submarine is on', async () => {
        setBackend(NWC);
        const filters = filtersWith({ reverse: false });
        Object.keys(filters.swapFilter.reverse).forEach(
            (state) => (filters.swapFilter.reverse[state] = false)
        );
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle('swaps');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.swaps).toBe(false);
        Object.values(applied.swapFilter.submarine).forEach((on) =>
            expect(on).toBe(false)
        );
    });

    it('turns the Swaps row on with one tap when its children are all off', async () => {
        setBackend(NWC);
        const filters = swapsOff();
        filters.swaps = true;
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle('swaps');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.swaps).toBe(true);
        Object.values(applied.swapFilter.reverse).forEach((on) =>
            expect(on).toBe(true)
        );
    });
});

describe('ActivityFilter swap states', () => {
    // turns every state in the group's data off, one tap at a time. This
    // includes states its row does not offer, which a user cannot tap (see
    // 'swap states the rows show' below)
    const turnOffEachState = async (filter: any, store: any, group: string) => {
        for (const state of Object.keys(store.filters.swapFilter[group])) {
            await filter.handleToggle([group, state]);
            store.filters = store.setFilters.mock.calls.slice(-1)[0][0];
        }
    };

    it('clears swaps once every submarine and reverse state is off', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter();

        await turnOffEachState(filter, ActivityStore, 'submarine');
        expect(ActivityStore.filters.submarine).toBe(false);
        // reverse is still on
        expect(ActivityStore.filters.swaps).toBe(true);

        await turnOffEachState(filter, ActivityStore, 'reverse');

        expect(ActivityStore.filters.reverse).toBe(false);
        expect(ActivityStore.filters.swaps).toBe(false);
    });

    it('turns the Services switch on with one tap after every swap state was turned off', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter();
        await turnOffEachState(filter, ActivityStore, 'submarine');
        await turnOffEachState(filter, ActivityStore, 'reverse');
        ActivityStore.setFilters.mockClear();

        await filter.handleToggle('services');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.swaps).toBe(true);
        expect(applied.submarine).toBe(true);
        expect(applied.reverse).toBe(true);
    });
});

describe('ActivityFilter clear button', () => {
    const CLEAR = 'icon:general.clearChanges';

    it('is hidden while the applied filters are the defaults', async () => {
        setBackend(LDK_NODE);
        // a toggle hidden on this node is saved off, but it is not applied
        await renderFilter({
            filters: filtersWith({ circularRebalance: false }),
            effectiveFilters: filtersWith()
        });

        expect(screen.queryByText(CLEAR)).toBeNull();
    });

    it('is shown when an applied filter differs from the defaults', async () => {
        setBackend(LDK_NODE);
        const filters = filtersWith({ keysend: false });
        await renderFilter({ filters, effectiveFilters: filters });

        expect(screen.queryByText(CLEAR)).not.toBeNull();
    });
});

describe('ActivityFilter swap states the rows show', () => {
    // taps each state a row offers, as a user would
    const turnOffShown = async (
        filter: any,
        store: any,
        group: 'submarine' | 'reverse'
    ) => {
        for (const state of SWAP_FILTER_STATES[group]) {
            await filter.handleToggle([group, state]);
            store.filters = store.setFilters.mock.calls.slice(-1)[0][0];
        }
    };

    it('clears swaps once every shown submarine and reverse state is off', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter();

        await turnOffShown(filter, ActivityStore, 'submarine');
        await turnOffShown(filter, ActivityStore, 'reverse');

        expect(ActivityStore.filters.submarine).toBe(false);
        expect(ActivityStore.filters.reverse).toBe(false);
        expect(ActivityStore.filters.swaps).toBe(false);
    });

    it('shows the Swaps row off while both of its rows show off', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter();

        await turnOffShown(filter, ActivityStore, 'submarine');
        await turnOffShown(filter, ActivityStore, 'reverse');

        expect(filter.getServiceStates(ActivityStore.filters).swaps).toBe(
            'off'
        );
    });

    // filters whose shown states of a group are off while the group's flag and
    // the states its row does not offer are still on, as saved filters can be
    const withShownOff = (
        group: 'submarine' | 'reverse',
        except: string[] = []
    ) => {
        const filters = filtersWith();
        SWAP_FILTER_STATES[group].forEach((state) => {
            if (!except.includes(state)) {
                filters.swapFilter[group][state] = false;
            }
        });
        return filters;
    };

    it('turns the Submarine row on when its shown states are off but its flag is on', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter({
            filters: withShownOff('submarine')
        });

        await filter.handleToggle('submarine');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.submarine).toBe(true);
        SWAP_FILTER_STATES.submarine.forEach((state) =>
            expect(applied.swapFilter.submarine[state]).toBe(true)
        );
    });

    it('clears swaps when the last shown state of a row goes off and the other row shows off', async () => {
        setBackend(NWC);
        const last = SWAP_FILTER_STATES.submarine[0];
        const filters = withShownOff('submarine', [last]);
        const reverse = withShownOff('reverse');
        filters.swapFilter.reverse = reverse.swapFilter.reverse;
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle(['submarine', last]);

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.submarine).toBe(false);
        expect(applied.swaps).toBe(false);
    });

    it('clears swaps when the Submarine row is turned off and the Reverse row shows off', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter({
            filters: withShownOff('reverse')
        });

        await filter.handleToggle('submarine');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.submarine).toBe(false);
        expect(applied.swaps).toBe(false);
    });

    it('turns the Submarine row on with one tap after each of its states was turned off', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter();
        await turnOffShown(filter, ActivityStore, 'submarine');
        ActivityStore.setFilters.mockClear();

        await filter.handleToggle('submarine');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        SWAP_FILTER_STATES.submarine.forEach((state) =>
            expect(applied.swapFilter.submarine[state]).toBe(true)
        );
    });

    it('turns the Reverse row on with one tap after each of its states was turned off', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter();
        await turnOffShown(filter, ActivityStore, 'reverse');
        ActivityStore.setFilters.mockClear();

        await filter.handleToggle('reverse');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        SWAP_FILTER_STATES.reverse.forEach((state) =>
            expect(applied.swapFilter.reverse[state]).toBe(true)
        );
    });

    it('turns a partial Submarine row off and keeps swaps on while Reverse is on', async () => {
        setBackend(NWC);
        const filters = filtersWith();
        filters.swapFilter.submarine[SWAP_FILTER_STATES.submarine[0]] = false;
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle('submarine');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.submarine).toBe(false);
        expect(applied.swaps).toBe(true);
        SWAP_FILTER_STATES.submarine.forEach((state) =>
            expect(applied.swapFilter.submarine[state]).toBe(false)
        );
    });

    it('keeps the Submarine row and swaps on when one of its states goes off', async () => {
        setBackend(NWC);
        const { ActivityStore, filter } = await renderFilter();

        await filter.handleToggle([
            'submarine',
            SWAP_FILTER_STATES.submarine[0]
        ]);

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.submarine).toBe(true);
        expect(applied.swaps).toBe(true);
    });

    it('keeps swaps on when the last shown Submarine state goes off while Reverse is partial', async () => {
        setBackend(NWC);
        const last = SWAP_FILTER_STATES.submarine[0];
        const filters = withShownOff('submarine', [last]);
        filters.swapFilter.reverse[SWAP_FILTER_STATES.reverse[0]] = false;
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle(['submarine', last]);

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.submarine).toBe(false);
        expect(applied.swaps).toBe(true);
    });

    it('keeps swaps on when the Submarine row is turned off while Reverse is partial', async () => {
        setBackend(NWC);
        const filters = filtersWith();
        filters.swapFilter.reverse[SWAP_FILTER_STATES.reverse[0]] = false;
        const { ActivityStore, filter } = await renderFilter({ filters });

        await filter.handleToggle('submarine');

        const applied = ActivityStore.setFilters.mock.calls[0][0];
        expect(applied.submarine).toBe(false);
        expect(applied.swaps).toBe(true);
    });
});
