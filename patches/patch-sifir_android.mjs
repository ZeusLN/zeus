// This might be removed when this issue is fixed: https://github.com/Sifir-io/react-native-tor/issues/57

import compressing from 'compressing';
import fs from 'fs';

console.log('Removing unsupported arm64 JNI from sifir_android');

(async () => {
    await compressing.zip.uncompress(
        './node_modules/react-native-tor/android/libs/sifir_android.aar',
        './node_modules/react-native-tor/android/libs/sifir_android'
    );

    fs.rmSync(
        './node_modules/react-native-tor/android/libs/sifir_android/jni/arm64',
        { force: true, recursive: true }
    );

    fs.rmSync('./node_modules/react-native-tor/android/libs/sifir_android.aar');

    await compressing.zip.compressDir(
        './node_modules/react-native-tor/android/libs/sifir_android',
        './node_modules/react-native-tor/android/libs/sifir_android.aar',
        { ignoreBase: true }
    );

    fs.rmSync('./node_modules/react-native-tor/android/libs/sifir_android', {
        force: true,
        recursive: true
    });

    // Fix Kotlin 2.0 type compatibility issue with nullable Any
    // TaskParam headers changed from HashMap<String, Any>? to HashMap<String, Any?>?
    console.log('Patching TorBridgeRequest.kt for Kotlin 2.0 compatibility');
    const torBridgeRequestPath =
        './node_modules/react-native-tor/android/src/main/java/com/reactnativetor/TorBridgeRequest.kt';
    let torBridgeContent = fs.readFileSync(torBridgeRequestPath, 'utf8');
    torBridgeContent = torBridgeContent.replace(
        'val headers: HashMap<String, Any>?',
        'val headers: HashMap<String, Any?>?'
    );
    fs.writeFileSync(torBridgeRequestPath, torBridgeContent);

    // Fix react-native-svg missing scripts folder (npm publish issue)
    // The scripts/rnsvg_utils.rb file is required by RNSVG.podspec but not published to npm
    console.log('Creating react-native-svg scripts folder');
    const svgScriptsDir = './node_modules/react-native-svg/scripts';
    if (!fs.existsSync(svgScriptsDir)) {
        fs.mkdirSync(svgScriptsDir, { recursive: true });
    }
    const rnsvgUtilsContent = `# Copied from Reanimated https://github.com/software-mansion/react-native-reanimated/blob/c6d68151644056476518241b0087b1ed900b39b6/packages/react-native-reanimated/scripts/reanimated_utils.rb
def rnsvg_try_to_parse_react_native_package_json(node_modules_dir)
  react_native_package_json_path = File.join(node_modules_dir, 'react-native/package.json')
  if !File.exist?(react_native_package_json_path)
    return nil
  end
  return JSON.parse(File.read(react_native_package_json_path))
end

def rnsvg_find_config()
  result = {
    :react_native_version => nil,
    :react_native_minor_version => nil,
    :react_native_node_modules_dir => nil,
  }

  react_native_node_modules_dir = File.join(File.dirname(\`cd "#{Pod::Config.instance.installation_root.to_s}" && node --print "require.resolve('react-native/package.json')"\`), '..')
  react_native_json = rnsvg_try_to_parse_react_native_package_json(react_native_node_modules_dir)

  if react_native_json == nil
    # user configuration, just in case
    node_modules_dir = ENV["REACT_NATIVE_NODE_MODULES_DIR"]
    react_native_json = rnsvg_try_to_parse_react_native_package_json(node_modules_dir)
  end

  if react_native_json == nil
    raise '[RNSVG] Unable to recognize your \`react-native\` version. Please set environmental variable with \`react-native\` location: \`export REACT_NATIVE_NODE_MODULES_DIR="<path to react-native>" && pod install\`.'
  end

  result[:react_native_version] = react_native_json['version']
  # We need to do this way as module loader is not available at this point
  match = react_native_json['version'].match(/^(\\d+)\\.(\\d+)/)
  if match
    result[:react_native_minor_version] = match[2].to_i
  elsif react_native_json['version'].include? 'nightly'
    result[:react_native_minor_version] = 1000
  end
  result[:react_native_node_modules_dir] = react_native_node_modules_dir

  return result
end
`;
    fs.writeFileSync(svgScriptsDir + '/rnsvg_utils.rb', rnsvgUtilsContent);
})();
