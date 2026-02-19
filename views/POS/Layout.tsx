import * as React from 'react';
import { Animated, View, Text, TouchableOpacity } from 'react-native';
import { ButtonGroup } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import FiatStore from '../../stores/FiatStore';

import { localeString } from '../../utils/LocaleUtils';
import { protectedNavigation } from '../../utils/NavigationUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { version } from '../../package.json';

interface LayoutProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore?: SettingsStore;
    NodeInfoStore?: NodeInfoStore;
    FiatStore?: FiatStore;

    title: string;
    loading: boolean;
    selectedIndex: number;
    buttons: React.JSX.Element[];
    onIndexChange: (index: number) => void;
    children: React.ReactNode;
    fadeAnimation: any;
}

@inject('SettingsStore', 'NodeInfoStore', 'FiatStore')
@observer
export default class Layout extends React.PureComponent<LayoutProps> {
    renderErrorScreen = () => {
        const { SettingsStore, NodeInfoStore, navigation } = this.props;
        return (
            <View
                style={{
                    backgroundColor: themeColor('error'),
                    paddingTop: 20,
                    paddingLeft: 10,
                    flex: 1
                }}
            >
                <Text
                    style={{
                        fontFamily: 'PPNeueMontreal-Book',
                        color: '#fff',
                        fontSize: 20,
                        marginTop: 20,
                        marginBottom: 25
                    }}
                >
                    {SettingsStore?.errorMsg ||
                        NodeInfoStore?.errorMsg ||
                        localeString('views.Wallet.MainPane.error')}
                </Text>
                <Button
                    icon={{ name: 'settings', size: 25, color: '#fff' }}
                    title={localeString('views.Wallet.MainPane.goToSettings')}
                    buttonStyle={{ backgroundColor: 'gray' }}
                    containerStyle={{ alignItems: 'center' }}
                    onPress={() => protectedNavigation(navigation, 'Menu')}
                    adaptiveWidth
                />
                <Text
                    style={{
                        fontFamily: 'PPNeueMontreal-Book',
                        color: '#fff',
                        fontSize: 12,
                        marginTop: 20,
                        marginBottom: -40
                    }}
                >
                    {`v${version}`}
                </Text>
            </View>
        );
    };

    renderRateDisplay = () => {
        const { FiatStore, SettingsStore, fadeAnimation } = this.props;
        const getRate = FiatStore?.getRate || (() => '$N/A');
        const getFiatRates = FiatStore?.getFiatRates || (() => {});
        const fiatEnabled = SettingsStore?.settings?.fiatEnabled;

        if (!fiatEnabled) return null;

        return getRate() === '$N/A' && !FiatStore?.error ? (
            <Animated.View
                style={{ alignSelf: 'center', opacity: fadeAnimation }}
            >
                <Text style={{ color: themeColor('text'), marginBottom: 10 }}>
                    {localeString('pos.views.Wallet.PosPane.fetchingRates')}
                </Text>
            </Animated.View>
        ) : (
            <TouchableOpacity onPress={() => getFiatRates()}>
                <Text
                    style={{
                        color:
                            getRate() === '$N/A'
                                ? themeColor('error')
                                : themeColor('text'),
                        alignSelf: 'center',
                        marginBottom: 10
                    }}
                >
                    {getRate() === '$N/A'
                        ? localeString('general.fiatFetchError')
                        : getRate()}
                </Text>
            </TouchableOpacity>
        );
    };

    render() {
        const {
            title,
            navigation,
            loading,
            selectedIndex,
            buttons,
            onIndexChange,
            children,
            SettingsStore,
            NodeInfoStore
        } = this.props;

        const error = NodeInfoStore?.error || SettingsStore?.error;

        if (error) {
            return this.renderErrorScreen();
        }

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    title={title}
                    navigation={navigation}
                    SettingsStore={SettingsStore}
                />

                {this.renderRateDisplay()}

                {!loading && (
                    <ButtonGroup
                        onPress={onIndexChange}
                        selectedIndex={selectedIndex}
                        buttons={buttons}
                        selectedButtonStyle={{
                            backgroundColor: themeColor('highlight'),
                            borderRadius: 12
                        }}
                        containerStyle={{
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 12,
                            borderColor: themeColor('secondary')
                        }}
                        innerBorderStyle={{ color: themeColor('secondary') }}
                    />
                )}

                {loading && (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                )}

                {!loading && children}
            </View>
        );
    }
}
