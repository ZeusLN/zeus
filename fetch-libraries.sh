VERSION=v0.20.0-beta-zeus

ANDROID_FILE=Lndmobile.aar
IOS_FILE=Lndmobile.xcframework

ANDROID_SHA256='f984f0a910fcec0b4aedafcb1a7b5e8ca40a122646774d54ba0156a7075e87ab'
IOS_SHA256='018bf400f48cfe838c605d99b310955187c476dd382623b2cb8f2235b5dfb74a'

FILE_PATH=https://github.com/ZeusLN/lnd/releases/download/$VERSION/

ANDROID_LINK=$FILE_PATH$ANDROID_FILE
IOS_LINK=$FILE_PATH$IOS_FILE.zip

# LDK Node
LDK_NODE_VERSION=v0.7.0
LDK_NODE_IOS_FILE=LDKNodeFFI.xcframework
LDK_NODE_IOS_SHA256='37e909987c285ddaaabf7caede58f0695491398acd4561987914996f4623a3c3'
LDK_NODE_IOS_LINK=https://github.com/lightningdevkit/ldk-node/releases/download/$LDK_NODE_VERSION/$LDK_NODE_IOS_FILE.zip

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

if ! echo "$ANDROID_SHA256 android/lndmobile/$ANDROID_FILE" | sha256sum -c -; then
    echo "Android library file missing or checksum failed" >&2

    # delete old instance of library file
    rm android/lndmobile/$ANDROID_FILE

    # download Android LND library file
    curl -L $ANDROID_LINK > android/lndmobile/$ANDROID_FILE

    # check checksum
    if ! echo "$ANDROID_SHA256 android/lndmobile/$ANDROID_FILE" | sha256sum -c -; then
        echo "Android checksum failed" >&2
        exit 1
    fi
fi

#######
# iOS #
#######

mkdir ios/LndMobileLibZipFile

if ! echo "$IOS_SHA256 ios/LndMobileLibZipFile/$IOS_FILE.zip" | sha256sum -c -; then
    echo "iOS library file missing or checksum failed" >&2

    # delete old instance of library file
    rm ios/LndMobileLibZipFile/$IOS_FILE.zip

    # download iOS LND library file
    curl -L $IOS_LINK > ios/LndMobileLibZipFile/$IOS_FILE.zip

    # check checksum
    if ! echo "$IOS_SHA256 ios/LndMobileLibZipFile/$IOS_FILE.zip" | sha256sum -c -; then
        echo "iOS checksum failed" >&2
        exit 1
    fi
fi

# delete old instances of library files
rm -rf ios/LncMobile/$IOS_FILE

# unzip LND library file
unzip ios/LndMobileLibZipFile/$IOS_FILE.zip -d ios/LncMobile

###############
# CashuDevKit #
###############

CDK_VERSION=0.14.2
# Local filename (what we save as)
CDK_ANDROID_FILE=cashudevkit.aar
CDK_IOS_FILE=cdkFFI.xcframework
# Remote filename (what's on GitHub releases)
CDK_ANDROID_REMOTE=cdk-kotlin-$CDK_VERSION.aar

# Checksums
CDK_ANDROID_SHA256='e8e9ee354cf21546e49946d351a6c482355f8b3800c60a8a9348c4ae40f529cb'
CDK_IOS_SHA256='5c4a152cdcd6aaa6bbd1aef65c43eaeeb6ebde3f0f365fb2254cefbc49d5ea49'

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
