# All library versions and hashes are defined in fetch-libraries-versions.json
LV="fetch-libraries-versions.json"
jq() { python3 -c "import json; print(json.load(open('$LV'))$1)"; }

EMBEDDED_LND_VERSION=$(jq "['embedded-lnd']['version']")
EMBEDDED_LND_ANDROID_SHA256=$(jq "['embedded-lnd']['androidSha256']")
EMBEDDED_LND_IOS_SHA256=$(jq "['embedded-lnd']['iosSha256']")
LDK_NODE_VERSION=$(jq "['ldk-node']['version']")
LDK_NODE_ANDROID_SHA256=$(jq "['ldk-node']['androidSha256']")
LDK_NODE_IOS_SHA256=$(jq "['ldk-node']['iosSha256']")
CDK_VERSION=$(jq "['cdk']['version']")
CDK_ANDROID_SHA256=$(jq "['cdk']['androidSha256']")
CDK_IOS_SHA256=$(jq "['cdk']['iosSha256']")
CDK_IOS_BINDINGS_SHA256=$(jq "['cdk']['iosBindingsSha256']")
RESTORE_VERSION=$(jq "['zeus-cashu-restore']['version']")
RESTORE_ANDROID_SHA256=$(jq "['zeus-cashu-restore']['androidSha256']")
RESTORE_IOS_SHA256=$(jq "['zeus-cashu-restore']['iosSha256']")
RESTORE_ANDROID_BINDINGS_SHA256=$(jq "['zeus-cashu-restore']['androidBindingsSha256']")
RESTORE_IOS_BINDINGS_SHA256=$(jq "['zeus-cashu-restore']['iosBindingsSha256']")

# Every hash must be 64-char lowercase hex. Fail closed on empty/malformed
# values: macOS sha256sum -c exits 0 on improperly formatted lines, so a
# blank hash would otherwise skip verification silently.
for HASH in "$EMBEDDED_LND_ANDROID_SHA256" "$EMBEDDED_LND_IOS_SHA256" \
            "$LDK_NODE_ANDROID_SHA256" "$LDK_NODE_IOS_SHA256" \
            "$CDK_ANDROID_SHA256" "$CDK_IOS_SHA256" \
            "$CDK_IOS_BINDINGS_SHA256" \
            "$RESTORE_ANDROID_SHA256" "$RESTORE_IOS_SHA256" \
            "$RESTORE_ANDROID_BINDINGS_SHA256" "$RESTORE_IOS_BINDINGS_SHA256"; do
    if ! echo "$HASH" | grep -qE '^[0-9a-f]{64}$'; then
        echo "Invalid or missing sha256 in $LV: '$HASH'" >&2
        exit 1
    fi
done

EMBEDDED_LND_ANDROID_FILE=Lndmobile.aar
EMBEDDED_LND_IOS_FILE=Lndmobile.xcframework

EMBEDDED_LND_FILE_PATH=https://github.com/ZeusLN/lnd/releases/download/$EMBEDDED_LND_VERSION/

EMBEDDED_LND_ANDROID_LINK=$EMBEDDED_LND_FILE_PATH$EMBEDDED_LND_ANDROID_FILE
EMBEDDED_LND_IOS_LINK=$EMBEDDED_LND_FILE_PATH$EMBEDDED_LND_IOS_FILE.zip

# LDK Node
LDK_NODE_ANDROID_FILE=ldk-node-android-jniLibs.zip
LDK_NODE_ANDROID_LINK=https://github.com/ZeusLN/ldk-node/releases/download/$LDK_NODE_VERSION/$LDK_NODE_ANDROID_FILE
LDK_NODE_IOS_FILE=LDKNodeFFI.xcframework
LDK_NODE_IOS_LINK=https://github.com/ZeusLN/ldk-node/releases/download/$LDK_NODE_VERSION/$LDK_NODE_IOS_FILE.zip

# test that curl and unzip are installed
if ! command -v curl &> /dev/null
then
    echo "curl could not be found. Please install it and run the script again."
    exit
fi

if ! command -v unzip &> /dev/null
then
    echo "unzip could not be found. Please install it and run the script again."
    exit
fi

###########
# Android #
###########

