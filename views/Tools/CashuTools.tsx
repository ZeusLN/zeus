import * as React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import cloneDeep from 'lodash/cloneDeep';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';

import CashuStore from '../../stores/CashuStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface CashuToolsProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
}

@inject('CashuStore')
@observer
export default class CashuTools extends React.Component<CashuToolsProps, {}> {
    render() {
        const { navigation, CashuStore } = this.props;
        const { setMintCounter } = CashuStore;
        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Tools.cashu'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        {/* <>
                            <ListItem
                                containerStyle={{
                                    backgroundColor: 'transparent'
                                }}
                                onPress={() =>
                                    navigation.navigate('Seed')
                                }
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.Seed.title'
                                        )}
                                    </ListItem.Title>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        BIP-39
                                    </ListItem.Title>
                                </ListItem.Content>
                                <Icon
                                    name="keyboard-arrow-right"
                                    color={themeColor('secondaryText')}
                                />
                            </ListItem>
                        </> */}

                        <>
                            <View style={{ marginTop: 25 }}>
                                <Button
                                    title={localeString(
                                        'views.Tools.cashu.bumpWalletCounters'
                                    )}
                                    onPress={async () => {
                                        let message = '';

                                        // Wait for all async operations to complete
                                        await Promise.all(
                                            Object.keys(
                                                CashuStore.cashuWallets
                                            ).map(async (key: string) => {
                                                const wallet =
                                                    CashuStore.cashuWallets[
                                                        key
                                                    ];

                                                const oldCount = cloneDeep(
                                                    wallet.counter
                                                );
                                                const newCount = oldCount + 10;

                                                await setMintCounter(
                                                    key,
                                                    newCount
                                                );

                                                message += `\n${wallet.mintInfo.name}
${oldCount} -> ${newCount}
`;
                                            })
                                        );

                                        // Show the alert after all messages are populated
                                        Alert.alert(
                                            'Wallet counters incremented!',
                                            message,
                                            [
                                                {
                                                    text: localeString(
                                                        'general.ok'
                                                    ),
                                                    onPress: () => void 0
                                                }
                                            ],
                                            { cancelable: false }
                                        );
                                    }}
                                />
                            </View>
                            <View
                                style={{
                                    margin: 10,
                                    marginTop: 15
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Tools.cashu.bumpWalletCounters.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
