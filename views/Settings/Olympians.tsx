import * as React from 'react';
import { FlatList, Text, View } from 'react-native';
import { Avatar, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import LoadingIndicator from './../../components/LoadingIndicator';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import UrlUtils from './../../utils/UrlUtils';

import SettingsStore from './../../stores/SettingsStore';

interface OlympiansProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class Olympians extends React.Component<OlympiansProps, {}> {
    UNSAFE_componentWillMount() {
        this.props.SettingsStore.fetchOlympians();
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { olympiansError, olympians, loading } = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
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
                        text: localeString('views.Olympians.title'),
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
                {loading && <LoadingIndicator />}
                {!loading && !olympiansError && (
                    <>
                        <FlatList
                            data={olympians.slice().reverse()}
                            renderItem={({ item }) => (
                                <ListItem
                                    containerStyle={{
                                        backgroundColor:
                                            themeColor('background'),
                                        padding: 0
                                    }}
                                    onPress={() =>
                                        UrlUtils.goToUrl(
                                            `https://twitter.com/${item.handle}`
                                        )
                                    }
                                >
                                    <Avatar
                                        size={76}
                                        rounded
                                        source={{
                                            uri: `https://zeusln.app/api/twitter-images/${item.handle}.jpg`
                                        }}
                                        key={1}
                                        containerStyle={{ margin: 10 }}
                                    />
                                </ListItem>
                            )}
                            numColumns={4}
                            keyExtractor={(item, index) => index}
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
                                UrlUtils.goToUrl(
                                    'https://zeusln.app/about#communitySponsors'
                                )
                            }
                        />
                    </>
                )}
                {olympiansError && (
                    <Text
                        style={{
                            color: 'red',
                            margin: 10,
                            alignSelf: 'center',
                            fontSize: 20
                        }}
                    >
                        {olympiansError}
                    </Text>
                )}
            </View>
        );
    }
}
