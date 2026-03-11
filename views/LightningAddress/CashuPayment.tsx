import React from 'react';
import { Alert, Animated, StyleSheet, TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ListItem } from '@rneui/themed';
import moment from 'moment';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Text from '../../components/Text';
import { Row } from '../../components/layout/Row';

import { cashuStore, lightningAddressStore } from '../../stores/Stores';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Receive from '../../assets/images/SVG/Receive.svg';

export default function CashuPayment(props: any) {
    const { item, index } = props;
    const { redeemCashu, deletePayment } = lightningAddressStore;

    const date = moment(item.updated_at).format('ddd, MMM DD, hh:mm a');

    const confirmDelete = () => {
        Alert.alert(
            localeString('views.Settings.LightningAddress.deletePayment'),
            localeString(
                'views.Settings.LightningAddress.deletePaymentConfirm'
            ),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('general.delete'),
                    style: 'destructive',
                    onPress: () => deletePayment(item.quote_id)
                }
            ],
            { cancelable: true }
        );
    };

    const renderRightActions = (
        _progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const trans = dragX.interpolate({
            inputRange: [-90, 0],
            outputRange: [0, 90],
            extrapolate: 'clamp'
        });

        return (
            <Animated.View
                style={[
                    styles.rightActionsContainer,
                    { transform: [{ translateX: trans }] }
                ]}
            >
                <Button
                    onPress={confirmDelete}
                    icon={{
                        name: 'delete',
                        size: 25,
                        color: themeColor('text')
                    }}
                    containerStyle={{
                        ...styles.deleteButton,
                        backgroundColor: themeColor('delete')
                    }}
                    iconOnly
                />
            </Animated.View>
        );
    };

    return (
        <Swipeable renderRightActions={renderRightActions}>
            <ListItem
                containerStyle={{
                    flex: 1,
                    borderBottomWidth: 0,
                    backgroundColor: 'transparent'
                }}
                key={index}
            >
                <ListItem.Content>
                    <ListItem.Title>
                        <Amount sats={item.amount_msat / 1000} />{' '}
                    </ListItem.Title>
                    {item.comment && (
                        <ListItem.Subtitle>
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString(
                                    'views.LnurlPay.LnurlPay.comment'
                                )}: ${item.comment}`}
                            </Text>
                        </ListItem.Subtitle>
                    )}
                    <ListItem.Subtitle>
                        <Text
                            style={{
                                color: cashuStore.cashuWallets[item.mint_url]
                                    ?.errorConnecting
                                    ? themeColor('warning')
                                    : themeColor('secondaryText')
                            }}
                        >
                            {cashuStore.mintInfos[item.mint_url]?.name ||
                                item.mint_url}
                        </Text>
                    </ListItem.Subtitle>
                    <ListItem.Subtitle>
                        <Text
                            style={{
                                color: themeColor('secondaryText')
                            }}
                        >
                            {date}
                        </Text>
                    </ListItem.Subtitle>
                </ListItem.Content>
                <ListItem.Content right>
                    <Row>
                        <TouchableOpacity
                            onPress={() => {
                                const {
                                    quote_id,
                                    mint_url,
                                    amount_msat
                                }: {
                                    quote_id: string;
                                    mint_url: string;
                                    amount_msat: number;
                                } = item;

                                redeemCashu(quote_id, mint_url, amount_msat);
                            }}
                        >
                            <Receive
                                fill={themeColor('text')}
                                width={45}
                                height={45}
                            />
                        </TouchableOpacity>
                    </Row>
                </ListItem.Content>
            </ListItem>
        </Swipeable>
    );
}

const styles = StyleSheet.create({
    rightActionsContainer: {
        width: 90,
        flexDirection: 'row'
    },
    deleteButton: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    }
});
