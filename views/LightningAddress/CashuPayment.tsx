import React from 'react';
import { TouchableOpacity } from 'react-native';
import { ListItem } from 'react-native-elements';
import moment from 'moment';

import Amount from '../../components/Amount';
import Text from '../../components/Text';
import { Row } from '../../components/layout/Row';

import stores from '../../stores/Stores';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Receive from '../../assets/images/SVG/Receive.svg';

export default function CashuPayment(props: any) {
    const { item, index } = props;
    const { cashuStore, lightningAddressStore } = stores;
    const { redeemCashu } = lightningAddressStore;

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
                        {cashuStore.cashuWallets[item.mint_url]?.mintInfo
                            ?.name || item.mint_url}
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
    );
}
