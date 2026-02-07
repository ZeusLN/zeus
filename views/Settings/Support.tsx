import * as React from 'react';

import { FlatList, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';

import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';
import { openStoreForReview } from '../../utils/RatingUtils';

import { nodeInfoStore } from '../../stores/Stores';

interface SupportProps {
    navigation: StackNavigationProp<any, any>;
}

function Support(props: SupportProps) {
    const { navigation } = props;

    const renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    const ABOUT_ITEMS = [
        {
            label: localeString('views.PaymentRequest.donateToZEUS'),
            path: 'DonateToZEUS',
            condition: nodeInfoStore.nodeInfo.isMainNet
        },
        {
            label: localeString('views.PaymentRequest.addATip'),
            path: 'ChangeDonationSettings',
            condition: nodeInfoStore.nodeInfo.isMainNet
        },
        { label: localeString('views.Sponsors.title'), path: 'Sponsors' },
        {
            label: localeString('views.Settings.Support.store'),
            url: 'https://store.zeusln.com'
        },
        {
            label: localeString('views.Settings.SocialMedia.title'),
            path: 'SocialMedia'
        },
        {
            label: localeString('components.RatingModal.give5starReview'),
            action: openStoreForReview
        }
    ];

    return (
        <Screen>
            <Header
                leftComponent="Back"
                centerComponent={{
                    text: localeString('views.Settings.Support.title'),
                    style: {
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }
                }}
                navigation={navigation}
            />
            <FlatList
                data={ABOUT_ITEMS.filter((item) =>
                    item.condition !== undefined ? item.condition : true
                )}
                renderItem={({ item }) => (
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'transparent'
                        }}
                        onPress={() => {
                            if (item.path) navigation.navigate(item.path);
                            if (item.url) UrlUtils.goToUrl(item.url);
                            if (item.action) item.action();
                        }}
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {item.label}
                            </ListItem.Title>
                        </ListItem.Content>
                        <Icon
                            name="keyboard-arrow-right"
                            color={themeColor('secondaryText')}
                        />
                    </ListItem>
                )}
                keyExtractor={(item, index) => `${item.label}-${index}`}
                ItemSeparatorComponent={renderSeparator}
            />
        </Screen>
    );
}

export default Support;
