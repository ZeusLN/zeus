import * as React from 'react';
import { Text, ScrollView, Image } from 'react-native';

import { themeColor } from './../../utils/ThemeUtils';

interface LnurlPayMetadataProps {
    metadata: string;
}

export default class LnurlPayMetadata extends React.Component<
    LnurlPayMetadataProps
> {
    render() {
        const { metadata } = this.props;

        var keypairs: Array<Array<string>>;
        try {
            keypairs = JSON.parse(metadata);
        } catch (err) {
            keypairs = [];
        }
        const text: string = keypairs
            .filter(([typ, _]: any) => typ === 'text/plain')
            .map(([_, content]: any) => content)[0];

        const image: string = keypairs
            .filter(([typ, _]: any) => typ.slice(0, 6) === 'image/')
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
                        color: themeColor('text')
                    }}
                >
                    {text}
                </Text>
            </ScrollView>
        );
    }
}
