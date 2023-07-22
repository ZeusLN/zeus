import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import EncryptedStorage from 'react-native-encrypted-storage';

import { ErrorMessage } from '../../components/SuccessErrorMessage';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Header from '../../components/Header';

import SettingsStore from '../../stores/SettingsStore';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

interface SeedProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface SeedState {
    understood: boolean;
}

const MnemonicWord = ({ index, word }) => {
    const [isRevealed, setRevealed] = useState(false);
    return (
        <TouchableOpacity
            key={index}
            onPress={() => setRevealed(!isRevealed)}
            style={{
                padding: 8,
                backgroundColor: themeColor('secondary'),
                width: '45%',
                borderRadius: 5,
                margin: 9,
                flexDirection: 'row'
            }}
        >
            <Text
                style={{
                    flex: 1,
                    fontFamily: 'Lato-Regular',
                    color: themeColor('secondaryText'),
                    fontSize: 18,
                    alignSelf: 'flex-start'
                }}
            >
                {index + 1}
            </Text>
            <Text
                style={{
                    flex: 1,
                    fontFamily: 'Lato-Bold',
                    color: themeColor('text'),
                    fontSize: 18,
                    alignSelf: 'flex-end',
                    margin: 0,
                    padding: 0
                }}
            >
                {isRevealed ? word : '*******'}
            </Text>
        </TouchableOpacity>
    );
};

@inject('SettingsStore')
@observer
export default class Seed extends React.PureComponent<SeedProps, SeedState> {
    state = {
        understood: false
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { understood } = this.state;
        const { seedPhrase }: any = SettingsStore;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Seed.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                {!understood && (
                    <>
                        <View style={{ marginLeft: 10, marginRight: 10 }}>
                            <ErrorMessage
                                message={localeString(
                                    'general.warning'
                                ).toUpperCase()}
                            />
                        </View>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular',
                                textAlign: 'center',
                                margin: 10,
                                fontSize: 20
                            }}
                        >
                            {localeString('views.Settings.Seed.text1')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular',
                                textAlign: 'center',
                                margin: 10,
                                fontSize: 20
                            }}
                        >
                            {localeString('views.Settings.Seed.text2')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular',
                                textAlign: 'center',
                                margin: 10,
                                fontSize: 20
                            }}
                        >
                            {localeString('views.Settings.Seed.text3')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular',
                                textAlign: 'center',
                                margin: 10,
                                fontSize: 20
                            }}
                        >
                            {localeString('views.Settings.Seed.text4')}
                        </Text>
                        <View
                            style={{
                                alignSelf: 'center',
                                position: 'absolute',
                                bottom: 35,
                                width: '90%'
                            }}
                        >
                            <Button
                                onPress={() =>
                                    this.setState({ understood: true })
                                }
                                title={localeString('general.iUnderstand')}
                            />
                        </View>
                    </>
                )}
                {understood && (
                    <>
                        <ScrollView style={{ flex: 1 }}>
                            <View
                                style={{
                                    flex: 1,
                                    marginTop: 8,
                                    maxHeight: 720,
                                    flexWrap: 'wrap',
                                    alignContent: 'flex-start'
                                }}
                            >
                                {seedPhrase.map(
                                    (word: string, index: number) => {
                                        return (
                                            <MnemonicWord
                                                index={index}
                                                word={word}
                                                key={`mnemonic-${index}`}
                                            />
                                        );
                                    }
                                )}
                            </View>
                        </ScrollView>
                        <Button
                            onPress={async () => {
                                await EncryptedStorage.setItem(
                                    'backup-complete',
                                    JSON.stringify(true)
                                );
                                navigation.navigate('Wallet');
                            }}
                            title={localeString(
                                'views.Settings.Seed.backupComplete'
                            )}
                        />
                    </>
                )}
            </Screen>
        );
    }
}
