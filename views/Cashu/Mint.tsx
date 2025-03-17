import * as React from 'react';
import { observer, inject } from 'mobx-react';
import {
    Image,
    Linking,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    View
} from 'react-native';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearProgress } from 'react-native-elements';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import Pill from '../../components/Pill';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';

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

interface MintState {
    checkForExistingBalances: boolean;
}

const supportedContacts = ['email', 'nostr', 'twitter', 'x'];

@inject('CashuStore')
@observer
export default class Mint extends React.Component<MintProps, MintState> {
    state = {
        checkForExistingBalances: false
    };

    render() {
        const { navigation, route, CashuStore } = this.props;
        const { checkForExistingBalances } = this.state;
        const {
            addMint,
            removeMint,
            restorationProgress,
            restorationKeyset,
            loading
        } = CashuStore;
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
                {restorationProgress !== undefined && (
                    <View
                        style={{
                            backgroundColor: themeColor('highlight'),
                            borderRadius: 10,
                            margin: 20,
                            marginBottom: 0,
                            padding: 15,
                            borderWidth: 0.5
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Medium',
                                color: themeColor('background')
                            }}
                        >
                            {`${localeString(
                                'views.Wallet.BalancePane.recovery.title'
                            )}${
                                !restorationProgress
                                    ? ` - ${localeString(
                                          'views.Wallet.BalancePane.recovery.textAlt'
                                      )}`
                                    : ''
                            }`}
                        </Text>
                        {restorationProgress !== undefined && (
                            <>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('background'),
                                        marginTop: 20
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.Mint.restoration'
                                    )}
                                </Text>
                                {restorationKeyset && (
                                    <Text
                                        style={{
                                            fontFamily: 'PPNeueMontreal-Book',
                                            color: themeColor('background')
                                        }}
                                    >
                                        {`${localeString(
                                            'views.Cashu.Mint.restorationKeyset'
                                        )}: ${restorationKeyset}`}
                                    </Text>
                                )}
                            </>
                        )}
                        {restorationProgress !== undefined && (
                            <View
                                style={{
                                    marginTop: 30,
                                    flex: 1,
                                    flexDirection: 'row',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    minWidth: '100%'
                                }}
                            >
                                <LinearProgress
                                    value={
                                        Math.floor(restorationProgress) / 100
                                    }
                                    variant="determinate"
                                    color={themeColor('background')}
                                    trackColor={themeColor(
                                        'secondaryBackground'
                                    )}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row'
                                    }}
                                />
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Medium',
                                        color: themeColor('background'),
                                        marginTop: -8,
                                        marginLeft: 14,
                                        height: 40
                                    }}
                                >
                                    {`${Math.floor(
                                        restorationProgress
                                    ).toString()}%`}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
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

                            if (!contact.info) return;
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
                {mint?.mintUrl && !loading && (
                    <>
                        {lookup ? (
                            <View
                                style={{
                                    ...styles.bottom,
                                    backgroundColor: themeColor('background')
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        margin: 20,
                                        marginTop: 20
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Cashu.Mint.checkForExistingBalances'
                                            )}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            alignSelf: 'center',
                                            marginLeft: 5
                                        }}
                                    >
                                        <Switch
                                            value={checkForExistingBalances}
                                            onValueChange={() =>
                                                this.setState({
                                                    checkForExistingBalances:
                                                        !checkForExistingBalances
                                                })
                                            }
                                            disabled={loading}
                                        />
                                    </View>
                                </View>
                                <View style={{ width: '100%' }}>
                                    <Button
                                        title={localeString(
                                            'views.Cashu.AddMint.title'
                                        ).toUpperCase()}
                                        tertiary
                                        noUppercase
                                        onPress={async () => {
                                            await addMint(
                                                mint?.mintUrl,
                                                checkForExistingBalances
                                            );
                                            navigation.popTo('Mints');
                                        }}
                                        buttonStyle={{ height: 40 }}
                                        disabled={loading}
                                    />
                                </View>
                            </View>
                        ) : (
                            <View
                                style={{
                                    ...styles.bottom,
                                    backgroundColor: themeColor('background')
                                }}
                            >
                                <View style={{ width: '100%' }}>
                                    <Button
                                        title={localeString(
                                            'views.Cashu.Mint.removeMint'
                                        ).toUpperCase()}
                                        warning
                                        noUppercase
                                        onPress={async () => {
                                            await removeMint(mint?.mintUrl);
                                            navigation.goBack();
                                        }}
                                        buttonStyle={{ height: 40 }}
                                        disabled={loading}
                                    />
                                </View>
                            </View>
                        )}
                    </>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20,
        overflow: 'hidden'
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    },
    valueWithLink: {
        paddingBottom: 5,
        fontFamily: 'PPNeueMontreal-Book'
    },
    bottom: {
        flex: 1,
        flexDirection: 'column',
        position: 'absolute',
        bottom: 0,
        paddingBottom: 10,
        width: '100%'
    }
});
