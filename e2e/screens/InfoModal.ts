import { expect } from 'detox';

import { TEST_IDS } from '../../utils/TestIds';
import {
    byId,
    byText,
    waitForHidden,
    waitForVisible
} from '../helpers/elements';
import { t } from '../helpers/locale';

class InfoModal {
    get content() {
        return byId(TEST_IDS.infoModal.content);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.content);
    }

    // Each key is one paragraph of the explanation, in the English copy.
    async expectParagraphs(keys: string[]): Promise<void> {
        for (const key of keys) {
            await expect(byText(t(key))).toBeVisible();
        }
    }

    async dismiss(): Promise<void> {
        await this.content.swipe('down', 'fast', 0.9);
        await waitForHidden(this.content);
    }
}

export default new InfoModal();
