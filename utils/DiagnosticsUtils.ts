import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Share, { Social } from 'react-native-share';
import DeviceInfo from 'react-native-device-info';

import { version } from '../package.json';

import { settingsStore, activityStore } from '../stores/Stores';

import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';

import {
    convertActivityToCsv,
    CSV_KEYS,
    getFormattedDateTime
} from './ActivityCsvUtils';
import { redactSettings } from './DiagnosticsRedaction';
import { localeString } from './LocaleUtils';

const SUPPORT_EMAIL = 'support@zeusln.com';
const TAIL_LINES = 500;

export interface DiagnosticsSelections {
    settings: boolean;
    lndLogs: boolean;
    ldkLogs: boolean;
    cdkLogs: boolean;
    activity: boolean;
}

const section = (title: string, body: string): string =>
    `\n===== ${title} =====\n${body}\n`;

const tryCollect = async (fn: () => Promise<string>): Promise<string> => {
    try {
        const result = await fn();
        return result && result.length ? result : '(empty)';
    } catch (e: any) {
        return `(unavailable: ${e?.message || e})`;
    }
};

const getActiveNode = (): any => {
    const { settings } = settingsStore;
    return settings?.nodes?.[settings?.selectedNode || 0];
};

const safe = (fn: () => any): string => {
    try {
        const value = fn();
        return value == null ? 'unknown' : `${value}`;
    } catch (e) {
        return 'unknown';
    }
};

const buildHeader = (): string => {
    const node = getActiveNode();
    return [
        'ZEUS Diagnostics',
        `App: ZEUS v${version} (build ${safe(() =>
            DeviceInfo.getBuildNumber()
        )})`,
        `Platform: ${Platform.OS} ${safe(() => DeviceInfo.getSystemVersion())}`,
        `Device: ${safe(() => DeviceInfo.getModel())}`,
        `Active backend: ${node?.implementation || 'unknown'}`
    ].join('\n');
};

const collectLndLogs = (): Promise<string> =>
    tryCollect(async () => {
        const network =
            settingsStore.embeddedLndNetwork === 'Testnet'
                ? 'testnet'
                : 'mainnet';
        return await NativeModules.LndMobileTools.tailLog(
            TAIL_LINES,
            settingsStore.lndDir || 'lnd',
            network
        );
    });

const collectLdkLogs = (): Promise<string> =>
    tryCollect(
        async () => await NativeModules.LdkNodeModule.tailLdkNodeLog(TAIL_LINES)
    );

const collectCdkLogs = (): Promise<string> =>
    tryCollect(
        async () =>
            await NativeModules.CashuDevKitModule.tailCashuLog(TAIL_LINES)
    );

const collectActivity = (): Promise<string> =>
    tryCollect(async () => {
        await activityStore.getActivityAndFilter(
            settingsStore.settings?.locale
        );
        const items: any[] = activityStore.filteredActivity || [];

        const invoices = items.filter(
            (i) => i instanceof Invoice || i instanceof CashuInvoice
        );
        const payments = items.filter(
            (i) => i instanceof Payment || i instanceof CashuPayment
        );
        const transactions = items.filter((i) => i instanceof Transaction);

        const parts = [
            invoices.length &&
                `--- Invoices ---\n${await convertActivityToCsv(
                    invoices,
                    CSV_KEYS.invoice
                )}`,
            payments.length &&
                `--- Payments ---\n${await convertActivityToCsv(
                    payments,
                    CSV_KEYS.payment
                )}`,
            transactions.length &&
                `--- On-chain ---\n${await convertActivityToCsv(
                    transactions,
                    CSV_KEYS.transaction
                )}`
        ].filter(Boolean);

        return parts.join('\n\n');
    });

/**
 * Assemble the diagnostics report from the selected sections. The header
 * (version / build / platform / active backend) is always included. Every
 * section is collected defensively so one failing source cannot block the
 * rest.
 */
export const collectDiagnostics = async (
    selections: DiagnosticsSelections
): Promise<string> => {
    const parts: string[] = [buildHeader()];

    if (selections.settings) {
        parts.push(
            section(
                'SETTINGS (redacted)',
                JSON.stringify(redactSettings(settingsStore.settings), null, 2)
            )
        );
    }
    if (selections.lndLogs) {
        parts.push(section('LND LOGS', await collectLndLogs()));
    }
    if (selections.ldkLogs) {
        parts.push(section('LDK LOGS', await collectLdkLogs()));
    }
    if (selections.cdkLogs) {
        parts.push(section('CDK LOGS', await collectCdkLogs()));
    }
    if (selections.activity) {
        parts.push(section('ACTIVITY', await collectActivity()));
    }

    return parts.join('\n');
};

// Remove any diagnostics files left over from previous runs so they do not
// accumulate. We intentionally do NOT unlink the freshly-written file after
// sharing: on Android the mail app reads the attachment asynchronously and
// deleting it too early can drop the attachment.
const cleanupOldReports = async (directory: string): Promise<void> => {
    try {
        const files = await RNFS.readDir(directory);
        await Promise.all(
            files
                .filter(
                    (f) =>
                        f.name.startsWith('zeus-diagnostics-') &&
                        f.name.endsWith('.txt')
                )
                .map((f) => RNFS.unlink(f.path).catch(() => {}))
        );
    } catch (e) {
        // ignore
    }
};

/**
 * Write the report to a temp file and hand it to the OS email flow with a
 * prefilled body inviting the user to describe their issue at the top.
 * Falls back to the generic share sheet when no email app is available.
 */
export const shareDiagnostics = async (report: string): Promise<void> => {
    const directory = RNFS.CachesDirectoryPath;
    await cleanupOldReports(directory);

    const fileName = `zeus-diagnostics-${getFormattedDateTime()}.txt`;
    const filePath = `${directory}/${fileName}`;
    await RNFS.writeFile(filePath, report, 'utf8');

    const subject = localeString('views.Settings.Diagnostics.email.subject');
    const body = `${localeString(
        'views.Settings.Diagnostics.email.bodyPlaceholder'
    )}\n\n\n---\nZEUS v${version} · ${Platform.OS} ${safe(() =>
        DeviceInfo.getSystemVersion()
    )}`;
    const url = `file://${filePath}`;

    try {
        await Share.shareSingle({
            social: Social.Email,
            email: SUPPORT_EMAIL,
            subject,
            message: body,
            urls: [url]
        });
    } catch (e) {
        // No email app / share failed — fall back to the generic share sheet.
        try {
            await Share.open({
                title: subject,
                subject,
                email: SUPPORT_EMAIL,
                message: body,
                url,
                filename: fileName,
                type: 'text/plain',
                failOnCancel: false
            });
        } catch (err) {
            // user cancelled or share unavailable — nothing to do
        }
    }
};