if ! echo "$EMBEDDED_LND_ANDROID_SHA256 android/lndmobile/$EMBEDDED_LND_ANDROID_FILE" | sha256sum -c -; then
    echo "Android library file missing or checksum failed" >&2

    # delete old instance of library file
    rm android/lndmobile/$EMBEDDED_LND_ANDROID_FILE

    # download Android LND library file
    curl -fL $EMBEDDED_LND_ANDROID_LINK > android/lndmobile/$EMBEDDED_LND_ANDROID_FILE

    # check checksum
    if ! echo "$EMBEDDED_LND_ANDROID_SHA256 android/lndmobile/$EMBEDDED_LND_ANDROID_FILE" | sha256sum -c -; then
        echo "Android checksum failed" >&2
        exit 1
    fi
fi

#######
# iOS #
#######

mkdir ios/LndMobileLibZipFile

if ! echo "$EMBEDDED_LND_IOS_SHA256 ios/LndMobileLibZipFile/$EMBEDDED_LND_IOS_FILE.zip" | sha256sum -c -; then
    echo "iOS library file missing or checksum failed" >&2

    # delete old instance of library file
    rm ios/LndMobileLibZipFile/$EMBEDDED_LND_IOS_FILE.zip

    # download iOS LND library file
    curl -fL $EMBEDDED_LND_IOS_LINK > ios/LndMobileLibZipFile/$EMBEDDED_LND_IOS_FILE.zip

    # check checksum
    if ! echo "$EMBEDDED_LND_IOS_SHA256 ios/LndMobileLibZipFile/$EMBEDDED_LND_IOS_FILE.zip" | sha256sum -c -; then
        echo "iOS checksum failed" >&2
        exit 1
    fi
fi

# delete old instances of library files
rm -rf ios/LncMobile/$EMBEDDED_LND_IOS_FILE

# unzip LND library file
unzip ios/LndMobileLibZipFile/$EMBEDDED_LND_IOS_FILE.zip -d ios/LncMobile

###############
# CashuDevKit #
###############

# Local filename (what we save as)
CDK_ANDROID_FILE=cashudevkit.aar
CDK_IOS_FILE=cdkFFI.xcframework
# Remote filename (what's on GitHub releases)
CDK_ANDROID_REMOTE=cdk-kotlin-$CDK_VERSION.aar

CDK_FILE_PATH=https://github.com/cashubtc/cdk-kotlin/releases/download/v$CDK_VERSION/
CDK_IOS_PATH=https://github.com/cashubtc/cdk-swift/releases/download/v$CDK_VERSION/

CDK_ANDROID_LINK=$CDK_FILE_PATH$CDK_ANDROID_REMOTE
CDK_IOS_LINK=$CDK_IOS_PATH$CDK_IOS_FILE.zip

# Android CDK
mkdir -p android/cdk

if ! echo "$CDK_ANDROID_SHA256 android/cdk/$CDK_ANDROID_FILE" | sha256sum -c -; then
    echo "CDK Android library file missing or checksum failed" >&2

    rm -f android/cdk/$CDK_ANDROID_FILE
    curl -fL $CDK_ANDROID_LINK > android/cdk/$CDK_ANDROID_FILE

    if ! echo "$CDK_ANDROID_SHA256 android/cdk/$CDK_ANDROID_FILE" | sha256sum -c -; then
        echo "CDK Android checksum failed" >&2
        exit 1
    fi
fi

# iOS CDK
mkdir -p ios/CashuDevKitLibZipFile
mkdir -p ios/Cdk

if ! echo "$CDK_IOS_SHA256 ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip" | sha256sum -c -; then
    echo "CDK iOS library file missing or checksum failed" >&2

    rm -f ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip
    curl -fL $CDK_IOS_LINK > ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip

    if ! echo "$CDK_IOS_SHA256 ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip" | sha256sum -c -; then
        echo "CDK iOS checksum failed" >&2
        exit 1
    fi
fi

# Extract to ios/Cdk directory (used by Podfile)
rm -rf ios/Cdk/$CDK_IOS_FILE

unzip ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip -d ios/Cdk

echo "CashuDevKit iOS framework installed to ios/Cdk/$CDK_IOS_FILE"

