import * as React from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { ButtonGroup, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import LightningAddressPayment from './LightningAddressPayment';
import Button from '../../../components/Button';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import TextInput from '../../../components/TextInput';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';
import { Spacer } from '../../../components/layout/Spacer';

import LightningAddressStore from '../../../stores/LightningAddressStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface LightningAddressProps {
    navigation: any;
    LightningAddressStore: LightningAddressStore;
}

interface LightningAddressState {
    selectedIndex: number;
    newLightningAddress: string;
}

@inject('LightningAddressStore')
@observer
export default class LightningAddress extends React.Component<
    LightningAddressProps,
    LightningAddressState
> {
    state = {
        selectedIndex: 0,
        newLightningAddress: ''
    };

    async UNSAFE_componentWillMount() {
        const { LightningAddressStore } = this.props;
        const { getLightningAddress, status } = LightningAddressStore;

        getLightningAddress().then((result) => {
            if (result) status();
        });

        this.setState({
            newLightningAddress: ''
        });
    }

    render() {
        const { navigation, LightningAddressStore } = this.props;
        const { newLightningAddress, selectedIndex } = this.state;
        const {
            create,
            status,
            lightningAddress,
            availableHashes,
            paid,
            settled,
            fees,
            error_msg,
            loading
        } = LightningAddressStore;

        const InfoButton = () => (
            <View style={{ right: 15 }}>
                <Icon
                    name="info"
                    onPress={() => {
                        // TODO reset
                        navigation.navigate('LightningAddressInfo');
                        // this.props.LightningAddressStore.test_DELETE();
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        const SettingsButton = () => (
            <View>
                <Icon
                    name="settings"
                    onPress={() => {
                        navigation.navigate('LightningAddressSettings');
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={35}
                />
            </View>
        );

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: lightningAddress,
                        hideText: true,
                        jumboLabel: true
                    })
                }
                style={{ marginTop: 5 }}
            >
                <Icon
                    name="qr-code"
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={30}
                />
            </TouchableOpacity>
        );

        const statusGood = availableHashes > 500;

        const openOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {`${localeString('general.open')} (${paid.length})`}
            </Text>
        );

        const paidOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'Lato-Regular',
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {`${localeString('general.settled')} (${settled.length})`}
            </Text>
        );

        const buttons = [
            { element: openOrdersButton },
            { element: paidOrdersButton }
        ];

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.lightningAddress'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        rightComponent={
                            lightningAddress && (
                                <Row>
                                    {!loading && fees && <InfoButton />}
                                    <SettingsButton />
                                </Row>
                            )
                        }
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && lightningAddress && (
                            <View
                                style={{
                                    alignSelf: 'center',
                                    marginTop: 30,
                                    marginBottom: 30
                                }}
                            >
                                <Row
                                    style={{
                                        alignSelf: 'center'
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'Lato-Regular',
                                            fontSize: 25,
                                            color: themeColor('text'),
                                            textAlign: 'center'
                                        }}
                                    >
                                        {lightningAddress}
                                    </Text>
                                </Row>
                                <Row
                                    style={{
                                        alignSelf: 'center',
                                        marginTop: 4
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'Lato-Regular',

                                            color: themeColor('text'),
                                            textAlign: 'center'
                                        }}
                                    >
                                        {`${localeString(
                                            'views.Transaction.status'
                                        )}: `}
                                    </Text>
                                    <Text
                                        style={{
                                            fontFamily: 'Lato-Regular',
                                            color: statusGood
                                                ? themeColor('success')
                                                : themeColor('error'),
                                            textAlign: 'center'
                                        }}
                                    >
                                        {statusGood
                                            ? localeString('general.good')
                                            : localeString('general.bad')}
                                    </Text>
                                    <Text
                                        style={{
                                            fontFamily: 'Lato-Regular',
                                            fontSize: 11,
                                            color: themeColor('secondaryText'),
                                            left: 5
                                        }}
                                        infoText={[
                                            localeString(
                                                'views.Settings.LightningAddress.statusExplainer1'
                                            ),
                                            localeString(
                                                'views.Settings.LightningAddress.statusExplainer2'
                                            )
                                        ]}
                                    >
                                        {` (${availableHashes})`}
                                    </Text>
                                </Row>
                                <QRButton />
                            </View>
                        )}
                        {!loading && !lightningAddress && (
                            <>
                                <View
                                    style={{
                                        paddingTop: 5,
                                        paddingBottom: 5,
                                        paddingLeft: 15,
                                        paddingRight: 15
                                    }}
                                >
                                    <TextInput
                                        value={newLightningAddress}
                                        onChangeText={(text: string) => {
                                            this.setState({
                                                newLightningAddress: text
                                            });
                                        }}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        suffix="@lnolymp.us"
                                        right={150}
                                    />
                                </View>
                                <View style={{ margin: 10 }}>
                                    <Button
                                        title={localeString(
                                            'views.Settings.LightningAddress.create'
                                        )}
                                        onPress={() =>
                                            create(newLightningAddress).finally(
                                                () => status()
                                            )
                                        }
                                    />
                                </View>
                            </>
                        )}
                        {lightningAddress && (
                            <>
                                {!loading && (
                                    <ButtonGroup
                                        onPress={(selectedIndex: number) => {
                                            this.setState({ selectedIndex });
                                        }}
                                        selectedIndex={selectedIndex}
                                        buttons={buttons}
                                        selectedButtonStyle={{
                                            backgroundColor:
                                                themeColor('highlight'),
                                            borderRadius: 12
                                        }}
                                        containerStyle={{
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderRadius: 12,
                                            borderColor: themeColor('secondary')
                                        }}
                                        innerBorderStyle={{
                                            color: themeColor('secondary')
                                        }}
                                    />
                                )}
                                {!loading &&
                                    selectedIndex === 0 &&
                                    paid.length === 0 && (
                                        <TouchableOpacity
                                            style={{
                                                marginTop: 15,
                                                alignItems: 'center'
                                            }}
                                            onPress={() => status()}
                                        >
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.LightningAddress.noOpenPayments'
                                                )}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                {!loading &&
                                    selectedIndex === 1 &&
                                    settled.length === 0 && (
                                        <TouchableOpacity
                                            style={{
                                                marginTop: 15,
                                                alignItems: 'center'
                                            }}
                                            onPress={() => status()}
                                        >
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.LightningAddress.noSettledPayments'
                                                )}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                {!loading && selectedIndex === 0 && (
                                    <FlatList
                                        data={paid}
                                        renderItem={({
                                            item,
                                            index
                                        }: {
                                            item: any;
                                            index: number;
                                        }) => {
                                            return (
                                                <LightningAddressPayment
                                                    index={index}
                                                    item={item}
                                                    selectedIndex={
                                                        selectedIndex
                                                    }
                                                    navigation={navigation}
                                                />
                                            );
                                        }}
                                        ListFooterComponent={
                                            <Spacer height={100} />
                                        }
                                        onRefresh={() => status()}
                                        refreshing={loading}
                                        keyExtractor={(_, index) => `${index}`}
                                    />
                                )}
                                {!loading && selectedIndex === 1 && (
                                    <FlatList
                                        data={settled}
                                        renderItem={({
                                            item,
                                            index
                                        }: {
                                            item: any;
                                            index: number;
                                        }) => {
                                            return (
                                                <LightningAddressPayment
                                                    index={index}
                                                    item={item}
                                                    selectedIndex={
                                                        selectedIndex
                                                    }
                                                    navigation={navigation}
                                                />
                                            );
                                        }}
                                        ListFooterComponent={
                                            <Spacer height={100} />
                                        }
                                        onRefresh={() => status()}
                                        refreshing={loading}
                                        keyExtractor={(_, index) => `${index}`}
                                    />
                                )}
                            </>
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}
