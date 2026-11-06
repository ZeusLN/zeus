import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.language;

class LanguageScreen {
    get searchInput() {
        return byId(IDS.searchInput);
    }

    option(locale: string) {
        return byId(IDS.option(locale));
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.searchInput);
    }

    // A list under an open keyboard takes the first tap to dismiss it, so the
    // search is submitted to close the keyboard before a result is picked.
    async search(query: string): Promise<void> {
        await this.searchInput.typeText(query);
        await this.searchInput.tapReturnKey();
    }

    async select(locale: string): Promise<void> {
        await this.option(locale).tap();
    }
}

export default new LanguageScreen();
