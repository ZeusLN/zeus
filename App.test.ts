import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import * as ts from 'typescript';
import { act, render } from '@testing-library/react-native';

// On Android a persistent LND, LDK Node or NWC service keeps the JS runtime
// and its stores alive after the activity is swiped away. A new App root
// must not inherit the previous login session.
//
// App.tsx imports every screen, so every module it imports except React
// and React Native is replaced: a hand-written stand-in for the modules the
// test depends on and a passthrough component for the rest. The list is
// read from App.tsx so new screens are covered without editing this file.

const KEEP_REAL = ['react', 'react-native'];

const appImports = (): Array<{ specifier: string; names: string[] }> => {
    const filename = path.resolve(__dirname, 'App.tsx');
    const source = ts.createSourceFile(
        filename,
        fs.readFileSync(filename, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );
    return source.statements.filter(ts.isImportDeclaration).map((node) => {
        const bindings = node.importClause?.namedBindings;
        return {
            specifier: (node.moduleSpecifier as ts.StringLiteral).text,
            names:
                bindings && ts.isNamedImports(bindings)
                    ? bindings.elements.map(
                          (element) =>
                              (element.propertyName ?? element.name).text
                      )
                    : []
        };
    });
};

// Stands in for Wallet: its componentDidMount checks the session before
// App's componentDidMount runs.
const mountChecks: boolean[] = [];

// The reset itself is tested in stores/SettingsStore.test.ts; these tests
// cover when App calls it.
const settingsStore = {
    loggedIn: false,
    settings: { pin: '1234' } as any,
    setLoginStatus(status = false) {
        this.loggedIn = status;
    },
    startNewRootSession() {
        this.loggedIn = false;
    },
    loginMethodConfigured() {
        return !!(this.settings.passphrase || this.settings.pin);
    },
    loginRequired() {
        return this.loginMethodConfigured() && !this.loggedIn;
    }
};

const loadApp = () => {
    const Passthrough = ({ children }: { children?: React.ReactNode }) =>
        children ?? null;

    class SessionProbe extends React.Component {
        componentDidMount() {
            mountChecks.push(settingsStore.loginRequired());
        }
        render() {
            return null;
        }
    }

    const overrides: { [specifier: string]: () => any } = {
        './stores/Stores': () => ({ settingsStore }),
        // mobx-react 6 requires react-dom, which is not installed
        'mobx-react': () => ({
            Provider: Passthrough,
            Observer: ({ children }: { children: () => React.ReactNode }) =>
                children()
        }),
        '@react-navigation/native': () => ({
            DarkTheme: { colors: {} },
            NavigationContainer: ({
                children
            }: {
                children?: React.ReactNode;
            }) =>
                React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(SessionProbe),
                    children
                )
        }),
        '@react-navigation/native-stack': () => ({
            createNativeStackNavigator: () => ({
                Navigator: () => null,
                Screen: () => null
            })
        }),
        './utils/ThemeUtils': () => ({
            isLightTheme: () => false,
            themeColor: () => '#000'
        }),
        './utils/StealthModeUtils': () => ({
            __esModule: true,
            default: { fixStealthModeIfNeeded: jest.fn() }
        })
    };

    for (const { specifier, names } of appImports()) {
        if (KEEP_REAL.includes(specifier)) continue;
        jest.doMock(
            specifier,
            overrides[specifier] ??
                (() => ({
                    __esModule: true,
                    default: Passthrough,
                    ...Object.fromEntries(
                        names.map((name) => [name, Passthrough])
                    )
                }))
        );
    }

    return require('./App').default;
};

describe('App', () => {
    let App: any;

    beforeAll(() => {
        App = loadApp();
    });

    beforeEach(() => {
        mountChecks.length = 0;
        settingsStore.settings = { pin: '1234' };
        settingsStore.loggedIn = true;
    });

    it('ends a retained login session before the child mount checks it', async () => {
        const { unmount } = await render(React.createElement(App));

        expect(mountChecks).toEqual([true]);
        expect(settingsStore.loggedIn).toBe(false);

        await unmount();
    });

    it('does not end the session when the same App rerenders', async () => {
        const app = React.createRef<React.PureComponent>();
        const { unmount } = await render(
            React.createElement(App, { ref: app })
        );
        // the user enters the PIN on the Lockscreen
        settingsStore.setLoginStatus(true);

        // App is a PureComponent, so rerendering with the same props would
        // skip render; force one
        await act(() => app.current!.forceUpdate());

        expect(settingsStore.loggedIn).toBe(true);
        expect(mountChecks).toEqual([true]);

        await unmount();
    });

    it('ends the session again for each new App root', async () => {
        const first = await render(React.createElement(App));
        await first.unmount();
        settingsStore.setLoginStatus(true);

        const { unmount } = await render(React.createElement(App));

        expect(mountChecks).toEqual([true, true]);
        expect(settingsStore.loggedIn).toBe(false);

        await unmount();
    });
});
