import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { nip19 } from 'nostr-tools';

import Amount from '../../../components/Amount';
import Button from '../../../components/Button';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';

import DateTimeUtils from '../../../utils/DateTimeUtils';
import LinkingUtils from '../../../utils/LinkingUtils';
import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface AttestationProps {
    navigation: any;
}

export default function Attestation(props: AttestationProps) {
    const { navigation } = props;
    const item = navigation.getParam('attestation', null);

    const handleNostr = (value: string) => {
        const deepLink = `nostr:${value}`;
        LinkingUtils.handleDeepLink(deepLink, navigation);
    };

    return (
        <Screen>
            <View style={{ flex: 1 }}>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Attestation.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ flex: 1, margin: 5 }}>
                    <ScrollView
                        style={{
                            borderBottomWidth: 0,
                            backgroundColor: themeColor('background'),
                            margin: 10
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor(
                                    item.isValid ? 'success' : 'error'
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

                        {!item.isValidLightningInvoice && (
                            <KeyValue
                                keyValue={localeString(
                                    'general.lightningInvoice'
                                )}
                                value={localeString('general.invalid')}
                            />
                        )}

                        {item.isHashValid && (
                            <KeyValue
                                keyValue={localeString('general.hash')}
                                value={
                                    item.isHashValid
                                        ? localeString('general.valid')
                                        : localeString('general.invalid')
                                }
                            />
                        )}

                        {item.millisatoshis && (
                            <KeyValue
                                keyValue={localeString('views.Receive.amount')}
                                value={
                                    <Amount
                                        sats={item.millisatoshis / 1000}
                                        credit={item.isAmountValid}
                                        debit={!item.isAmountValid}
                                    />
                                }
                            />
                        )}

                        {item.feeMsat && (
                            <KeyValue
                                keyValue={localeString('models.Payment.fee')}
                                value={
                                    <Amount
                                        sats={item.feeMsat / 1000}
                                        credit={item.isAmountValid}
                                        debit={!item.isAmountValid}
                                    />
                                }
                            />
                        )}

                        {item.id && (
                            <KeyValue
                                keyValue={localeString('general.id')}
                                value={item.id}
                            />
                        )}

                        {item.kind && (
                            <KeyValue
                                keyValue={localeString('general.kind')}
                                value={item.kind}
                            />
                        )}

                        {item.content && (
                            <KeyValue
                                keyValue={localeString('general.content')}
                                value={item.content}
                            />
                        )}

                        {item.created_at && (
                            <KeyValue
                                keyValue={localeString('general.createdAt')}
                                value={DateTimeUtils.listFormattedDate(
                                    item.created_at
                                )}
                            />
                        )}

                        {item.pubkey && (
                            <KeyValue
                                keyValue={localeString('nostr.pubkey')}
                                value={item.pubkey}
                            />
                        )}

                        <KeyValue
                            keyValue={localeString('nostr.npub')}
                            value={nip19.npubEncode(item.pubkey)}
                        />
                    </ScrollView>
                    <View style={{ bottom: 15 }}>
                        <View style={{ margin: 10 }}>
                            <Button
                                title={localeString(
                                    'nostr.loadProfileExternal'
                                )}
                                onPress={() =>
                                    handleNostr(nip19.npubEncode(item.pubkey))
                                }
                            />
                        </View>
                        <View style={{ margin: 10 }}>
                            <Button
                                title={localeString('nostr.loadEventExternal')}
                                onPress={() => handleNostr(item.id)}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Screen>
    );
}
