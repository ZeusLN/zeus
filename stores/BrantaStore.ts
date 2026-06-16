import { action, observable, runInAction } from 'mobx';
import { BrantaServerBaseUrl, PrivacyMode } from '@branta-ops/branta';

import SettingsStore from './SettingsStore';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BrantaService } = require('@branta-ops/branta/v2');

interface Payment {
    description?: string;
    platform?: string;
    platformLogoUrl?: string;
    platformLogoLightUrl?: string;
    parentPlatform?: {
        name?: string;
        logoUrl?: string;
        logoLightUrl?: string;
    };
}

interface PaymentsResult {
    payments: Payment[];
    verifyUrl: string;
}

export interface BrantaVerification {
    platform: string;
    platformLogoUrl: string;
    platformLogoLightUrl?: string;
    description?: string;
    verifyUrl: string;
    parentPlatform?: {
        name?: string;
        logoUrl?: string;
        logoLightUrl?: string;
    };
}

export default class BrantaStore {
    @observable public verification: BrantaVerification | null = null;
    @observable public loading: boolean = false;

    settingsStore: SettingsStore;
    private service: InstanceType<typeof BrantaService>;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
        this.service = new BrantaService({
            baseUrl: BrantaServerBaseUrl.Production,
            privacy: PrivacyMode.Strict
        });
    }

    @action
    public reset = () => {
        this.verification = null;
        this.loading = false;
    };

    @action
    public verifyPayment = async (
        qrCode: string
    ): Promise<BrantaVerification | null> => {
        this.loading = true;
        this.verification = null;

        try {
            const result: PaymentsResult =
                await this.service.getPaymentsByQrCode(qrCode);

            if (!result.payments || result.payments.length === 0) {
                runInAction(() => {
                    this.loading = false;
                    this.verification = null;
                });
                return null;
            }

            const payment: Payment = result.payments[0];

            if (!payment.platform || !payment.platformLogoUrl) {
                runInAction(() => {
                    this.loading = false;
                    this.verification = null;
                });
                return null;
            }

            const verification: BrantaVerification = {
                platform: payment.platform,
                platformLogoUrl: payment.platformLogoUrl,
                platformLogoLightUrl: payment.platformLogoLightUrl,
                description: payment.description,
                verifyUrl: result.verifyUrl,
                parentPlatform: payment.parentPlatform
                    ? {
                          name: payment.parentPlatform.name,
                          logoUrl: payment.parentPlatform.logoUrl,
                          logoLightUrl: payment.parentPlatform.logoLightUrl
                      }
                    : undefined
            };

            runInAction(() => {
                this.verification = verification;
                this.loading = false;
            });

            return verification;
        } catch {
            runInAction(() => {
                this.loading = false;
                this.verification = null;
            });
            return null;
        }
    };
}
