// Runs SharedScreen under a real NavigationContainer and StackRouter to check
// the commit that reanimated's shared element transition proxy depends on:
// the boundary of the screen revealed by a pop must already be active in the
// commit that removes the screen above it, or the proxy finds no destination
// boundary and skips the return transition (ZeusLN/zeus#4222).

// isActive of each mounted boundary, keyed by route name
const mockActive: { [route: string]: boolean } = {};

jest.mock('react-native-reanimated', () => {
    const React = require('react');
    const { Image, Text, View } = require('react-native');
    const { useRoute } = require('@react-navigation/native');
    const builder: any = {};
    ['springify', 'dampingRatio', 'delay', 'duration', 'easing'].forEach(
        (method) => (builder[method] = () => builder)
    );
    return {
        __esModule: true,
        default: { Image, Text, View },
        Easing: { out: () => () => 0, cubic: () => 0 },
        FadeIn: builder,
        SharedTransition: builder,
        SharedTransitionBoundary: ({ isActive, children }: any) => {
            const { name } = useRoute();
            React.useLayoutEffect(() => {
                mockActive[name] = isActive;
            }, [name, isActive]);
            React.useLayoutEffect(
                () => () => {
                    delete mockActive[name];
                },
                [name]
            );
            return <View>{children}</View>;
        }
    };
});

import * as React from 'react';
import { Text, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import {
    createNavigationContainerRef,
    createNavigatorFactory,
    NavigationContainer,
    StackRouter,
    useNavigationBuilder
} from '@react-navigation/native';

import { SharedScreen } from './SharedTransition';

// Renders only the routes in the state, so a pop removes the screen in the
// same commit as the state change
function Stack({ initialRouteName, children }: any) {
    const { state, descriptors, NavigationContent } = useNavigationBuilder(
        StackRouter,
        { initialRouteName, children }
    );
    return (
        <NavigationContent>
            <View>
                {state.routes.map((route) => (
                    <View key={route.key}>
                        {descriptors[route.key].render()}
                    </View>
                ))}
            </View>
        </NavigationContent>
    );
}
const createStack = createNavigatorFactory(Stack);

// Memoized like Zeus's observer screens, so a navigator render does not
// re-render the screen content; only the focus hook can update it
const ContactsContent = React.memo(() => (
    <SharedScreen>
        <Text>Contacts</Text>
    </SharedScreen>
));
const ContactDetailsContent = React.memo(() => (
    <SharedScreen>
        <Text>ContactDetails</Text>
    </SharedScreen>
));
const Contacts = () => <ContactsContent />;
const ContactDetails = () => <ContactDetailsContent />;

describe('SharedScreen with real navigation', () => {
    const StackNav = createStack();
    const ref = createNavigationContainerRef<any>();
    // boundary state at the end of every commit
    let commits: Array<{ [route: string]: boolean }>;

    beforeEach(async () => {
        commits = [];
        Object.keys(mockActive).forEach((route) => delete mockActive[route]);
        await render(
            <React.Profiler
                id="stack"
                onRender={() => commits.push({ ...mockActive })}
            >
                <NavigationContainer ref={ref}>
                    <StackNav.Navigator initialRouteName="Contacts">
                        <StackNav.Screen name="Contacts" component={Contacts} />
                        <StackNav.Screen
                            name="ContactDetails"
                            component={ContactDetails}
                        />
                    </StackNav.Navigator>
                </NavigationContainer>
            </React.Profiler>
        );
    });

    it('activates only the initial screen', () => {
        expect(mockActive).toEqual({ Contacts: true });
    });

    it('activates the pushed screen in the commit that mounts it', async () => {
        commits = [];
        await act(async () => ref.navigate('ContactDetails'));
        const mountCommit = commits.find(
            (commit) => 'ContactDetails' in commit
        );
        expect(mountCommit).toEqual({
            Contacts: false,
            ContactDetails: true
        });
        expect(mockActive).toEqual({ Contacts: false, ContactDetails: true });
    });

    it('activates the revealed screen in the commit that removes the popped screen', async () => {
        await act(async () => ref.navigate('ContactDetails'));
        commits = [];
        await act(async () => ref.goBack());

        const removalCommit = commits.find(
            (commit) => !('ContactDetails' in commit)
        );
        expect(removalCommit).toEqual({ Contacts: true });
        expect(mockActive).toEqual({ Contacts: true });
    });
});
