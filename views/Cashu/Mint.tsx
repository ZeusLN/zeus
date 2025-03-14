import * as React from 'react';
import { observer, inject } from 'mobx-react';
import {
    Image,
    Linking,
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import Pill from '../../components/Pill';
import Screen from '../../components/Screen';
import { Row } from '../../components/layout/Row';

import { localeString } from '../../utils/LocaleUtils';
import PrivacyUtils from '../../utils/PrivacyUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import CashuStore from '../../stores/CashuStore';

interface MintProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'Mint', { mint: any; lookup?: boolean }>;
    CashuStore: CashuStore;
}

const supportedContacts = ['email', 'nostr', 'twitter', 'x'];

@inject('CashuStore')
@observer
export default class Mint extends React.Component<MintProps> {
    render() {
        const { navigation, route, CashuStore } = this.props;
        const { addMint, loading } = CashuStore;
        const mint = route.params?.mint;
        const lookup = route.params?.lookup;

        const mintInfo = mint._mintInfo || mint;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('cashu.mint'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? (
                            <Row>
                                <LoadingIndicator size={30} />
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.center}>
                        {mintInfo?.icon_url && (
                            <Image
                                source={{ uri: mintInfo?.icon_url }}
                                style={{
                                    width: 100,
                                    height: 100,
                                    borderRadius: 75,
                                    marginBottom: 20
                                }}
                            />
                        )}
                        {mintInfo?.name && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 30,
                                    fontWeight: 'bold',
                                    marginBottom: 10,
                                    color: 'white'
                                }}
                            >
                                {mintInfo?.name}
                            </Text>
                        )}
                    </View>

                    {mint?.mintBalance !== undefined && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Settings.Display.DefaultView.balance'
                            )}
                            value={
                                <Amount
                                    sats={mint.mintBalance}
                                    toggleable
                                    sensitive
                                />
                            }
                        />
                    )}

                    {mint?.mintUrl && (
                        <KeyValue
                            keyValue={localeString('cashu.mintUrl')}
                            value={mint?.mintUrl}
                        />
                    )}

                    {mintInfo?.description && (
                        <KeyValue
                            keyValue={localeString(
                                'views.PaymentRequest.description'
                            )}
                            value={mintInfo?.description}
                        />
                    )}

                    {mintInfo?.description_long && (
                        <KeyValue
                            keyValue={localeString(
                                'views.PaymentRequest.description'
                            )}
                            value={mintInfo?.description_long}
                        />
                    )}

                    {mintInfo?.version && (
                        <KeyValue
                            keyValue={localeString('general.version')}
                            value={mintInfo?.version}
                        />
                    )}

                    {mintInfo?.pubkey && (
                        <KeyValue
                            keyValue={localeString('views.NodeInfo.pubkey')}
                            value={mintInfo?.pubkey}
                        />
                    )}

                    {mintInfo?.nuts && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Cashu.Mint.supportedNuts'
                            )}
                            value={
                                <>
                                    {Object.keys(mintInfo?.nuts).map(
                                        (title) => (
                                            <View style={{ margin: 3 }}>
                                                <Pill
                                                    title={title}
                                                    borderColor={themeColor(
                                                        'text'
                                                    )}
                                                    textColor={themeColor(
                                                        'text'
                                                    )}
                                                    borderWidth={1}
                                                    width={25}
                                                    height={25}
                                                />
                                            </View>
                                        )
                                    )}
                                </>
                            }
                        />
                    )}

                    {mintInfo?.contact &&
                        mintInfo?.contact.map((contact: any) => {
                            const { info, method } = contact;
                            const methodCapitalized =
                                String(method).charAt(0).toUpperCase() +
                                String(method).slice(1);
                            const methodLower = method.toLowerCase();
                            const supported =
                                supportedContacts.includes(methodLower);
                            return (
                                <KeyValue
                                    keyValue={methodCapitalized}
                                    value={
                                        <TouchableOpacity
                                            key={`contact-${contact.method}`}
                                            onPress={() => {
                                                if (!supported) return;

                                                if (methodLower === 'email') {
                                                    const url = `mailto:${contact.info}`;
                                                    Linking.canOpenURL(
                                                        url
                                                    ).then(
                                                        (
                                                            supported: boolean
                                                        ) => {
                                                            if (supported) {
                                                                Linking.openURL(
                                                                    url
                                                                );
                                                            }
                                                        }
                                                    );
                                                }

                                                if (
                                                    methodLower === 'x' ||
                                                    methodLower === 'twitter'
                                                ) {
                                                    UrlUtils.goToUrl(
                                                        `https://x.com/${info}`
                                                    );
                                                }

                                                if (methodLower === 'nostr') {
                                                    UrlUtils.goToUrl(
                                                        `https://njump.me/${info}`
                                                    );
                                                }
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    ...styles.valueWithLink,
                                                    color: supported
                                                        ? themeColor(
                                                              'highlight'
                                                          )
                                                        : themeColor('text')
                                                }}
                                            >
                                                {`${
                                                    typeof info === 'string' &&
                                                    PrivacyUtils.sensitiveValue(
                                                        info
                                                    )
                                                }`}
                                            </Text>
                                        </TouchableOpacity>
                                    }
                                />
                            );
                        })}
                </ScrollView>
                {mint?.mintUrl && lookup && (
                    <View
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            position: 'absolute',
                            bottom: 10
                        }}
                    >
                        <View style={{ width: '100%' }}>
                            <Button
                                title={localeString(
                                    'views.Cashu.AddMint.title'
                                ).toUpperCase()}
                                tertiary
                                noUppercase
                                onPress={async () => {
                                    await addMint(mint?.mintUrl);
                                    navigation.popTo('Mints');
                                }}
                                buttonStyle={{ height: 40 }}
                                disabled={loading}
                            />
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    },
    valueWithLink: {
        paddingBottom: 5,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
