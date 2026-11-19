jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../stores/Stores');
jest.mock('../../../stores/SettingsStore', () => ({}));
jest.mock('../../../utils/LocaleUtils');
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../../utils/RestartUtils', () => ({ restartNeeded: jest.fn() }));
jest.mock('../../../utils/LdkNodeUtils', () => ({
    DEFAULT_SCORER_URL: 'https://scorer.default'
}));
jest.mock('../../../components/Button', () => 'Button');
jest.mock('../../../components/Header', () => 'Header');
jest.mock('../../../components/Screen', () => 'Screen');
jest.mock('../../../components/TextInput', () => 'TextInput');

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import PathfindingScorer from './PathfindingScorer';

const shownUrl = async (node: any) => {
    const SettingsStore = {
        settings: { selectedNode: 0, nodes: [node] },
        updateSelectedNode: jest.fn()
    };
    await render(
        <PathfindingScorer
            navigation={{} as any}
            SettingsStore={SettingsStore as any}
        />
    );
    return screen.container.queryAll((n) => n.type === 'TextInput')[0].props
        .value;
};

describe('PathfindingScorer', () => {
    it('shows the default URL when the node has none stored', async () => {
        expect(await shownUrl({ implementation: 'ldk-node' })).toBe(
            'https://scorer.default'
        );
    });

    it('shows a blank URL when the node stores a blank', async () => {
        expect(
            await shownUrl({ implementation: 'ldk-node', ldkScorerUrl: '' })
        ).toBe('');
    });
});
