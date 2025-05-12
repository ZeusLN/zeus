import * as React from 'react';
import { Text, Image, View, ScrollView } from 'react-native';
import { Icon } from 'react-native-elements';

import { themeColor } from '../../utils/ThemeUtils';

interface LnurlPayMetadataProps {
    metadata: string;
    showArrow?: boolean;
}

export default class LnurlPayMetadata extends React.Component<LnurlPayMetadataProps> {
    render() {
        const { metadata, showArrow = true } = this.props;

        let keypairs: Array<Array<string>>;
        try {
            keypairs = JSON.parse(metadata);
        } catch (err) {
            keypairs = [];
        }
        const text: string = keypairs
            .filter(([typ]: any) => typ === 'text/plain')
            .map(([, content]: any) => content)[0];

        const image: string = keypairs
            .filter(([typ]: any) => typ.slice(0, 6) === 'image/')
            .map(([typ, content]: any) => `data:${typ},${content}`)[0];

        return (
            <ScrollView keyboardShouldPersistTaps="handled">
                <View
                    style={{
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    {image ? (
                        <Image
                            style={{
                                width: 90,
                                height: 90,
                                marginBottom: 10
                            }}
                            source={{ uri: image }}
                        />
                    ) : null}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}
                    >
                        <Text
                            style={{
                                color: showArrow
                                    ? themeColor('highlight')
                                    : themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {text}
                        </Text>
                        {showArrow && (
                            <Icon
                                name="keyboard-arrow-down"
                                type="material"
                                size={15}
                                color={themeColor('highlight')}
                            />
                        )}
                    </View>
                </View>
            </ScrollView>
        );
    }
}
