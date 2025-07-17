import SettingsStore from '../stores/SettingsStore';
import Product, { PricedIn, ProductStatus } from '../models/Product';
import ReactNativeBlobUtil from 'react-native-blob-util';

const CLOVER_SANDBOX_BASE_URL = 'https://apisandbox.dev.clover.com';
const CLOVER_URL = 'https://api.clover.com';

const getCloverBaseUrl = (settings: SettingsStore) => {
    const isDev = settings.settings.pos.cloverDevMode || false;
    return !isDev ? CLOVER_URL : CLOVER_SANDBOX_BASE_URL;
};

const getCloverProducts = async (
    settings: SettingsStore
): Promise<Map<string, Product>> => {
    const { cloverMerchantId, cloverApiToken } = settings.settings.pos;

    const apiHost = getCloverBaseUrl(settings);

    const response = await ReactNativeBlobUtil.fetch(
        'GET',
        `${apiHost}/v3/merchants/${cloverMerchantId}/items?expand=taxRates`,
        {
            authorization: `Bearer ${cloverApiToken}`
        }
    );

    if (response.info().status != 200) {
        throw Error('Could not get products from clover');
    }
    return new Map(
        response.json().elements.map((item: any): [string, Product] => {
            const product: any = {
                id: item.id,
                name: item.name,
                price: item.price / 100,
                pricedIn: PricedIn.Fiat,
                status:
                    item.available === true
                        ? ProductStatus.Active
                        : ProductStatus.Inactive
            };

            if (item.taxRates) {
                let totalTaxRate = 0;
                item.taxRates.elements.forEach((taxRate: any) => {
                    totalTaxRate += taxRate.rate;
                });
                product.taxPercentage = totalTaxRate / 100000;
            }

            return [product.id, product];
        })
    );
};

const recordCloverPayment = async (
    settings: SettingsStore,
    orderId: string,
    orderAmount: number,
    orderTipAmount?: number
): Promise<void> => {
    const { cloverMerchantId, cloverApiToken } = settings.settings.pos;

    const apiHost = getCloverBaseUrl(settings);

    const tenderId = await getExternalPaymentTenderId(settings);

    const request: any = {
        tender: {
            id: tenderId
        },
        amount: orderAmount
    };

    if (orderTipAmount) {
        request.tipAmount = orderTipAmount;
    }

    const response = await ReactNativeBlobUtil.fetch(
        'POST',
        `${apiHost}/v3/merchants/${cloverMerchantId}/orders/${orderId}/payments`,
        {
            authorization: `Bearer ${cloverApiToken}`
        },
        JSON.stringify(request)
    );

    if (response.info().status != 200) {
        throw Error('Could not record Clover payment.');
    }
};

const getExternalPaymentTenderId = async (
    settings: SettingsStore
): Promise<string> => {
    const { cloverMerchantId, cloverApiToken } = settings.settings.pos;

    const apiHost = getCloverBaseUrl(settings);

    const response = await ReactNativeBlobUtil.fetch(
        'GET',
        `${apiHost}/v3/merchants/${cloverMerchantId}/tenders?filter=labelKey%3Dcom.clover.tender.external_payment`,
        {
            authorization: `Bearer ${cloverApiToken}`
        }
    );

    if (response.info().status != 200) {
        throw Error('Could not external payment tender id from clover');
    }

    const tenderId = response.json().elements[0]?.id;

    if (!tenderId) {
        throw Error('Could not external payment tender id from clover');
    }

    return tenderId;
};
export default { getCloverBaseUrl, getCloverProducts, recordCloverPayment };
