import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import LightningAddressStore from '../../stores/LightningAddressStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';

interface CreateSelfLightningAddressProps {
    navigation: NativeStackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
    route: Route<'CreateSelfLightningAddress', { switchTo: boolean }>;
}

@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class CreateSelfLightningAddress extends React.Component<
    CreateSelfLightningAddressProps,
    { loading: boolean }
> {
    state = {
        loading: false
    };

    render() {
        const { navigation, LightningAddressStore, SettingsStore, route } =
            this.props;
        const { createSelf, update, currentDeviceToken, error_msg } =
            LightningAddressStore;
        const switchTo = route.params?.switchTo;

        const loading = this.state.loading || LightningAddressStore.loading;

        const InfoButton = () => (
            <View>
                <Icon
                    name="info"
                    onPress={() => {
                        navigation.navigate('SelfAddressInfo');
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={
                            <ZeusPayIcon
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                            />
                        }
                        rightComponent={
                            !loading ? (
                                <Row>
                                    <InfoButton />
                                </Row>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && !currentDeviceToken && (
                            <WarningMessage
                                message={localeString(
                                    'views.Settings.LightningAddress.self.deviceTokenRequired'
                                )}
                            />
                        )}
                        {!loading && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.wrapper}>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text'),
                                                fontSize: 18
                                            }}
                                        >
                                            {localeString(
                                                'views.LightningAddress.Self.explainer1'
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontSize: 16,
                                                marginTop: 20
                                            }}
                                        >
                                            {localeString(
                                                'views.LightningAddress.Self.explainer2'
                                            )}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ bottom: 15, margin: 10 }}>
                                    <Button
                                        title={
                                            switchTo
                                                ? localeString(
                                                      'views.Settings.LightningAddress.switchToSelf'
                                                  )
                                                : localeString(
                                                      'views.Settings.LightningAddress.create'
                                                  )
                                        }
                                        onPress={async () => {
                                            if (switchTo) {
                                                this.setState({
                                                    loading: true
                                                });
                                                try {
                                                    const response =
                                                        await update({
                                                            address_type:
                                                                'self',
                                                            device_token:
                                                                currentDeviceToken
                                                        });
                                                    await SettingsStore.updateSettings(
                                                        {
                                                            lightningAddress: {
                                                                notifications: 1
                                                            }
                                                        }
                                                    );
                                                    if (response.success) {
                                                        navigation.popTo(
                                                            'LightningAddress'
                                                        );
                                                        return;
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                }
                                                this.setState({
                                                    loading: false
                                                });
                                            } else {
                                                createSelf().then(
                                                    (response) => {
                                                        if (response.success) {
                                                            navigation.popTo(
                                                                'LightningAddress'
                                                            );
                                                        }
                                                    }
                                                );
                                            }
                                        }}
                                        disabled={
                                            !currentDeviceToken || loading
                                        }
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    wrapper: {
        margin: 10
    }
});
