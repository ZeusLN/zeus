import React from 'react';
import { Observer } from 'mobx-react';

import Screen from '../../components/Screen';

export function AppContainer({ children }: { children?: React.ReactNode }) {
    return (
        <Observer>
            {() => {
                return <Screen>{children}</Screen>;
            }}
        </Observer>
    );
}
