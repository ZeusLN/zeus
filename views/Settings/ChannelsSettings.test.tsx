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

const makeView = (supportsMinConfs: boolean) => {
    (BackendUtils.supportsChannelOpenMinConfs as jest.Mock).mockReturnValue(
        supportsMinConfs
    );
    return new ChannelsSettings({
        navigation: {},
        SettingsStore: { settings: {}, updateSettings: jest.fn() }
    } as unknown as React.ComponentProps<typeof ChannelsSettings>);
};

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
