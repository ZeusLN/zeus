import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Amount from '../../../components/Amount';
import Button from '../../../components/Button';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';
import Screen from '../../../components/Screen';
import SwipeButton from '../../../components/SwipeButton';
import Text from '../../../components/Text';

import { localeString } from '../../../utils/LocaleUtils';
import { SpliceDirection } from '../../../utils/SpliceUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import SettingsStore, {
    DEFAULT_SLIDE_TO_PAY_THRESHOLD
} from '../../../stores/SettingsStore';
import SpliceStore from '../../../stores/SpliceStore';

export interface SpliceReviewParams {
    direction: SpliceDirection;
    fundingTxid: string;
    channelName: string;
    capacitySats: number;
    amountSats: number;
    // Splice-out destination; our own wallet if unset
    address?: string;
}

interface SpliceReviewProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'SpliceReview', SpliceReviewParams>;
    SettingsStore: SettingsStore;
    SpliceStore: SpliceStore;
}

@inject('SettingsStore', 'SpliceStore')
@observer
export default class SpliceReview extends React.Component<
    SpliceReviewProps,
    {}
> {
    onConfirm = () => {
        const { navigation, route, SpliceStore } = this.props;
        const { direction, fundingTxid, amountSats, address } = route.params;

        // A double tap must not request a second splice on the same channel
        if (SpliceStore.splicing) return;

        SpliceStore.splice({ direction, fundingTxid, amountSats, address });
        navigation.navigate('Splicing', { direction });
    };

    render() {
        const { navigation, route, SettingsStore } = this.props;
        const { direction, channelName, capacitySats, amountSats, address } =
            route.params;
        const isOut = direction === 'out';

        const newCapacitySats = isOut
            ? capacitySats - amountSats
            : capacitySats + amountSats;

        const slideToPayThreshold =
            SettingsStore.settings?.payments?.slideToPayThreshold ??
            DEFAULT_SLIDE_TO_PAY_THRESHOLD;

        const confirmTitle = isOut
            ? localeString('views.Splice.confirmOut')
            : localeString('views.Splice.confirmIn');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Splice.review'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <View style={styles.center}>
                    <Amount sats={amountSats} sensitive jumboText toggleable />
                    <Text
                        style={{
                            ...styles.summary,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {isOut
                            ? localeString('views.Splice.outOfChannel')
                            : localeString('views.Splice.intoChannel')}
                    </Text>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <KeyValue
                        keyValue={localeString('views.Channel.title')}
                        value={channelName}
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.capacity')}
                        value={
                            <Amount sats={capacitySats} sensitive toggleable />
                        }
                    />
                    <KeyValue
                        keyValue={localeString('views.Splice.newCapacity')}
                        value={
                            <Amount
                                sats={newCapacitySats}
                                sensitive
                                toggleable
                            />
                        }
                    />
                    {isOut && (
                        <KeyValue
                            keyValue={localeString('general.destination')}
                            value={
                                address ||
                                localeString('views.Splice.yourWallet')
                            }
                            showCopyIcon={!!address}
                        />
                    )}
                    <KeyValue
                        keyValue={localeString('views.Payment.fee')}
                        value={localeString('views.Splice.feeDecidedByNode')}
                    />
                    <Text
                        style={{
                            ...styles.note,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {isOut
                            ? localeString('views.Splice.feeNoteOut')
                            : localeString('views.Splice.feeNoteIn')}
                    </Text>
                </ScrollView>

                <View style={{ bottom: 10 }}>
                    {amountSats >= slideToPayThreshold ? (
                        <SwipeButton
                            onSwipeSuccess={this.onConfirm}
                            instructionText={localeString(
                                'views.Splice.slideToSplice'
                            )}
                            containerStyle={{
                                backgroundColor: themeColor('secondaryText')
                            }}
                            swipeButtonStyle={{
                                backgroundColor: themeColor('text')
                            }}
                        />
                    ) : (
                        <View style={styles.button}>
                            <Button
                                title={confirmTitle}
                                onPress={this.onConfirm}
                            />
                        </View>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    center: {
        alignItems: 'center',
        paddingVertical: 15
    },
    summary: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 5
    },
    content: {
        paddingHorizontal: 15
    },
    note: {
        fontSize: 14,
        marginTop: 15
    },
    button: {
        paddingHorizontal: 20
    }
});
