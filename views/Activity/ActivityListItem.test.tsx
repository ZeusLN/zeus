import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@rneui/themed', () => {
    const { View, Text } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Content = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    ListItem.Subtitle = ({ children }: any) => <Text>{children}</Text>;
    return { ListItem };
});
// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));
jest.mock('../../components/Amount', () => () => null);
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));
jest.mock('../../utils/PrivacyUtils', () => ({
    sensitiveValue: ({ input }: any) => input
}));
// the list item only uses the models for instanceof checks
jest.mock('../../models/Invoice', () => class {});
jest.mock('../../models/CashuInvoice', () => class {});
jest.mock('../../models/CashuPayment', () => class {});
jest.mock('../../models/CashuToken', () => class {});
jest.mock('../../models/Swap', () => ({
    SwapType: { Submarine: 'Submarine', Reverse: 'Reverse' }
}));
jest.mock('../../stores/SwapStore', () => ({}));

import ActivityListItem from './ActivityListItem';

const renderOrder = (model: string, state: any) =>
    render(
        <ActivityListItem
            item={{
                model,
                id: 'order-1',
                state,
                getAmount: 0,
                getDisplayTimeShort: 'Nov 17'
            }}
            onItemPress={jest.fn()}
            swapStore={{} as any}
        />
    );

describe('ActivityListItem LSP orders', () => {
    describe.each(['LSPS1Order', 'LSPS7Order'])('%s', (model) => {
        it('shows the order state', async () => {
            await renderOrder(model, 'COMPLETED');

            expect(
                screen.getByText('general.state: Completed')
            ).toBeOnTheScreen();
        });

        it('renders an order with no state', async () => {
            await renderOrder(model, undefined);

            expect(screen.getByText('general.state:')).toBeOnTheScreen();
        });

        it('renders an order whose state is an object', async () => {
            await renderOrder(model, { state: 'COMPLETED' });

            expect(
                screen.getByText('general.state: [object object]')
            ).toBeOnTheScreen();
        });
    });
});
