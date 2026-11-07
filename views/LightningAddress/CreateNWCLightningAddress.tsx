import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import {
    ErrorMessage,
    SuccessMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import LightningAddressStore from '../../stores/LightningAddressStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import ValidationUtils from '../../utils/ValidationUtils';
import { checkNWCConnectionScope } from '../../utils/NWCScopeUtils';

import ZeusPayIcon from '../../assets/images/SVG/zeus-pay.svg';

interface CreateNWCLightningAddressProps {
    navigation: NativeStackNavigationProp<any, any>;
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
    scopeError: string;
    // set when the user must confirm before the server test runs
    scopeWarning: string;
}

@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class CreateNWCLightningAddress extends React.Component<
    CreateNWCLightningAddressProps,
    CreateNWCLightningAddressState
> {
    isInitialFocus = true;
    private unmounted = false;

    state = {
        nwcConnectionString: '',
        tested: false,
        loading: false,
        scopeError: '',
        scopeWarning: ''
    };

    componentWillUnmount() {
        this.unmounted = true;
    }

    // Checks the connection's own permissions before the string is sent
    // to the ZEUS Pay server. Returns true when the test may proceed.
    checkScope = async (nwcConnectionString: string): Promise<boolean> => {
        // the user already saw the warning and chose to continue
        if (this.state.scopeWarning) return true;

        this.setState({ loading: true, scopeError: '' });
        const { status, methods } = await checkNWCConnectionScope(
            nwcConnectionString
        );
        // the user left while get_info was pending
        if (this.unmounted) return false;
        this.setState({ loading: false });

        if (status === 'receiveOnly') return true;
        if (status === 'canSpend') {
            this.setState({
                scopeError: localeString(
                    'views.LightningAddress.NWC.scopeCanSpend'
                ).replace('{methods}', methods.join(', '))
            });
        } else if (status === 'missingMakeInvoice') {
            this.setState({
                scopeError: localeString(
                    'views.LightningAddress.NWC.scopeMissingMakeInvoice'
                )
            });
        } else if (status === 'unrecognized') {
            this.setState({
                scopeWarning: localeString(
                    'views.LightningAddress.NWC.scopeUnrecognized'
                ).replace('{methods}', methods.join(', '))
            });
        } else {
            this.setState({
                scopeWarning: localeString(
                    'views.LightningAddress.NWC.scopeUnknown'
                )
            });
        }
        return false;
    };

    render() {
        const { navigation, LightningAddressStore, route } = this.props;
        const { nwcConnectionString, tested, scopeError, scopeWarning } =
            this.state;
        const { createNWC, testNWCConnectionString, update, error_msg } =
            LightningAddressStore;
        const switchTo = route.params?.switchTo;
        const updateConnection = route.params?.updateConnection;

        const loading = this.state.loading || LightningAddressStore.loading;

        const nwcConnectionStringValid =
            ValidationUtils.isValidNostrWalletConnectUrl(nwcConnectionString);
        const nwcConnectionStringInvalid =
            !!nwcConnectionString && !nwcConnectionStringValid;

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
                        {!loading && !!scopeError && (
                            <ErrorMessage message={scopeError} />
                        )}
                        {!loading && !!scopeWarning && !tested && (
                            <WarningMessage message={scopeWarning} />
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
                                                        textColor={
                                                            nwcConnectionStringInvalid
                                                                ? themeColor(
                                                                      'error'
                                                                  )
                                                                : themeColor(
                                                                      'text'
                                                                  )
                                                        }
                                                        value={
                                                            nwcConnectionString
                                                        }
                                                        onChangeText={(
                                                            text: string
                                                        ) =>
                                                            this.setState({
                                                                nwcConnectionString:
                                                                    text.trim(),
                                                                scopeError: '',
                                                                scopeWarning: ''
                                                            })
                                                        }
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                        keyboardType="url"
                                                    />
                                                </>
                                            )}
                                        </View>
                                    </>
                                </View>
                                <View style={{ bottom: 15, margin: 10 }}>
                                    <Button
                                        title={
                                            !tested && scopeWarning
                                                ? localeString(
                                                      'views.LightningAddress.NWC.continueUnchecked'
                                                  )
                                                : !tested
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
                                                if (
                                                    !(await this.checkScope(
                                                        nwcConnectionString
                                                    ))
                                                ) {
                                                    return;
                                                }
                                                testNWCConnectionString(
                                                    nwcConnectionString
                                                )
                                                    .then((response) => {
                                                        if (response.success) {
                                                            this.setState({
                                                                tested: true
                                                            });
                                                        }
                                                    })
                                                    .catch((e) =>
                                                        console.log(
                                                            'Error testing NWC connection string',
                                                            e
                                                        )
                                                    );
                                            } else {
                                                if (
                                                    switchTo ||
                                                    updateConnection
                                                ) {
                                                    this.setState({
                                                        loading: true
                                                    });

                                                    try {
                                                        const response =
                                                            await update({
                                                                nwc_string:
                                                                    nwcConnectionString,
                                                                address_type:
                                                                    'nwc'
                                                            });
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
                                                    createNWC(
                                                        nwcConnectionString
                                                    )
                                                        .then((response) => {
                                                            if (
                                                                response.success
                                                            ) {
                                                                navigation.popTo(
                                                                    'LightningAddress'
                                                                );
                                                            }
                                                        })
                                                        .catch((e) =>
                                                            console.log(
                                                                'Error creating NWC Lightning address',
                                                                e
                                                            )
                                                        );
                                                }
                                            }
                                        }}
                                        disabled={
                                            loading || !nwcConnectionStringValid
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
