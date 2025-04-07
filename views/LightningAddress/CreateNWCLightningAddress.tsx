import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import {
    ErrorMessage,
    SuccessMessage
} from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import LightningAddressStore from '../../stores/LightningAddressStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';

interface CreateNWCLightningAddressProps {
    navigation: StackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
    route: Route<
        'CreateNWCLightningAddress',
        { switchTo: boolean; updateConnection: boolean }
    >;
}

interface CreateNWCLightningAddressState {
    nwcConnectionString: string;
    tested: boolean;
    loading: boolean;
}

@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class CreateNWCLightningAddress extends React.Component<
    CreateNWCLightningAddressProps,
    CreateNWCLightningAddressState
> {
    isInitialFocus = true;

    state = {
        nwcConnectionString: '',
        tested: false,
        loading: false
    };

    render() {
        const { navigation, LightningAddressStore, route } = this.props;
        const { nwcConnectionString, tested } = this.state;
        const { createNWC, testNWCConnectionString, update, fees, error_msg } =
            LightningAddressStore;
        const switchTo = route.params?.switchTo;
        const updateConnection = route.params?.updateConnection;

        const loading = this.state.loading || LightningAddressStore.loading;

        const InfoButton = () => (
            <View>
                <Icon
                    name="info"
                    onPress={() => {
                        navigation.navigate('NWCAddressInfo');
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
                                <Row>{fees && <InfoButton />}</Row>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && tested && (
                            <SuccessMessage
                                message={localeString(
                                    'views.Settings.LightningAddress.connectionTestSuccess'
                                )}
                                dismissable
                            />
                        )}
                        {!loading && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <>
                                        <View style={styles.wrapper}>
                                            {!tested && (
                                                <>
                                                    <Text
                                                        style={{
                                                            ...styles.text,
                                                            color: themeColor(
                                                                'secondaryText'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.Settings.WalletConfiguration.nostrWalletConnectUrl'
                                                        )}
                                                    </Text>
                                                    <TextInput
                                                        placeholder={
                                                            'nostr+walletconnect://'
                                                        }
                                                        value={
                                                            nwcConnectionString
                                                        }
                                                        onChangeText={(
                                                            text: string
                                                        ) =>
                                                            this.setState({
                                                                nwcConnectionString:
                                                                    text
                                                            })
                                                        }
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                    />
                                                </>
                                            )}
                                        </View>
                                    </>
                                </View>
                                <View style={{ bottom: 15, margin: 10 }}>
                                    <Button
                                        title={
                                            !tested
                                                ? localeString(
                                                      'views.Settings.LightningAddress.testConnectionString'
                                                  )
                                                : updateConnection
                                                ? localeString(
                                                      'views.Settings.LightningAddress.changeConnectionString'
                                                  )
                                                : switchTo
                                                ? localeString(
                                                      'views.Settings.LightningAddress.switchToNWC'
                                                  )
                                                : localeString(
                                                      'views.Settings.LightningAddress.create'
                                                  )
                                        }
                                        onPress={async () => {
                                            if (!tested) {
                                                testNWCConnectionString(
                                                    nwcConnectionString
                                                ).then((response) => {
                                                    if (response.success) {
                                                        this.setState({
                                                            tested: true
                                                        });
                                                    }
                                                });
                                            } else {
                                                if (
                                                    switchTo ||
                                                    updateConnection
                                                ) {
                                                    this.setState({
                                                        loading: true
                                                    });

                                                    await update({
                                                        nwc_string:
                                                            nwcConnectionString,
                                                        address_type: 'nwc'
                                                    }).then(
                                                        async (response) => {
                                                            if (
                                                                response.success
                                                            ) {
                                                                navigation.popTo(
                                                                    'LightningAddress'
                                                                );
                                                            } else {
                                                                this.setState({
                                                                    loading:
                                                                        false
                                                                });
                                                            }
                                                        }
                                                    );
                                                } else {
                                                    createNWC(
                                                        nwcConnectionString
                                                    ).then((response) => {
                                                        if (response.success) {
                                                            navigation.popTo(
                                                                'LightningAddress'
                                                            );
                                                        }
                                                    });
                                                }
                                            }
                                        }}
                                        disabled={
                                            !nwcConnectionString || loading
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