# Download matching Swift bindings from cdk-swift repo. When bumping the CDK
# version, update iosBindingsSha256 in fetch-libraries-versions.json to the
# hash of the file at the new tag.
CDK_SWIFT_BINDINGS_URL="https://raw.githubusercontent.com/cashubtc/cdk-swift/v$CDK_VERSION/Sources/CashuDevKit/CashuDevKit.swift"
mkdir -p ios/CashuDevKit

if ! echo "$CDK_IOS_BINDINGS_SHA256 ios/CashuDevKit/CashuDevKit.swift" | sha256sum -c -; then
    echo "CDK Swift bindings missing or checksum failed" >&2

    rm -f ios/CashuDevKit/CashuDevKit.swift
    curl -fL "$CDK_SWIFT_BINDINGS_URL" > ios/CashuDevKit/CashuDevKit.swift

    if ! echo "$CDK_IOS_BINDINGS_SHA256 ios/CashuDevKit/CashuDevKit.swift" | sha256sum -c -; then
        echo "CDK Swift bindings checksum failed" >&2
        exit 1
    fi
fi

echo "CashuDevKit Swift bindings installed for v$CDK_VERSION"

######################
# Zeus Cashu Restore #
######################

RESTORE_ANDROID_FILE=zeus-cashu-restore.aar
RESTORE_IOS_FILE=zeusRestoreFFI.xcframework

RESTORE_PATH=https://github.com/ZeusLN/zeus-cashu-restore/releases/download/v$RESTORE_VERSION/

RESTORE_ANDROID_LINK=$RESTORE_PATH$RESTORE_ANDROID_FILE
RESTORE_IOS_LINK=$RESTORE_PATH$RESTORE_IOS_FILE.zip
RESTORE_SWIFT_BINDINGS_URL="https://raw.githubusercontent.com/ZeusLN/zeus-cashu-restore/v$RESTORE_VERSION/bindings/swift/zeus_cashu_restore.swift"
RESTORE_KOTLIN_BINDINGS_URL="https://raw.githubusercontent.com/ZeusLN/zeus-cashu-restore/v$RESTORE_VERSION/bindings/kotlin/uniffi/zeus_cashu_restore/zeus_cashu_restore.kt"

# Android Restore
mkdir -p android/zeus-restore

if ! echo "$RESTORE_ANDROID_SHA256 android/zeus-restore/$RESTORE_ANDROID_FILE" | sha256sum -c -; then
    echo "Restore Android library file missing or checksum failed" >&2

    rm -f android/zeus-restore/$RESTORE_ANDROID_FILE
    curl -fL $RESTORE_ANDROID_LINK > android/zeus-restore/$RESTORE_ANDROID_FILE

    if ! echo "$RESTORE_ANDROID_SHA256 android/zeus-restore/$RESTORE_ANDROID_FILE" | sha256sum -c -; then
        echo "Restore Android checksum failed" >&2
        exit 1
    fi
fi

# iOS Restore
mkdir -p ios/ZeusRestoreLibZipFile
mkdir -p ios/ZeusRestore

if ! echo "$RESTORE_IOS_SHA256 ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip" | sha256sum -c -; then
    echo "Restore iOS library file missing or checksum failed" >&2

    rm -f ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip
    curl -fL $RESTORE_IOS_LINK > ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip

    if ! echo "$RESTORE_IOS_SHA256 ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip" | sha256sum -c -; then
        echo "Restore iOS checksum failed" >&2
        exit 1
    fi
fi

# Extract to ios/ZeusRestore directory
rm -rf ios/ZeusRestore/$RESTORE_IOS_FILE
unzip ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip -d ios/ZeusRestore

echo "Zeus Cashu Restore iOS framework installed to ios/ZeusRestore/$RESTORE_IOS_FILE"

# Download matching uniffi bindings. When bumping the zeus-cashu-restore
# version, update iosBindingsSha256 and androidBindingsSha256 in
# fetch-libraries-versions.json to the hashes of the files at the new tag.
mkdir -p ios/CashuDevKit

