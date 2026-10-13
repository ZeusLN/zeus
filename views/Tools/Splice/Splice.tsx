import * as React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ButtonGroup } from '@rneui/themed';
import Clipboard from '@react-native-clipboard/clipboard';

import AddressInput from '../../../components/AddressInput';
import Amount from '../../../components/Amount';
import AmountInput from '../../../components/AmountInput';
import Button from '../../../components/Button';
import { ChannelItem } from '../../../components/Channels/ChannelItem';
import Header from '../../../components/Header';
import HopPicker from '../../../components/HopPicker';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import { Row } from '../../../components/layout/Row';

import Channel from '../../../models/Channel';

import AddressUtils from '../../../utils/AddressUtils';
import { getButtonGroupStyles } from '../../../utils/buttonGroupStyles';
import { localeString } from '../../../utils/LocaleUtils';
import {
    SpliceDirection,
    getSpliceAmountError,
    getSpliceOutAvailableSats
} from '../../../utils/SpliceUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import ChannelsStore from '../../../stores/ChannelsStore';
import SpliceStore from '../../../stores/SpliceStore';
import UnitsStore from '../../../stores/UnitsStore';

import { SpliceReviewParams } from './SpliceReview';

import CloseIcon from '../../../assets/images/SVG/Close.svg';

interface SpliceProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'Splice', { scannedAddress?: string }>;
    ChannelsStore: ChannelsStore;
    SpliceStore: SpliceStore;
    UnitsStore: UnitsStore;
}

interface SpliceState {
    direction: SpliceDirection;
    channel: Channel | null;
    amount: string;
    satAmount: number;
    // Splice-out destination; empty means our own wallet
    address: string;
}

const DIRECTIONS: SpliceDirection[] = ['in', 'out'];

@inject('ChannelsStore', 'SpliceStore', 'UnitsStore')
@observer
export default class Splice extends React.Component<SpliceProps, SpliceState> {
    private focusListener: (() => void) | undefined;

    state: SpliceState = {
        direction: 'in',
        channel: null,
        amount: '',
        satAmount: 0,
        address: ''
    };

    componentDidMount() {
        const { navigation, SpliceStore } = this.props;

        SpliceStore.reset();

        // Also fires on first focus. Balances change after a splice, so they
        // are reloaded whenever the user comes back to the form.
        this.focusListener = navigation.addListener('focus', () => {
            this.props.ChannelsStore.getChannels();
            this.props.SpliceStore.loadSpliceInAvailable();
        });
    }

    componentDidUpdate(prevProps: Readonly<SpliceProps>) {
        const { route, navigation } = this.props;
        const scannedAddress = route.params?.scannedAddress;

        if (
            scannedAddress &&
            scannedAddress !== prevProps.route.params?.scannedAddress
        ) {
            this.setState({ address: scannedAddress });
            navigation.setParams({ scannedAddress: undefined });
        }
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    private validateChannel = (channel: Channel): boolean => {
        if (!channel.isActive) {
            Alert.alert(
                localeString('general.error'),
                localeString('views.Splice.error.channelInactive')
            );
            return false;
        }
        return true;
    };

    private getAvailableSats = (): number | null => {
        const { direction, channel } = this.state;
        if (direction === 'in') {
            return this.props.SpliceStore.spliceInAvailableSats;
        }
        return channel
            ? getSpliceOutAvailableSats(channel.sendingCapacity)
            : null;
    };

    private getAmountError = (): string | null => {
        const { direction, amount, satAmount } = this.state;
        const availableSats = this.getAvailableSats();
        if (!amount || availableSats === null) return null;
        return getSpliceAmountError(direction, satAmount, availableSats);
    };

    private getAddressError = (): string | null => {
        const { direction, address } = this.state;
        if (direction !== 'out' || !address) return null;
        return AddressUtils.isValidBitcoinAddressForNode(address)
            ? null
            : localeString('views.Splice.error.invalidAddress');
    };

    private onPaste = async () => {
        const text = await Clipboard.getString();
        const { value } = AddressUtils.processBIP21Uri(text.trim());
        this.setState({ address: value || '' });
    };

    private onReview = () => {
        const { navigation } = this.props;
        const { direction, channel, satAmount, address } = this.state;
        if (!channel) return;

        const params: SpliceReviewParams = {
            direction,
            fundingTxid: channel.channel_point.split(':')[0],
            channelName: channel.displayName || '',
            capacitySats: Number(channel.capacity),
            amountSats: satAmount,
            address: direction === 'out' && address ? address : undefined
        };
        navigation.navigate('SpliceReview', params);
    };

    private renderDirectionToggle = () => {
        const { direction } = this.state;
        const selectedIndex = DIRECTIONS.indexOf(direction);
        const groupStyles = getButtonGroupStyles();

        const buttonElement = (title: string, index: number) => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === index
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {title}
            </Text>
        );

        return (
            <ButtonGroup
                onPress={(index: number) =>
                    this.setState({ direction: DIRECTIONS[index] })
                }
                selectedIndex={selectedIndex}
                buttons={[
                    {
                        element: () =>
                            buttonElement(
                                localeString('views.Splice.confirmIn'),
                                0
                            )
                    },
                    {
                        element: () =>
                            buttonElement(
                                localeString('views.Splice.confirmOut'),
                                1
                            )
                    }
                ]}
                selectedButtonStyle={groupStyles.selectedButtonStyle}
                containerStyle={groupStyles.containerStyle}
                innerBorderStyle={groupStyles.innerBorderStyle}
            />
        );
    };

