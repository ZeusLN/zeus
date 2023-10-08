import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { ListItem } from 'react-native-elements';
import moment from 'moment';

import Amount from '../../../components/Amount';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Text from '../../../components/Text';
import { Row } from '../../../components/layout/Row';

import stores from '../../../stores/Stores';

import BackendUtils from '../../../utils/BackendUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import Nostrich from '../../../assets/images/SVG/Nostrich.svg';
import Receive from '../../../assets/images/SVG/Receive.svg';

export default function LightningAddressPayment(props) {
    const { item, index, selectedIndex, navigation } = props;
    const { lightningAddressStore } = stores;
    const { status, redeem, getPreimageMap, lookupAttestations } =
        lightningAddressStore;

    const [attestationStatus, setAttestationStatus] = useState('neutral');
    const [loading, setLoading] = useState(false);
    const [attestations, setAttestations] = useState([]);

    const processAttestations = (newAttestations: any) => {
        setAttestations(newAttestations);
        if (newAttestations.length === 0) setAttestationStatus('warning');
        if (newAttestations.length === 1) {
            const attestation = newAttestations[0];
            if (attestation.isValid) {
                setAttestationStatus('success');
            } else {
                setAttestationStatus('error');
            }
        }
        if (newAttestations.length > 1) setAttestationStatus('error');
    };

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
                    <Amount sats={item.amount_msat / 1000} />
                </ListItem.Title>
                <ListItem.Subtitle>
                    <Text
                        style={{
                            color: themeColor('secondaryText')
                        }}
                    >
                        {moment(item.updated_at).format('ddd, MMM DD, hh:mm a')}
                    </Text>
                </ListItem.Subtitle>
            </ListItem.Content>
            <ListItem.Content right>
                <Row>
                    <TouchableOpacity
                        onPress={() => {
                            if (attestationStatus === 'neutral') {
                                setLoading(true);
                                lookupAttestations(item.hash, item.amount_msat)
                                    .then((attestations: Array<any>) => {
                                        processAttestations(attestations);
                                        setLoading(false);
                                    })
                                    .catch(() => {
                                        setLoading(false);
                                    });
                            } else {
                                navigation.navigate('Attestations', {
                                    attestations
                                });
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
                                fill={themeColor(
                                    attestationStatus === 'neutral'
                                        ? 'text'
                                        : attestationStatus
                                )}
                                width={32}
                                height={32}
                            />
                        )}
                    </TouchableOpacity>
                    {selectedIndex === 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                if (selectedIndex === 1) return;
                                getPreimageMap().then((map) => {
                                    const {
                                        hash,
                                        comment
                                    }: {
                                        hash: string;
                                        comment: string;
                                    } = item;
                                    const preimage = map[hash];

                                    BackendUtils.createInvoice({
                                        expiry: '3600',
                                        value: (
                                            item.amount_msat / 1000
                                        ).toString(),
                                        memo: comment
                                            ? `ZEUS PAY: ${comment}`
                                            : 'ZEUS PAY',
                                        preimage
                                    })
                                        .then((result) => {
                                            if (result.payment_request) {
                                                redeem(
                                                    hash,
                                                    result.payment_request
                                                ).then(() => status());
                                            }
                                        })
                                        .catch(() => {
                                            // if payment request has already been submitted, try to redeem without new pay req
                                            redeem(hash).then(() => status());
                                        });
                                });
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