if ! echo "$RESTORE_IOS_BINDINGS_SHA256 ios/CashuDevKit/zeus_cashu_restore.swift" | sha256sum -c -; then
    echo "Restore Swift bindings missing or checksum failed" >&2

    rm -f ios/CashuDevKit/zeus_cashu_restore.swift
    curl -fL "$RESTORE_SWIFT_BINDINGS_URL" > ios/CashuDevKit/zeus_cashu_restore.swift

    if ! echo "$RESTORE_IOS_BINDINGS_SHA256 ios/CashuDevKit/zeus_cashu_restore.swift" | sha256sum -c -; then
        echo "Restore Swift bindings checksum failed" >&2
        exit 1
    fi
fi

echo "Zeus Cashu Restore Swift bindings installed for v$RESTORE_VERSION"

RESTORE_KOTLIN_DIR=android/app/src/main/java/uniffi/zeus_cashu_restore
mkdir -p "$RESTORE_KOTLIN_DIR"

if ! echo "$RESTORE_ANDROID_BINDINGS_SHA256 $RESTORE_KOTLIN_DIR/zeus_cashu_restore.kt" | sha256sum -c -; then
    echo "Restore Kotlin bindings missing or checksum failed" >&2

    rm -f "$RESTORE_KOTLIN_DIR/zeus_cashu_restore.kt"
    curl -fL "$RESTORE_KOTLIN_BINDINGS_URL" > "$RESTORE_KOTLIN_DIR/zeus_cashu_restore.kt"

    if ! echo "$RESTORE_ANDROID_BINDINGS_SHA256 $RESTORE_KOTLIN_DIR/zeus_cashu_restore.kt" | sha256sum -c -; then
        echo "Restore Kotlin bindings checksum failed" >&2
        exit 1
    fi
fi

echo "Zeus Cashu Restore Kotlin bindings installed for v$RESTORE_VERSION"

#####################
# LDK Node Android  #
#####################

mkdir -p android/app/src/main/jniLibs

if ! echo "$LDK_NODE_ANDROID_SHA256 android/ldk-node/$LDK_NODE_ANDROID_FILE" | sha256sum -c -; then
    echo "LDK Node Android library file missing or checksum failed" >&2

    rm -f android/ldk-node/$LDK_NODE_ANDROID_FILE
    mkdir -p android/ldk-node

    curl -fL $LDK_NODE_ANDROID_LINK > android/ldk-node/$LDK_NODE_ANDROID_FILE

    if ! echo "$LDK_NODE_ANDROID_SHA256 android/ldk-node/$LDK_NODE_ANDROID_FILE" | sha256sum -c -; then
        echo "LDK Node Android checksum failed" >&2
        exit 1
    fi
fi

# extract .so files into jniLibs
rm -rf android/app/src/main/jniLibs/arm64-v8a/libldk_node.so
rm -rf android/app/src/main/jniLibs/armeabi-v7a/libldk_node.so
rm -rf android/app/src/main/jniLibs/x86_64/libldk_node.so
unzip -o android/ldk-node/$LDK_NODE_ANDROID_FILE -d android/app/src/main/

################
# LDK Node iOS #
################

mkdir -p ios/LdkNodeLibZipFile

if ! echo "$LDK_NODE_IOS_SHA256 ios/LdkNodeLibZipFile/$LDK_NODE_IOS_FILE.zip" | sha256sum -c -; then
    echo "LDK Node iOS library file missing or checksum failed" >&2

    # delete old instance of library file
    rm -f ios/LdkNodeLibZipFile/$LDK_NODE_IOS_FILE.zip

    # download LDK Node iOS library file
    curl -fL $LDK_NODE_IOS_LINK > ios/LdkNodeLibZipFile/$LDK_NODE_IOS_FILE.zip

    # check checksum
    if ! echo "$LDK_NODE_IOS_SHA256 ios/LdkNodeLibZipFile/$LDK_NODE_IOS_FILE.zip" | sha256sum -c -; then
        echo "LDK Node iOS checksum failed" >&2
        exit 1
    fi
fi

# delete old instances of library files
rm -rf ios/LdkNodeMobile/$LDK_NODE_IOS_FILE

# unzip LDK Node library file
unzip ios/LdkNodeLibZipFile/$LDK_NODE_IOS_FILE.zip -d ios/LdkNodeMobile
