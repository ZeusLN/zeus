import * as React from 'react';
import { Text, ScrollView, Image } from 'react-native';

import { themeColor } from './../../utils/ThemeUtils';

interface LnurlPayMetadataProps {
    metadata: string;
}

export default class LnurlPayMetadata extends React.Component<LnurlPayMetadataProps> {
    render() {
        const { metadata } = this.props;

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
            <ScrollView
                style={{
                    maxHeight: 220,
                    paddingTop: 20,
                    paddingBottom: 20,
                    flexDirection: 'column'
                }}
                contentContainerStyle={{
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
                keyboardShouldPersistTaps="handled"
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
                <Text
                    style={{
                        color: themeColor('text'),
                        fontFamily: 'Lato-Regular'
                    }}
                >
                    {text}
                </Text>
            </ScrollView>
        );
    }
}