    private renderDestinationSection = () => {
        const { address } = this.state;
        const addressError = this.getAddressError();

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    {localeString('general.destination')}
                </Text>
                <AddressInput
                    value={address}
                    onChangeText={(text: string) =>
                        this.setState({ address: text.trim() })
                    }
                    onScan={() =>
                        this.props.navigation.navigate('SpliceQRScanner')
                    }
                    placeholder="bc1..."
                />
                {addressError ? (
                    <Text
                        style={{
                            ...styles.message,
                            color: themeColor('warning')
                        }}
                    >
                        {addressError}
                    </Text>
                ) : (
                    <Text
                        style={{
                            ...styles.message,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {address
                            ? localeString('views.Splice.destinationExternal')
                            : localeString('views.Splice.destinationOwnWallet')}
                    </Text>
                )}
                <View style={styles.pasteButton}>
                    <Button
                        title={localeString('general.paste')}
                        onPress={this.onPaste}
                        secondary
                    />
                </View>
            </View>
        );
    };

    private renderChannelSection = () => {
        const { ChannelsStore, UnitsStore } = this.props;
        const { channel } = this.state;

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    {localeString('views.Channel.title')}
                </Text>
                {channel ? (
                    <View style={styles.selectedChannel}>
                        <View
                            style={{
                                ...styles.channelCard,
                                backgroundColor: themeColor('secondary')
                            }}
                        >
                            <ChannelItem
                                title={channel.displayName}
                                localBalance={channel.localBalance}
                                remoteBalance={channel.remoteBalance}
                                sendingCapacity={channel.sendingCapacity}
                                receivingCapacity={channel.receivingCapacity}
                                outboundReserve={channel.localReserveBalance}
                                inboundReserve={channel.remoteReserveBalance}
                                isBelowReserve={channel.isBelowReserve}
                                selected={false}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.unselectButton}
                            onPress={() => this.setState({ channel: null })}
                            accessibilityLabel={localeString(
                                'general.unselect'
                            )}
                            accessibilityHint={localeString(
                                'general.removeSelected'
                            )}
                        >
                            <CloseIcon
                                width={15}
                                height={15}
                                fill={themeColor('text')}
                            />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <HopPicker
                        onValueChange={(channels: Channel[]) =>
                            this.setState({ channel: channels[0] || null })
                        }
                        ChannelsStore={ChannelsStore}
                        UnitsStore={UnitsStore}
                        selectionMode="single"
                        onChannelValidation={this.validateChannel}
                        hideTitle
                    />
                )}
            </View>
        );
    };

    private renderAvailable = () => {
        const { loadingSpliceInAvailable, spliceInAvailableError } =
            this.props.SpliceStore;
        const isIn = this.state.direction === 'in';
        const availableSats = this.getAvailableSats();

        if (isIn && loadingSpliceInAvailable && availableSats === null) {
            return <LoadingIndicator size={20} />;
        }

        if (isIn && spliceInAvailableError) {
            return (
                <Text
                    style={{
                        ...styles.message,
                        color: themeColor('warning')
                    }}
                >
                    {`${localeString(
                        'views.Splice.error.availableLoad'
                    )}: ${spliceInAvailableError}`}
                </Text>
            );
        }

        if (availableSats === null) return null;

        return (
            <Row>
                <Text
                    style={{
                        ...styles.message,
                        color: themeColor('secondaryText'),
                        marginRight: 5
                    }}
                >
                    {`${localeString('views.Splice.available')}:`}
                </Text>
                <Amount sats={availableSats} sensitive toggleable />
            </Row>
        );
    };

    render() {
        const { navigation } = this.props;
        const { direction, channel, amount } = this.state;
        const isOut = direction === 'out';
        const amountError = this.getAmountError();

        const canReview =
            !!channel &&
            !!amount &&
            this.getAvailableSats() !== null &&
            !amountError &&
            !this.getAddressError();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Splice.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {this.renderDirectionToggle()}

                    <Text
                        style={{
                            ...styles.message,
                            ...styles.explainer,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {isOut
                            ? localeString('views.Splice.outExplainer')
                            : localeString('views.Splice.inExplainer')}
                    </Text>

                    {this.renderChannelSection()}

                    <View style={styles.section}>
                        <AmountInput
                            amount={amount}
                            title={localeString('general.amount')}
                            onAmountChange={(
                                newAmount: string,
                                satAmount: string | number
                            ) =>
                                this.setState({
                                    amount: newAmount || '',
                                    satAmount: Number(satAmount) || 0
                                })
                            }
                            error={!!amountError}
                        />
                        {this.renderAvailable()}
                        {amountError && (
                            <Text
                                style={{
                                    ...styles.message,
                                    color: themeColor('warning')
                                }}
                            >
                                {amountError}
                            </Text>
                        )}
                    </View>

                    {isOut && this.renderDestinationSection()}
                </ScrollView>

                <View style={styles.button}>
                    <Button
                        title={localeString('views.Splice.review')}
                        onPress={this.onReview}
                        disabled={!canReview}
                    />
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 15
    },
    explainer: {
        marginBottom: 20
    },
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 20,
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 5
    },
    selectedChannel: {
        position: 'relative'
    },
    channelCard: {
        padding: 6,
        borderRadius: 10,
        marginTop: 5
    },
    unselectButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 8,
        zIndex: 1
    },
    pasteButton: {
        marginTop: 10
    },
    message: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        marginTop: 5
    },
    button: {
        paddingHorizontal: 20,
        paddingBottom: 10
    }
});
