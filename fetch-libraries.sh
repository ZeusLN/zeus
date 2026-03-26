# All library versions and hashes are defined in fetch-libraries-versions.json
LV="fetch-libraries-versions.json"
jq() { python3 -c "import json; print(json.load(open('$LV'))$1)"; }

EMBEDDED_LND_VERSION=$(jq "['embedded-lnd']['version']")
EMBEDDED_LND_ANDROID_SHA256=$(jq "['embedded-lnd']['androidSha256']")
EMBEDDED_LND_IOS_SHA256=$(jq "['embedded-lnd']['iosSha256']")
LDK_NODE_VERSION=$(jq "['ldk-node']['version']")
LDK_NODE_IOS_SHA256=$(jq "['ldk-node']['iosSha256']")
CDK_VERSION=$(jq "['cdk']['version']")
CDK_ANDROID_SHA256=$(jq "['cdk']['androidSha256']")
CDK_IOS_SHA256=$(jq "['cdk']['iosSha256']")
RESTORE_VERSION=$(jq "['zeus-cashu-restore']['version']")
RESTORE_ANDROID_SHA256=$(jq "['zeus-cashu-restore']['androidSha256']")
RESTORE_IOS_SHA256=$(jq "['zeus-cashu-restore']['iosSha256']")

EMBEDDED_LND_ANDROID_FILE=Lndmobile.aar
EMBEDDED_LND_IOS_FILE=Lndmobile.xcframework

EMBEDDED_LND_FILE_PATH=https://github.com/ZeusLN/lnd/releases/download/$EMBEDDED_LND_VERSION/

EMBEDDED_LND_ANDROID_LINK=$EMBEDDED_LND_FILE_PATH$EMBEDDED_LND_ANDROID_FILE
EMBEDDED_LND_IOS_LINK=$EMBEDDED_LND_FILE_PATH$EMBEDDED_LND_IOS_FILE.zip

# LDK Node
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
    curl -L $EMBEDDED_LND_ANDROID_LINK > android/lndmobile/$EMBEDDED_LND_ANDROID_FILE

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
    curl -L $EMBEDDED_LND_IOS_LINK > ios/LndMobileLibZipFile/$EMBEDDED_LND_IOS_FILE.zip

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

NEED_CDK_ANDROID=false
if [ ! -f "android/cdk/$CDK_ANDROID_FILE" ]; then
    NEED_CDK_ANDROID=true
elif [ -n "$CDK_ANDROID_SHA256" ]; then
    if ! echo "$CDK_ANDROID_SHA256 android/cdk/$CDK_ANDROID_FILE" | sha256sum -c - 2>/dev/null; then
        NEED_CDK_ANDROID=true
    fi
fi

if [ "$NEED_CDK_ANDROID" = true ]; then
    echo "Downloading CDK Android library..." >&2
    rm -f android/cdk/$CDK_ANDROID_FILE
    curl -L $CDK_ANDROID_LINK > android/cdk/$CDK_ANDROID_FILE

    if [ -n "$CDK_ANDROID_SHA256" ]; then
        if ! echo "$CDK_ANDROID_SHA256 android/cdk/$CDK_ANDROID_FILE" | sha256sum -c -; then
            echo "CDK Android checksum failed" >&2
            exit 1
        fi
    else
        echo "CDK Android downloaded (checksum verification skipped)"
        echo "SHA256: $(sha256sum android/cdk/$CDK_ANDROID_FILE | cut -d' ' -f1)"
    fi
fi

# iOS CDK
mkdir -p ios/CashuDevKitLibZipFile
mkdir -p ios/Cdk

NEED_CDK_IOS=false
if [ ! -f "ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip" ]; then
    NEED_CDK_IOS=true
elif [ -n "$CDK_IOS_SHA256" ]; then
    if ! echo "$CDK_IOS_SHA256 ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip" | sha256sum -c - 2>/dev/null; then
        NEED_CDK_IOS=true
    fi
fi

if [ "$NEED_CDK_IOS" = true ]; then
    echo "Downloading CDK iOS library..." >&2
    rm -f ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip
    curl -L $CDK_IOS_LINK > ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip

    if [ -n "$CDK_IOS_SHA256" ]; then
        if ! echo "$CDK_IOS_SHA256 ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip" | sha256sum -c -; then
            echo "CDK iOS checksum failed" >&2
            exit 1
        fi
    else
        echo "CDK iOS downloaded (checksum verification skipped)"
        echo "SHA256: $(sha256sum ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip | cut -d' ' -f1)"
    fi
fi

# Extract to ios/Cdk directory (used by Podfile)
rm -rf ios/Cdk/$CDK_IOS_FILE

unzip ios/CashuDevKitLibZipFile/$CDK_IOS_FILE.zip -d ios/Cdk

echo "CashuDevKit iOS framework installed to ios/Cdk/$CDK_IOS_FILE"

