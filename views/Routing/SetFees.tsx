import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import SetFeesForm from './../../components/SetFeesForm';

import { themeColor } from './../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import { inject, observer } from 'mobx-react';

import FeeStore from '../../stores/FeeStore';

interface SetFeesProps {
    navigation: any;
    FeeStore: FeeStore;
}

@inject('FeeStore')
@observer
export default class SetFees extends React.PureComponent<SetFeesProps, {}> {
    render() {
        const { FeeStore, navigation } = this.props;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Routing.SetFees'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('secondary')}
                />
                <View style={styles.view}>
                    <SetFeesForm FeeStore={FeeStore} expanded />
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    view: {
        backgroundColor: themeColor('background'),
        color: themeColor('text'),
        top: 5,
        padding: 15
    }
});
