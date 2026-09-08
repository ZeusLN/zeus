jest.mock('react-native', () => ({
    StyleSheet: { create: (styles: unknown) => styles },
    Text: 'Text',
    View: 'View'
}));
jest.mock('mobx-react', () => ({
    inject: () => (component: unknown) => component,
    observer: (component: unknown) => component
}));
jest.mock('./Amount', () => 'Amount');
jest.mock('./TextInput', () => 'FeeInput');
jest.mock('./layout/Row', () => ({ Row: 'Row' }));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { supportsCustomFeeLimit: () => true }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => 'black' }));

import * as React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { FeeLimit } from './FeeLimit';

type Props = React.ComponentProps<typeof FeeLimit>;
const settings = {
    payments: { defaultFeeFixed: '20', defaultFeePercentage: '0.5' }
};
const deferredSettings = () => {
    let resolve!: (value: typeof settings) => void;
    const promise = new Promise<typeof settings>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};

describe('FeeLimit mode synchronization', () => {
    let root: ReactTestRenderer;
    const actEnvironment = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;

    beforeAll(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    });

    afterAll(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    });

    afterEach(async () => {
        if (root) await act(async () => root.unmount());
    });

    it.each(['child-first', 'parent-first', 'together'])(
        'uses percentage when the parent selects it after mount (%s)',
        async (order) => {
            const childSettings = deferredSettings();
            const parentSettings = deferredSettings();
            const caps = jest.fn();
            // PaymentRequest renders the already-decoded LNURL invoice with
            // fixed mode, then selects percent after its own settings await.
            class PaymentScreen extends React.Component {
                state = { feeOption: 'fixed', feeLimitSat: '1000' };
                async componentDidMount() {
                    await parentSettings.promise;
                    this.setState({ feeOption: 'percent' });
                    this.setState({ feeLimitSat: '20' });
                }
                render() {
                    return (
                        <FeeLimit
                            satAmount={100000}
                            feeOption={this.state.feeOption}
                            SettingsStore={
                                {
                                    getSettings: () => childSettings.promise
                                } as unknown as Props['SettingsStore']
                            }
                            onFeeLimitSatChange={(feeLimitSat) => {
                                caps(feeLimitSat);
                                this.setState({ feeLimitSat });
                            }}
                        />
                    );
                }
            }
            await act(async () => {
                root = create(<PaymentScreen />);
            });
            if (order === 'together') {
                await act(async () => {
                    childSettings.resolve(settings);
                    parentSettings.resolve(settings);
                });
            } else {
                const first =
                    order === 'child-first' ? childSettings : parentSettings;
                const second =
                    order === 'child-first' ? parentSettings : childSettings;
                await act(async () => first.resolve(settings));
                await act(async () => second.resolve(settings));
            }
            expect(caps).toHaveBeenLastCalledWith('500');
            expect(
                root.root.findByType(PaymentScreen).instance.state.feeLimitSat
            ).toBe('500');
        }
    );

    it('handles mode and amount changing together in both directions', async () => {
        const caps = jest.fn();
        const props: Props = {
            satAmount: 1000,
            feeOption: 'fixed',
            SettingsStore: {
                getSettings: async () => settings
            } as unknown as Props['SettingsStore'],
            onFeeLimitSatChange: caps
        };
        await act(async () => {
            root = create(<FeeLimit {...props} />);
        });
        expect(caps).toHaveBeenLastCalledWith('20');
        await act(async () => {
            root.update(
                <FeeLimit {...props} satAmount={1001} feeOption="percent" />
            );
        });
        expect(caps).toHaveBeenLastCalledWith('5');
        await act(async () => {
            root.update(<FeeLimit {...props} satAmount={999} />);
        });
        expect(caps).toHaveBeenLastCalledWith('20');
    });

    it('preserves a manual selection on amount changes and unrelated renders', async () => {
        const caps = jest.fn();
        const props: Props = {
            satAmount: 100000,
            feeOption: 'percent',
            SettingsStore: {
                getSettings: async () => settings
            } as unknown as Props['SettingsStore'],
            onFeeLimitSatChange: caps
        };
        await act(async () => {
            root = create(<FeeLimit {...props} />);
        });
        expect(caps).toHaveBeenLastCalledWith('500');
        // Some callers do not supply onFeeOptionChange. An unchanged prop
        // must not override the local selection on the next amount update.
        const inputs = () =>
            root.root.findAll(
                (node) => node.type === ('FeeInput' as React.ElementType)
            );
        await act(async () => inputs()[0].props.onPressIn());
        expect(caps).toHaveBeenLastCalledWith('20');
        await act(async () => {
            root.update(<FeeLimit {...props} satAmount={200000} />);
        });
        expect(caps).toHaveBeenLastCalledWith('20');
        await act(async () => {
            root.update(
                <FeeLimit
                    {...props}
                    satAmount={200000}
                    displayFeeRecommendation={false}
                />
            );
        });
        expect(caps).toHaveBeenLastCalledWith('20');
        await act(async () => inputs()[1].props.onPressIn());
        expect(caps).toHaveBeenLastCalledWith('1000');
    });
});
