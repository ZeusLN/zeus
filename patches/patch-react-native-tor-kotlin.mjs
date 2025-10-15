// Fix for react-native-tor Kotlin compilation error
// This patch fixes the type mismatch in TorModule.kt line 154

import fs from 'fs';
import path from 'path';

const torModulePath = './node_modules/react-native-tor/android/src/main/java/com/reactnativetor/TorModule.kt';

console.log('Applying react-native-tor Kotlin compilation fix...');

try {
    if (!fs.existsSync(torModulePath)) {
        console.log('react-native-tor TorModule.kt not found, skipping patch');
        process.exit(0);
    }

    let content = fs.readFileSync(torModulePath, 'utf8');
    
    // Apply the fix: add type cast to resolve Kotlin compilation error
    const originalLine = '    val param = TaskParam(method, url, jsonBody, headers.toHashMap())';
    const fixedLine = '    val param = TaskParam(method, url, jsonBody, headers.toHashMap() as HashMap<String, Any>?)';
    
    if (content.includes(fixedLine)) {
        console.log('✅ react-native-tor Kotlin compilation fix already applied');
    } else if (content.includes(originalLine)) {
        content = content.replace(originalLine, fixedLine);
        fs.writeFileSync(torModulePath, content, 'utf8');
        console.log('✅ Applied react-native-tor Kotlin compilation fix');
    } else {
        console.log('⚠️  Could not find the target line to patch in TorModule.kt');
    }
} catch (error) {
    console.error('❌ Error applying react-native-tor Kotlin fix:', error.message);
    process.exit(1);
}
