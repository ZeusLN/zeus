// Fix jcenter() removal for Gradle 9.0
// jcenter() repository was removed in Gradle 9.0

import fs from 'fs';

export function patchJcenter() {
    console.log('Patching packages to remove jcenter()');

    const packagesWithJcenter = [
        'react-native-hce',
        'react-native-securerandom',
        'react-native-system-navigation-bar',
        'react-native-tor',
        'react-native-vector-icons'
    ];

    for (const pkg of packagesWithJcenter) {
        const buildGradlePath = `./node_modules/${pkg}/android/build.gradle`;

        if (fs.existsSync(buildGradlePath)) {
            let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

            // Remove jcenter() from buildscript repositories
            buildGradle = buildGradle.replace(
                /google\(\)\s*\n\s*jcenter\(\)/g,
                'google()\n    mavenCentral()'
            );

            // Remove standalone jcenter() lines
            buildGradle = buildGradle.replace(/^\s*jcenter\(\)\s*\n/gm, '');

            fs.writeFileSync(buildGradlePath, buildGradle);
            console.log(`  - Patched ${pkg}`);
        }
    }
}
