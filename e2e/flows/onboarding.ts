import { launchFreshApp } from '../helpers/app';
import IntroSplashScreen from '../screens/IntroSplashScreen';
import NodeChoiceScreen from '../screens/NodeChoiceScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RecommendedSettingsScreen from '../screens/RecommendedSettingsScreen';
import WalletSetupScreen from '../screens/WalletSetupScreen';
import WalletTypeScreen from '../screens/WalletTypeScreen';

export type WalletTypeChoice = 'selfCustody' | 'ecash';
export type NodeChoice = 'ldkNode' | 'embeddedLnd';

// Fresh install, through the splash, to the "how do you want to set up" step.
export const startOnboarding = async (): Promise<void> => {
    await launchFreshApp();
    await IntroSplashScreen.waitUntilDisplayed();
    await IntroSplashScreen.getStartedButton.tap();
    await OnboardingScreen.waitUntilDisplayed();
};

export const openRecommendedSettings = async (): Promise<void> => {
    await startOnboarding();
    await OnboardingScreen.recommendedButton.tap();
    await RecommendedSettingsScreen.waitUntilDisplayed();
};

export const chooseWalletType = async (
    choice: WalletTypeChoice
): Promise<void> => {
    await WalletTypeScreen.waitUntilDisplayed();
    await (choice === 'ecash'
        ? WalletTypeScreen.ecashButton
        : WalletTypeScreen.selfCustodyButton
    ).tap();
};

export const chooseNode = async (choice: NodeChoice): Promise<void> => {
    await NodeChoiceScreen.waitUntilDisplayed();
    await (choice === 'embeddedLnd'
        ? NodeChoiceScreen.embeddedLndButton
        : NodeChoiceScreen.ldkNodeButton
    ).tap();
};

// From the setup choice, answers every questionnaire step and lands on the
// settings summary.
export const answerQuestionnaire = async (
    walletType: WalletTypeChoice,
    node: NodeChoice
): Promise<void> => {
    await OnboardingScreen.questionnaireButton.tap();
    await WalletSetupScreen.waitUntilDisplayed();
    await WalletSetupScreen.createWalletButton.tap();
    await chooseWalletType(walletType);
    await chooseNode(node);
    await RecommendedSettingsScreen.waitUntilDisplayed();
};
