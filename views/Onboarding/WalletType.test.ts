jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../utils/LocaleUtils');

import WalletType from './WalletType';

const select = (params: any, enableCashu: boolean) => {
    const navigation = { navigate: jest.fn(), popTo: jest.fn() };
    const view = new WalletType({
        navigation: navigation as any,
        route: { params } as any,
        ModalStore: {} as any
    });
    view.handleSelect(enableCashu);
    return navigation;
};

describe('WalletType', () => {
    it('continues to the node choice during the questionnaire', () => {
        const navigation = select(undefined, true);

        expect(navigation.navigate).toHaveBeenCalledWith('NodeChoice', {
            enableCashu: true
        });
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    // navigate() would push a second summary in React Navigation 7, so Back
    // from it would land here instead of on the setup choice
    it('returns to the summary it was opened from', () => {
        const navigation = select({ returnTo: 'RecommendedSettings' }, false);

        expect(navigation.popTo).toHaveBeenCalledWith('RecommendedSettings', {
            enableCashu: false
        });
        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});
