jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/BackendUtils', () => ({
    isLNDBased: () => false,
    supportsSimpleTaprootChannels: () => false,
    supportsChannelOpenMinConfs: jest.fn(() => true)
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import ChannelsSettings from './ChannelsSettings';
import BackendUtils from '../../utils/BackendUtils';

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

const makeView = (supportsMinConfs: boolean, settings: any = {}) => {
    (BackendUtils.supportsChannelOpenMinConfs as jest.Mock).mockReturnValue(
        supportsMinConfs
    );
    const view = new ChannelsSettings({
        navigation: {},
        SettingsStore: {
            settings,
            getSettings: jest.fn(async () => settings),
            updateSettings: jest.fn()
        }
    } as unknown as React.ComponentProps<typeof ChannelsSettings>);
    // setState on a class that was never mounted does nothing, so apply it
    // directly
    jest.spyOn(view, 'setState').mockImplementation((update: any) => {
        view.state = { ...view.state, ...update };
    });
    return view;
};

const updateSettingsOf = (view: ChannelsSettings) =>
    view.props.SettingsStore.updateSettings as jest.Mock;

const findMinConfsInput = (view: ChannelsSettings) =>
    findElement(
        view.render(),
        (element) =>
            element.type === 'TextInput' && element.props.placeholder === '1'
    );

describe('ChannelsSettings min confs field', () => {
    it('is shown when the backend uses min confs', () => {
        expect(findMinConfsInput(makeView(true))).toBeDefined();
    });

    it('is hidden when the backend ignores min confs', () => {
        expect(findMinConfsInput(makeView(false))).toBeUndefined();
    });
});

describe('ChannelsSettings min confs default', () => {
    it.each([
        [0, '0'],
        [3, '3'],
        [undefined, '1']
    ])('a saved min confs of %s shows %s', async (saved, shown) => {
        const view = makeView(true, { channels: { min_confs: saved } });
        await view.componentDidMount();

        expect(findMinConfsInput(view).props.value).toBe(shown);
    });
});

describe('ChannelsSettings min confs input', () => {
    it('saves a typed 0', async () => {
        const view = makeView(true, { channels: { min_confs: 1 } });
        await findMinConfsInput(view).props.onChangeText('0');

        expect(view.state.min_confs).toBe(0);
        expect(updateSettingsOf(view)).toHaveBeenCalledWith({
            channels: { min_confs: 0 }
        });
    });

    it('saves a cleared field as unset, not 0', async () => {
        const view = makeView(true, { channels: { min_confs: 3 } });
        await findMinConfsInput(view).props.onChangeText('');

        expect(view.state.min_confs).toBeUndefined();
        expect(findMinConfsInput(view).props.value).toBe('');
        expect(updateSettingsOf(view)).toHaveBeenCalledWith({
            channels: { min_confs: undefined }
        });
    });
});
