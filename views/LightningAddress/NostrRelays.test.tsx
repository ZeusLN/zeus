jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/LightningAddressStore', () => ({}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../assets/images/SVG/Arrow_left.svg', () => 'ArrowLeft');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { FlatList } from 'react-native';
import NostrRelays from './NostrRelays';

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

// first element in the tree, depth first, that matches
const findElement = (node: any, match: (element: any) => boolean): any => {
    if (!React.isValidElement(node)) return undefined;
    if (match(node)) return node;
    for (const child of childrenOf(node)) {
        const found = findElement(child, match);
        if (found) return found;
    }
    return undefined;
};

const RELAY_A = 'wss://relay.a.example';
const RELAY_B = 'wss://relay.b.example';

const makeView = () => {
    const settings = {
        lightningAddress: {
            nostrPrivateKey: '01'.repeat(32),
            nostrRelays: [RELAY_A, RELAY_B]
        }
    };
    const view = new NostrRelays({
        navigation: {},
        route: { params: {} },
        SettingsStore: {
            settings,
            getSettings: jest.fn(async () => settings),
            updateSettingsGroup: jest.fn(async () => settings),
            settingsUpdateInProgress: false
        },
        LightningAddressStore: {
            update: jest.fn(async () => undefined),
            loading: false,
            error_msg: undefined
        }
    } as unknown as React.ComponentProps<typeof NostrRelays>);
    // setState on a class that was never mounted does nothing, so apply it
    // directly
    jest.spyOn(view, 'setState').mockImplementation((update: any) => {
        view.state = { ...view.state, ...update };
    });
    return view;
};

const removeButtonFor = (view: NostrRelays, relay: string) => {
    const list = findElement(
        view.render(),
        (element) => element.type === FlatList
    );
    return findElement(
        list.props.renderItem({ item: relay }),
        (element) =>
            element.type === 'Button' && element.props.icon?.name === 'minus'
    );
};

describe('NostrRelays remove', () => {
    it('saves the remaining relays under nostrRelays', async () => {
        const view = makeView();
        await view.componentDidMount();

        await removeButtonFor(view, RELAY_A).props.onPress();

        const { update } = view.props.LightningAddressStore as any;
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({ relays: [RELAY_B] })
        );
        const { updateSettingsGroup } = view.props.SettingsStore as any;
        expect(updateSettingsGroup).toHaveBeenCalledTimes(1);
        expect(updateSettingsGroup.mock.calls[0][0]).toBe('lightningAddress');
        const written = updateSettingsGroup.mock.calls[0][1];
        expect(written.nostrRelays).toEqual([RELAY_B]);
        expect(written).not.toHaveProperty('relays');
        expect(view.state.relays).toEqual([RELAY_B]);
    });
});
