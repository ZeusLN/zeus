import * as React from 'react';
import { Text, ScrollView } from 'react-native';

interface LnurlPayMetadataProps {
    metadata: string;
}

export default class LnurlPayMetadata extends React.Component<
    LnurlPayMetadataProps
> {
    render() {
        const metadata = JSON.parse(this.props.metadata)
            .filter(([typ, _]) => typ === 'text/plain')
            .map(([_, content]) => content)[0];

        return (
            <ScrollView
                style={{
                    maxHeight: 220,
                    paddingTop: 20,
                    paddingBottom: 20
                }}
            >
                <Text style={{ fontFamily: 'monospace' }}>{metadata}</Text>
            </ScrollView>
        );
    }
}
