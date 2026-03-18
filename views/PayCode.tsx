import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ButtonGroup } from '@rneui/themed';

import Button from '../components/Button';
import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Text from '../components/Text';
import { ErrorMessage } from '../components/SuccessErrorMessage';

import { confirmAction } from '../utils/ActionUtils';
import { getButtonGroupStyles } from '../utils/buttonGroupStyles';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import OffersStore from '../stores/OffersStore';
import SettingsStore from '../stores/SettingsStore';

interface PayCodeProps {
    navigation: NativeStackNavigationProp<any, any>;
    OffersStore: OffersStore;
    SettingsStore: SettingsStore;
    route: Route<'PayCode', { payCode: any; startOnQrTab?: boolean }>;
}

interface PayCodeState {
    payCode: any;
    infoIndex: number;
}

@inject('OffersStore', 'SettingsStore')
@observer
export default class PayCodeView extends React.Component<
    PayCodeProps,
    PayCodeState
> {
    constructor(props: PayCodeProps) {
        super(props);
        const { route } = props;
        const { payCode, startOnQrTab } = route.params ?? {};

        this.state = {
            payCode,
            infoIndex: startOnQrTab ? 1 : 0
        };
    }

    componentDidMount() {
        this.props.OffersStore.error_msg = '';
        this.props.OffersStore.error = false;
    }

    render() {
        const { navigation, OffersStore, SettingsStore } = this.props;
        const { payCode, infoIndex } = this.state;
        const { active, label, single_use, offer_id, bolt12, used } = payCode;
        const { loading, error_msg } = OffersStore;
        const supportsLabels =
            SettingsStore!.implementation !== 'embedded-ldk-node';

        const qrValue = `lightning:${bolt12}`;

        const groupStyles = getButtonGroupStyles();

        const infoButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('general.info')}
            </Text>
        );
        const qrButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('general.qr')}
            </Text>
        );

        const tabButtons: any = [
            { element: infoButton },
            { element: qrButton }
        ];

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.paycode'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? (
                            <View>
                                <LoadingIndicator size={30} />
                            </View>
                        ) : (
                            <></>
                        )
                    }
                    navigation={navigation}
                />

                <ScrollView keyboardShouldPersistTaps="handled">
                    {error_msg && <ErrorMessage message={error_msg} />}

                    <ButtonGroup
                        onPress={(index: number) => {
                            this.setState({ infoIndex: index });
                        }}
                        selectedIndex={infoIndex}
                        buttons={tabButtons}
                        selectedButtonStyle={groupStyles.selectedButtonStyle}
                        containerStyle={groupStyles.containerStyle}
                        innerBorderStyle={groupStyles.innerBorderStyle}
                    />

                    {infoIndex === 0 && (
                        <View style={styles.content}>
                            <KeyValue
                                keyValue={localeString('general.active')}
                                value={
                                    active
                                        ? localeString('general.true')
                                        : localeString('general.false')
                                }
                                color={
                                    active
                                        ? themeColor('success')
                                        : themeColor('error')
                                }
                            />

                            <KeyValue
                                keyValue={localeString('general.used')}
                                value={
                                    used
                                        ? localeString('general.true')
                                        : localeString('general.false')
                                }
                                color={
                                    used
                                        ? themeColor('success')
                                        : themeColor('error')
                                }
                            />

                            <KeyValue
                                keyValue={localeString('general.type')}
                                value={
                                    single_use
                                        ? localeString(
                                              'views.PayCode.singleUse'
                                          )
                                        : localeString('views.PayCode.multiUse')
                                }
                            />

                            {supportsLabels && (
                                <KeyValue
                                    keyValue={localeString('general.label')}
                                    value={
                                        label || localeString('general.noLabel')
                                    }
                                />
                            )}

                            <KeyValue
                                keyValue={localeString('views.PayCode.offerId')}
                                value={offer_id}
                            />

                            {bolt12 && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PayCode.bolt12'
                                    )}
                                    value={bolt12}
                                />
                            )}
                        </View>
                    )}

                    {infoIndex === 1 && (
                        <View style={styles.content}>
                            <CollapsedQR
                                value={qrValue}
                                copyValue={qrValue}
                                expanded
                                showShare
                                iconOnly
                                textBottom
                                truncateLongValue
                            />
                        </View>
                    )}
                </ScrollView>

                {infoIndex === 0 && (
                    <View style={{ bottom: 15 }}>
                        {!loading && active && (
                            <Button
                                title={localeString(
                                    'views.PayCode.disableOffer'
                                )}
                                warning
                                onPress={() => {
                                    confirmAction(
                                        localeString(
                                            'views.PayCode.disableOffer'
                                        ),
                                        localeString(
                                            'views.PayCode.disableOffer.confirm'
                                        ),
                                        {
                                            text: localeString(
                                                'views.PayCode.disableOffer'
                                            ),
                                            style: 'destructive',
                                            onPress: () => {
                                                OffersStore.disableOffer(
                                                    offer_id
                                                ).then((data: any) => {
                                                    this.setState({
                                                        payCode: data
                                                    });
                                                });
                                            }
                                        },
                                        {
                                            text: localeString(
                                                'general.cancel'
                                            ),
                                            onPress: () => void 0,
                                            isPreferred: true
                                        }
                                    );
                                }}
                            />
                        )}
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    }
});
