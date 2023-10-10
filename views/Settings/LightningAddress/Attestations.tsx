import * as React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';

import Amount from '../../../components/Amount';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';
import { Spacer } from '../../../components/layout/Spacer';

import DateTimeUtils from '../../../utils/DateTimeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface AttestationProps {
    navigation: any;
}

export default function Attestation(props: AttestationProps) {
    const { navigation } = props;
    const attestations = navigation.getParam('attestations', null);
    return (
        <Screen>
            <View style={{ flex: 1 }}>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Attestations.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ margin: 5 }}>
                    {attestations.length === 0 ? (
                        <Text
                            style={{
                                textAlign: 'center',
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString(
                                'views.Settings.Attestations.noAttestationsFound'
                            )}
                        </Text>
                    ) : (
                        <FlatList
                            data={attestations}
                            renderItem={({
                                item,
                                index
                            }: {
                                item: any;
                                index: number;
                            }) => {
                                return (
                                    <TouchableOpacity
                                        style={{
                                            flex: 1,
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                themeColor('background'),
                                            margin: 10
                                        }}
                                        key={index}
                                        onPress={() =>
                                            navigation.navigate('Attestation', {
                                                attestation: item
                                            })
                                        }
                                    >
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    item.isValid
                                                        ? 'success'
                                                        : 'error'
                                                )
                                            }}
                                        >
                                            {item.isValid
                                                ? localeString(
                                                      'views.Settings.Attestations.validAttestation'
                                                  )
                                                : localeString(
                                                      'views.Settings.Attestations.invalidAttestation'
                                                  )}
                                        </Text>

                                        {item.created_at && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'general.createdAt'
                                                )}
                                                value={DateTimeUtils.listFormattedDate(
                                                    item.created_at
                                                )}
                                                disableCopy
                                            />
                                        )}

                                        {!item.isValidLightningInvoice && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'general.lightningInvoice'
                                                )}
                                                value={localeString(
                                                    'general.invalid'
                                                )}
                                                disableCopy
                                            />
                                        )}

                                        {item.isHashValid && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'general.hash'
                                                )}
                                                value={
                                                    item.isHashValid
                                                        ? localeString(
                                                              'general.valid'
                                                          )
                                                        : localeString(
                                                              'general.invalid'
                                                          )
                                                }
                                                disableCopy
                                            />
                                        )}

                                        {item.millisatoshis && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Receive.amount'
                                                )}
                                                value={
                                                    <Amount
                                                        sats={
                                                            item.millisatoshis /
                                                            1000
                                                        }
                                                        credit={
                                                            item.isAmountValid
                                                        }
                                                        debit={
                                                            !item.isAmountValid
                                                        }
                                                    />
                                                }
                                                disableCopy
                                            />
                                        )}

                                        {item.feeMsat && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'models.Payment.fee'
                                                )}
                                                value={
                                                    <Amount
                                                        sats={
                                                            item.feeMsat / 1000
                                                        }
                                                        credit={
                                                            item.isAmountValid
                                                        }
                                                        debit={
                                                            !item.isAmountValid
                                                        }
                                                    />
                                                }
                                                disableCopy
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                            ListFooterComponent={<Spacer height={100} />}
                            keyExtractor={(_, index) => `${index}`}
                        />
                    )}
                </View>
            </View>
        </Screen>
    );
}
