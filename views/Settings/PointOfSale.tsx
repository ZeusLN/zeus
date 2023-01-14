import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import {
    ErrorMessage,
    WarningMessage
} from './../../components/SuccessErrorMessage';
import Switch from './../../components/Switch';
import TextInput from './../../components/TextInput';

import SettingsStore, { DEFAULT_FIAT } from './../../stores/SettingsStore';

interface PointOfSaleProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface PointOfSaleState {
    squareEnabled: boolean;
    squareAccessToken: string;
    squareLocationId: string;
}

@inject('SettingsStore')
@observer
export default class PointOfSale extends React.Component<
    PointOfSaleProps,
    PointOfSaleState
> {
    state = {
        squareEnabled: false,
        squareAccessToken: '',
        squareLocationId: ''
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            squareEnabled:
                (settings.pos && settings.pos.squareEnabled) || false,
            squareAccessToken:
                (settings.pos && settings.pos.squareAccessToken) || '',
            squareLocationId:
                (settings.pos && settings.pos.squareLocationId) || ''
        });
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation, SettingsStore } = this.props;
        const { squareEnabled, squareAccessToken, squareLocationId } =
            this.state;
        const { updateSettings, settings }: any = SettingsStore;
        const { passphrase, pin, fiat } = settings;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    navigation.navigate('Settings', {
                        refresh: true
                    })
                }
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('general.pos'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                {fiat === DEFAULT_FIAT ? (
                    <View style={{ flex: 1, padding: 15 }}>
                        <ErrorMessage
                            message={localeString(
                                'pos.views.Settings.PointOfSale.currencyError'
                            )}
                        />
                    </View>
                ) : (
                    <ScrollView style={{ flex: 1, padding: 15 }}>
                        {!pin && !passphrase && (
                            <WarningMessage
                                message={localeString(
                                    'pos.views.Settings.PointOfSale.authWarning'
                                )}
                            />
                        )}
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: themeColor('background')
                            }}
                        >
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'Lato-Regular',
                                    left: -10
                                }}
                            >
                                {localeString(
                                    'views.Settings.POS.enableSquare'
                                )}
                            </ListItem.Title>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Switch
                                    value={squareEnabled}
                                    onValueChange={async () => {
                                        this.setState({
                                            squareEnabled: !squareEnabled
                                        });
                                        await updateSettings({
                                            pos: {
                                                squareAccessToken,
                                                squareLocationId,
                                                squareEnabled: !squareEnabled
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </ListItem>

                        {squareEnabled && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.accessToken'
                                    )}
                                </Text>
                                <TextInput
                                    value={squareAccessToken}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            squareAccessToken: text
                                        });

                                        await updateSettings({
                                            pos: {
                                                squareEnabled,
                                                squareAccessToken: text,
                                                squareLocationId
                                            }
                                        });
                                    }}
                                />

                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.locationId'
                                    )}
                                </Text>
                                <TextInput
                                    value={squareLocationId}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            squareLocationId: text
                                        });

                                        await updateSettings({
                                            pos: {
                                                squareEnabled,
                                                squareAccessToken,
                                                squareLocationId: text
                                            }
                                        });
                                    }}
                                />
                            </>
                        )}
                    </ScrollView>
                )}
            </View>
        );
    }
}
