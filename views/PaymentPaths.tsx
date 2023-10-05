import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import PaymentPath from '../components/PaymentPath';
import Screen from '../components/Screen';

import ChannelsStore from '../stores/ChannelsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface PaymentPathsViewProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
}

@inject('ChannelsStore')
@observer
export default class PaymentPathsView extends React.Component<PaymentPathsViewProps> {
    render() {
        const { navigation } = this.props;
        const enhancedPath = navigation.getParam('enhancedPath', null);
        const { aliasMap, loading } = this.props.ChannelsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text:
                            enhancedPath.length > 1
                                ? `${localeString('views.Payment.paths')} (${
                                      enhancedPath.length
                                  })`
                                : localeString('views.Payment.path'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={
                        loading && (
                            <View style={{ right: 5 }}>
                                <LoadingIndicator size={30} />
                            </View>
                        )
                    }
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={styles.content}>
                        {enhancedPath.length > 0 && aliasMap && (
                            <PaymentPath
                                value={enhancedPath}
                                aliasMap={aliasMap}
                            />
                        )}
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    }
});
