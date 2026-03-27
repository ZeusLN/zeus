import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '@rneui/themed';

import Button from '../components/Button';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Switch from '../components/Switch';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import {
    ErrorMessage,
    WarningMessage
} from '../components/SuccessErrorMessage';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ChannelsStore from '../stores/ChannelsStore';
import ModalStore from '../stores/ModalStore';
import OffersStore from '../stores/OffersStore';
import SettingsStore from '../stores/SettingsStore';

interface PayCodeCreateProps {
    navigation: NativeStackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    ModalStore: ModalStore;
    OffersStore: OffersStore;
    SettingsStore: SettingsStore;
}

interface PayCodeCreateState {
    description: string;
    label: string;
    singleUse: boolean;
}

@inject('ChannelsStore', 'ModalStore', 'OffersStore', 'SettingsStore')
@observer
export default class PayCodeCreateView extends React.Component<
    PayCodeCreateProps,
    PayCodeCreateState
> {
    constructor(props: PayCodeCreateProps) {
        super(props);
        this.state = {
            description: '',
            label: '',
            singleUse: false
        };
    }

    componentDidMount() {
        this.props.OffersStore.error_msg = '';
        this.props.OffersStore.error = false;
    }

    render() {
        const {
            navigation,
            ChannelsStore,
            ModalStore,
            OffersStore,
            SettingsStore
        } = this.props;
        const { description, label, singleUse } = this.state;
        const { loading, error_msg } = OffersStore;
        const hasOpenChannels = ChannelsStore.channels.length > 0;
        const supportsLabels =
            SettingsStore!.implementation !== 'embedded-ldk-node';

        const InfoButton = () => (
            <View style={{ marginRight: 5 }}>
                <Icon
                    name="info"
                    onPress={() => {
                        ModalStore.toggleInfoModal({
                            title: localeString('views.PayCode.createOffer'),
                            text: [
                                localeString('views.PayCode.infoModal.line1'),
                                localeString('views.PayCode.infoModal.line2'),
                                localeString('views.PayCode.infoModal.line3'),
                                localeString('general.bolt12Requirement')
                            ]
                        });
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={30}
                />
            </View>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.PayCode.createOffer'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={<InfoButton />}
                    navigation={navigation}
                />

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {error_msg && <ErrorMessage message={error_msg} />}
                    {!hasOpenChannels && (
                        <WarningMessage
                            message={localeString(
                                'views.PayCode.noChannelsWarning'
                            )}
                        />
                    )}

                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('views.PaymentRequest.description')}
                    </Text>
                    <TextInput
                        placeholder={'Offer for...'}
                        value={description}
                        onChangeText={(text: string) =>
                            this.setState({ description: text })
                        }
                        locked={loading}
                    />

                    {supportsLabels && (
                        <>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString(
                                    'views.PayCode.internalLabel'
                                )} (${localeString('general.optional')})`}
                            </Text>
                            <TextInput
                                placeholder={'My pay code'}
                                value={label}
                                onChangeText={(text: string) =>
                                    this.setState({ label: text })
                                }
                                locked={loading}
                            />
                        </>
                    )}

                    <>
                        <Text
                            style={{
                                top: 25,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.PayCode.singleUse')}
                        </Text>
                        <Switch
                            value={singleUse}
                            onValueChange={() => {
                                this.setState({
                                    singleUse: !singleUse
                                });
                            }}
                        />
                    </>
                </ScrollView>
                <View style={{ bottom: 15 }}>
                    {loading && <LoadingIndicator />}
                    {!loading && (
                        <Button
                            title={localeString('views.PayCode.createOffer')}
                            onPress={() => {
                                OffersStore.createOffer({
                                    description,
                                    label,
                                    singleUse
                                }).then((result) => {
                                    if (result) {
                                        navigation.replace('PayCode', {
                                            payCode: result,
                                            startOnQrTab: true
                                        });
                                    }
                                });
                            }}
                            disabled={!hasOpenChannels}
                        />
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
