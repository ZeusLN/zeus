import { TEST_IDS } from '../../utils/TestIds';
import { byId } from '../helpers/elements';

class Header {
    get backButton() {
        return byId(TEST_IDS.header.backButton);
    }

    get closeButton() {
        return byId(TEST_IDS.header.closeButton);
    }

    async goBack(): Promise<void> {
        await this.backButton.tap();
    }

    async close(): Promise<void> {
        await this.closeButton.tap();
    }
}

export default new Header();
