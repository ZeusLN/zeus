import * as React from 'react';
import { View } from 'react-native';

import { Header, Icon } from 'react-native-elements';

import { inject, observer } from 'mobx-react';

import LayerBalances from './../../components/LayerBalances';
import LoadingIndicator from './../../components/LoadingIndicator';

import BalanceStore from './../../stores/BalanceStore';
import UnitsStore from './../../stores/UnitsStore';
import UTXOsStore from './../../stores/UTXOsStore';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface AccountsProps {
    navigation: any;
    BalanceStore: BalanceStore;
    UTXOsStore: UTXOsStore;
    UnitsStore: UnitsStore;
}

@inject('BalanceStore', 'UTXOsStore', 'UnitsStore')
@observer
export default class Accounts extends React.Component<AccountsProps, {}> {
    UNSAFE_componentWillMount() {
        const { UTXOsStore } = this.props;
        UTXOsStore.listAccounts();
    }

    render() {
        const { BalanceStore, UnitsStore, UTXOsStore, navigation } = this.props;
        const { loadingAccounts } = UTXOsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    navigation.navigate('Settings', { refresh: true })
                }
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const AddButton = () => (
            <Icon
                name="add"
                onPress={() => navigation.navigate('ImportAccount')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{ flex: 1, backgroundColor: themeColor('background') }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Accounts.title'),
                        style: { color: themeColor('text') }
                    }}
                    rightComponent={<AddButton />}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                {loadingAccounts && <LoadingIndicator />}
                {!loadingAccounts && (
                    <LayerBalances
                        navigation={navigation}
                        BalanceStore={BalanceStore}
                        UnitsStore={UnitsStore}
                        onRefresh={async () =>
                            await Promise.all([
                                BalanceStore.getBlockchainBalance(),
                                BalanceStore.getLightningBalance(),
                                UTXOsStore.listAccounts()
                            ])
                        }
                        refreshing={
                            BalanceStore.loadingLightningBalance ||
                            BalanceStore.loadingBlockchainBalance ||
                            UTXOsStore.loadingAccounts
                        }
                    />
                )}
            </View>
        );
    }
}
