// models/Swap imports LocaleUtils, which imports Stores, which imports
// SwapStore. When models/Swap loads first, SwapStore runs before the Swap
// class is defined, so SwapStore must not use Swap at import time. This
// LocaleUtils mock loads SwapStore the way that chain does.
jest.mock('../utils/LocaleUtils', () => {
    require('./SwapStore');
    return { localeString: (key: string) => key };
});
// native modules and the store graph, none of which this test reaches
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@react-native-documents/picker', () => ({}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('./Stores', () => ({}));
jest.mock('./SettingsStore', () => ({}));

describe('SwapStore import order', () => {
    it('loads when models/Swap is imported before SwapStore', () => {
        expect(() => require('../models/Swap')).not.toThrow();
    });
});
