import * as React from 'react';
import { View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';

import ClipboardSVG from '../../assets/images/SVG/Clipboard.svg';

import PosStore from '../../stores/PosStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

interface PointOfSaleReconExportProps {
    navigation: any;
    PosStore: PosStore;
}

@inject('PosStore')
@observer
export default class PointOfSaleReconExport extends React.PureComponent<
    PointOfSaleReconExportProps,
    {}
> {
    render() {
        const { PosStore, navigation } = this.props;
        const { reconExport } = PosStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const CopyBadge = ({ copyValue }: { copyValue: string }) => (
            <TouchableOpacity onPress={() => Clipboard.setString(copyValue)}>
                <ClipboardSVG
                    fill={themeColor('highlight')}
                    width="27"
                    height="27"
                />
            </TouchableOpacity>
        );

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.POS.reconExport'),
                        style: { color: themeColor('text') }
                    }}
                    rightComponent={<CopyBadge copyValue={reconExport} />}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={{ padding: 15 }}>
                    <Text style={{ color: themeColor('text') }}>
                        {reconExport}
                    </Text>
                </View>
            </ScrollView>
        );
    }
}
