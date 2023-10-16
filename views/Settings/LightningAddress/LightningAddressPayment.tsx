import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { ListItem } from 'react-native-elements';
import moment from 'moment';

import Amount from '../../../components/Amount';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Text from '../../../components/Text';
import { Row } from '../../../components/layout/Row';

import stores from '../../../stores/Stores';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import Channel from '../../../assets/images/SVG/Channel.svg';
import Nostrich from '../../../assets/images/SVG/Nostrich.svg';
import Receive from '../../../assets/images/SVG/Receive.svg';

export default function LightningAddressPayment(props) {
    const { item, index, selectedIndex, navigation } = props;
    const { lightningAddressStore } = stores;
    const { lookupPreimageAndRedeem, lookupAttestations } =
        lightningAddressStore;

    const [attestationStatus, setAttestationStatus] = useState('neutral');
    const [loading, setLoading] = useState(false);
    const [attestations, setAttestations] = useState([]);

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
                    <TouchableOpacity
                        onPress={() => {
                            if (attestationStatus === 'neutral') {
                                setLoading(true);
                                lookupAttestations(item.hash, item.amount_msat)
                                    .then(
                                        ({
                                            attestations,
                                            status
                                        }: {
                                            attestations: any;
                                            status: string;
                                        }) => {
                                            setAttestations(attestations);
                                            setAttestationStatus(status);
                                            setLoading(false);
                                        }
                                    )
                                    .catch(() => {
                                        setLoading(false);
                                    });
                            } else {
                                if (attestationStatus === 'success') {
                                    navigation.navigate('Attestation', {
                                        attestation: attestations[0]
                                    });
                                } else {
                                    navigation.navigate('Attestations', {
                                        attestations
                                    });
                                }
                            }
                        }}
                        style={{
                            marginRight: 10,
                            width: 45,
                            height: 45,
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {loading ? (
                            <LoadingIndicator />
                        ) : (
                            <Nostrich
                                fill={
                                    attestationStatus === 'warning'
                                        ? '#FFC300'
                                        : attestationStatus === 'neutral'
                                        ? themeColor('text')
                                        : themeColor(attestationStatus)
                                }
                                width={32}
                                height={32}
                            />
                        )}
                    </TouchableOpacity>
                    {selectedIndex === 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                if (selectedIndex === 1) return;

                                const {
                                    hash,
                                    amount_msat,
                                    comment
                                }: {
                                    hash: string;
                                    amount_msat: number;
                                    comment: string;
                                } = item;

                                lookupPreimageAndRedeem(
                                    hash,
                                    amount_msat,
                                    comment
                                );
                            }}
                        >
                            <Receive
                                fill={themeColor('text')}
                                width={45}
                                height={45}
                            />
                        </TouchableOpacity>
                    )}
                </Row>
            </ListItem.Content>
        </ListItem>
    );
}
