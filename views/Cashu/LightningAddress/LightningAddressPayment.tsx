import React from 'react';
import { TouchableOpacity } from 'react-native';
import { ListItem } from 'react-native-elements';
import moment from 'moment';

import Amount from '../../../components/Amount';
import Text from '../../../components/Text';
import { Row } from '../../../components/layout/Row';

import stores from '../../../stores/Stores';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import Receive from '../../../assets/images/SVG/Receive.svg';

export default function LightningAddressPayment(props: any) {
    const { item, index } = props;
    const { cashuLightningAddressStore } = stores;
    const { redeem } = cashuLightningAddressStore;

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

                            redeem(quote_id, mint_url, amount_msat);
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
