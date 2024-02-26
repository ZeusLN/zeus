import * as React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import TextInput from '../../../components/TextInput';

import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';

import SettingsStore from '../../../stores/SettingsStore';

import { restoreChannelBackups } from '../../../lndmobile/channel';

interface RestoreChannelBackupsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface RestoreChannelBackupsState {
    channelBackupsBase64: string;
    error: string;
}

@inject('SettingsStore')
@observer
export default class RestoreChannelBackups extends React.Component<
    RestoreChannelBackupsProps,
    RestoreChannelBackupsState
> {
    state = {
        channelBackupsBase64: '',
        error: ''
    };

    render() {
        const { navigation } = this.props;
        const { channelBackupsBase64, error } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.EmbeddedNode.restoreChannelBackups'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {error && <ErrorMessage message={error} dismissable />}

                    <View>
                        <View style={styles.form}>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.AddEditNode.disasterRecoveryBase64'
                                )}
                            </Text>
                            <TextInput
                                value={channelBackupsBase64}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        channelBackupsBase64: text
                                    })
                                }
                                multiline
                                placeholder="XxmvSDaQNk3mRvKYFyX4yGceQpOwXF1rS..."
                                style={styles.textInput}
                            />
                            <Button
                                title={localeString(
                                    'views.Settings.EmbeddedNode.restoreChannelBackups.restore'
                                )}
                                onPress={async () => {
                                    try {
                                        await restoreChannelBackups(
                                            channelBackupsBase64
                                        );
                                        navigation.navigate('Wallet');
                                    } catch (e) {
                                        console.log('e', e);
                                        this.setState({
                                            error: e.toString()
                                        });
                                    }
                                }}
                                buttonStyle={{
                                    marginTop: 20
                                }}
                                disabled={!channelBackupsBase64}
                            />
                        </View>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        padding: 10
    },
    button: {
        padding: 10
    },
    form: {
        paddingLeft: 5,
        paddingRight: 5
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    textInput: {
        fontSize: 20,
        width: '100%',
        top: 10,
        backgroundColor: '#31363F',
        borderRadius: 6,
        marginBottom: 20,
        padding: 10
    }
});