# Download matching Swift bindings from cdk-swift repo
CDK_SWIFT_BINDINGS_URL="https://raw.githubusercontent.com/cashubtc/cdk-swift/v$CDK_VERSION/Sources/CashuDevKit/CashuDevKit.swift"
mkdir -p ios/CashuDevKit

echo "Downloading CDK Swift bindings..." >&2
curl -L "$CDK_SWIFT_BINDINGS_URL" > ios/CashuDevKit/CashuDevKit.swift

echo "CashuDevKit Swift bindings updated to v$CDK_VERSION"

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

NEED_RESTORE_ANDROID=false
if [ ! -f "android/zeus-restore/$RESTORE_ANDROID_FILE" ]; then
    NEED_RESTORE_ANDROID=true
elif [ -n "$RESTORE_ANDROID_SHA256" ]; then
    if ! echo "$RESTORE_ANDROID_SHA256 android/zeus-restore/$RESTORE_ANDROID_FILE" | sha256sum -c - 2>/dev/null; then
        NEED_RESTORE_ANDROID=true
    fi
fi

if [ "$NEED_RESTORE_ANDROID" = true ]; then
    echo "Downloading Zeus Cashu Restore Android library..." >&2
    rm -f android/zeus-restore/$RESTORE_ANDROID_FILE
    curl -L $RESTORE_ANDROID_LINK > android/zeus-restore/$RESTORE_ANDROID_FILE

    if [ -n "$RESTORE_ANDROID_SHA256" ]; then
        if ! echo "$RESTORE_ANDROID_SHA256 android/zeus-restore/$RESTORE_ANDROID_FILE" | sha256sum -c -; then
            echo "Restore Android checksum failed" >&2
            exit 1
        fi
    else
        echo "Restore Android downloaded (checksum verification skipped)"
        echo "SHA256: $(sha256sum android/zeus-restore/$RESTORE_ANDROID_FILE | cut -d' ' -f1)"
    fi
fi

# iOS Restore
mkdir -p ios/ZeusRestoreLibZipFile
mkdir -p ios/ZeusRestore

NEED_RESTORE_IOS=false
if [ ! -f "ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip" ]; then
    NEED_RESTORE_IOS=true
elif [ -n "$RESTORE_IOS_SHA256" ]; then
    if ! echo "$RESTORE_IOS_SHA256 ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip" | sha256sum -c - 2>/dev/null; then
        NEED_RESTORE_IOS=true
    fi
fi

if [ "$NEED_RESTORE_IOS" = true ]; then
    echo "Downloading Zeus Cashu Restore iOS library..." >&2
    rm -f ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip
    curl -L $RESTORE_IOS_LINK > ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip

    if [ -n "$RESTORE_IOS_SHA256" ]; then
        if ! echo "$RESTORE_IOS_SHA256 ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip" | sha256sum -c -; then
            echo "Restore iOS checksum failed" >&2
            exit 1
        fi
    else
        echo "Restore iOS downloaded (checksum verification skipped)"
        echo "SHA256: $(sha256sum ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip | cut -d' ' -f1)"
    fi
fi

# Extract to ios/ZeusRestore directory
rm -rf ios/ZeusRestore/$RESTORE_IOS_FILE
unzip ios/ZeusRestoreLibZipFile/$RESTORE_IOS_FILE.zip -d ios/ZeusRestore

echo "Zeus Cashu Restore iOS framework installed to ios/ZeusRestore/$RESTORE_IOS_FILE"

# Download matching Swift bindings
mkdir -p ios/CashuDevKit

echo "Downloading Zeus Cashu Restore Swift bindings..." >&2
curl -L "$RESTORE_SWIFT_BINDINGS_URL" > ios/CashuDevKit/zeus_cashu_restore.swift

echo "Zeus Cashu Restore Swift bindings updated to v$RESTORE_VERSION"

# Download matching Kotlin bindings
RESTORE_KOTLIN_DIR=android/app/src/main/java/uniffi/zeus_cashu_restore
mkdir -p "$RESTORE_KOTLIN_DIR"

echo "Downloading Zeus Cashu Restore Kotlin bindings..." >&2
curl -L "$RESTORE_KOTLIN_BINDINGS_URL" > "$RESTORE_KOTLIN_DIR/zeus_cashu_restore.kt"

echo "Zeus Cashu Restore Kotlin bindings updated to v$RESTORE_VERSION"

################
# LDK Node iOS #
################

mkdir -p ios/LdkNodeLibZipFile

if ! echo "$LDK_NODE_IOS_SHA256 ios/LdkNodeLibZipFile/$LDK_NODE_IOS_FILE.zip" | sha256sum -c -; then
    echo "LDK Node iOS library file missing or checksum failed" >&2

    # delete old instance of library file
    rm -f ios/LdkNodeLibZipFile/$LDK_NODE_IOS_FILE.zip

    # download LDK Node iOS library file
    curl -L $LDK_NODE_IOS_LINK > ios/LdkNodeLibZipFile/$LDK_NODE_IOS_FILE.zip

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
