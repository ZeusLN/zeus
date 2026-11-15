import { action, observable, runInAction } from 'mobx';
import {
    BrantaEnvironment,
    BrantaService,
    createNobleCryptoProvider,
    VerifyStatus
} from '@branta-ops/branta';
import type { NobleDeps } from '@branta-ops/branta';
import { gcm } from '@noble/ciphers/aes';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

import SettingsStore from './SettingsStore';

const nobleCryptoDeps: NobleDeps = {
    sha256,
    hmac,
    gcm: gcm as NobleDeps['gcm'],
    randomBytes: (length: number) => randomBytes(length)
};

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
    private service: BrantaService;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
        this.service = new BrantaService({
            environment: BrantaEnvironment.Production,
            crypto: createNobleCryptoProvider(nobleCryptoDeps)
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
        let verification: BrantaVerification | null = null;

        try {
            const result = await this.service.verify(qrCode);
            const payment =
                result.status === VerifyStatus.Match
                    ? result.payments[0]
                    : undefined;

            if (!payment?.platform || !payment.platformLogoUrl) {
                return null;
            }

            verification = {
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

            return verification;
        } catch {
            return null;
        } finally {
            runInAction(() => {
                this.verification = verification;
                this.loading = false;
            });
        }
    };
}
