VERSION=v0.17.2-beta-zeus

ANDROID_FILE=Lndmobile.aar
IOS_FILE=Lndmobile.xcframework

ANDROID_SHA256='7c744b58a1ff19d3220d52594fa1eae786071d99f7a8b4088d9823b5281035eb'
IOS_SHA256='d933dada360ceffa4a9f9045e957399baadbdf0bf36dc2927bd4cc86970f7a30'

FILE_PATH=https://github.com/ZeusLN/lnd/releases/download/$VERSION/

ANDROID_LINK=$FILE_PATH$ANDROID_FILE
IOS_LINK=$FILE_PATH$IOS_FILE.zip

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
