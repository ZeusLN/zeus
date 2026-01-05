// Fix react-native-os with outdated build.gradle for Gradle 9.0

import fs from 'fs';

export function patchReactNativeOs() {
    console.log('Patching react-native-os');

    const osGradlePath = './node_modules/react-native-os/android/build.gradle';

    if (!fs.existsSync(osGradlePath)) {
        console.log('  - Skipping: react-native-os not found');
        return;
    }

    const osGradleContent = `def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

apply plugin: 'com.android.library'

android {
    compileSdkVersion safeExtGet('compileSdkVersion', 34)
    namespace "com.peel.react.rnos"

    defaultConfig {
        minSdkVersion safeExtGet('minSdkVersion', 21)
        targetSdkVersion safeExtGet('targetSdkVersion', 34)
        versionCode 1
        versionName "0.2.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }

    lint {
        abortOnError false
        warning 'InvalidPackage'
    }
}

repositories {
    mavenCentral()
    google()
}

dependencies {
    implementation 'com.facebook.react:react-native:+'
}
`;

    fs.writeFileSync(osGradlePath, osGradleContent);
    console.log('  - Rewrote build.gradle');

    // Also remove package attribute from AndroidManifest.xml
    const osManifestPath =
        './node_modules/react-native-os/android/src/main/AndroidManifest.xml';

    if (fs.existsSync(osManifestPath)) {
        let manifest = fs.readFileSync(osManifestPath, 'utf8');
        manifest = manifest.replace(/\s+package="[^"]*"/, '');
        fs.writeFileSync(osManifestPath, manifest);
        console.log('  - Fixed AndroidManifest.xml');
    }
}
