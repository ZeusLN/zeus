import React from 'react';
import { TouchableOpacity } from 'react-native';
import { ListItem } from 'react-native-elements';
import moment from 'moment';

import Amount from '../../../components/Amount';
import AttestationButton from '../../../components/AttestationButton';
import Text from '../../../components/Text';
import { Row } from '../../../components/layout/Row';

import stores from '../../../stores/Stores';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import Channel from '../../../assets/images/SVG/Channel.svg';
import Receive from '../../../assets/images/SVG/Receive.svg';

export default function LightningAddressPayment(props) {
    const { item, index, navigation, isReady } = props;
    const { lightningAddressStore } = stores;
    const { lookupPreimageAndRedeem } = lightningAddressStore;

    const date = moment(item.updated_at).format('ddd, MMM DD, hh:mm a');

    return (
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
                    {item.opened_channel_fee_msat && (
                        <Amount
                            sats={item.opened_channel_fee_msat / 1000}
                            debit
                            negative={true}
                        />
                    )}
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
                            color: themeColor('secondaryText')
                        }}
                    >
                        {item.fee
                            ? `${localeString('models.Payment.fee')}: ${
                                  item.fee
                              } ${localeString('general.sats')} | ${date}`
                            : date}
                    </Text>
                </ListItem.Subtitle>
            </ListItem.Content>
            <ListItem.Content right>
                <Row>
                    {item.opened_channel && (
                        <Channel
                            fill={themeColor('text')}
                            width={42}
                            height={42}
                            style={{ marginRight: 10 }}
                        />
                    )}
                    <AttestationButton
                        hash={item.hash}
                        amount_msat={item.amount_msat}
                        navigation={navigation}
                    />
                    <TouchableOpacity
                        onPress={() => {
                            if (!isReady) return;

                            const {
                                hash,
                                amount_msat,
                                comment
                            }: {
                                hash: string;
                                amount_msat: number;
                                comment: string;
                            } = item;

                            lookupPreimageAndRedeem(hash, amount_msat, comment);
                        }}
                    >
                        <Receive
                            fill={
                                isReady
                                    ? themeColor('text')
                                    : themeColor('secondaryText')
                            }
                            width={45}
                            height={45}
                        />
                    </TouchableOpacity>
                </Row>
            </ListItem.Content>
        </ListItem>
    );
}
