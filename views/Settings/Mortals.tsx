import * as React from 'react';
import { Dimensions, FlatList, Text } from 'react-native';
import { Avatar, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import SettingsStore from '../../stores/SettingsStore';

interface MortalsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class Mortals extends React.Component<MortalsProps, {}> {
    UNSAFE_componentWillMount() {
        this.props.SettingsStore.fetchSponsors();
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { sponsorsError, mortals, loading } = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Mortals.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {loading && <LoadingIndicator />}
                {!loading && !sponsorsError && (
                    <>
                        <FlatList
                            data={mortals.slice().reverse()}
                            renderItem={({ item }) => (
                                <ListItem
                                    containerStyle={{
                                        backgroundColor: 'transparent',
                                        padding: 0
                                    }}
                                    onPress={() =>
                                        UrlUtils.goToUrl(
                                            `https://${
                                                item.type === 'Twitter'
                                                    ? 'twitter.com/'
                                                    : 'iris.to/'
                                            }${item.handle}`
                                        )
                                    }
                                >
                                    <Avatar
                                        size={
                                            Dimensions.get('window').width / 5 -
                                            10
                                        }
                                        rounded
                                        source={{
                                            uri: `https://zeusln.com/api/${
                                                item.type === 'Twitter'
                                                    ? 'twitter-images/'
                                                    : 'nostr-images/'
                                            }${item.handle}.jpg`
                                        }}
                                        key={1}
                                        containerStyle={{ margin: 5 }}
                                    />
                                </ListItem>
                            )}
                            numColumns={5}
                            keyExtractor={(_, index) => index.toString()}
                            style={{ alignSelf: 'center' }}
                        />
                        <Button
                            title={localeString(
                                'views.Olympians.becomeASponsor'
                            )}
                            containerStyle={{
                                margin: 10
                            }}
                            onPress={() =>
                                UrlUtils.goToUrl('https://zeusln.com/sponsor')
                            }
                        />
                    </>
                )}
                {sponsorsError && (
                    <Text
                        style={{
                            color: 'red',
                            margin: 10,
                            alignSelf: 'center',
                            fontSize: 20
                        }}
                    >
                        {sponsorsError}
                    </Text>
                )}
            </Screen>
        );
    }
}
