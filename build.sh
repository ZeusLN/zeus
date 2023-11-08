#!/bin/bash
# reactnativecommunity/react-native-android:7.0
BUILDER_IMAGE="reactnativecommunity/react-native-android@sha256:7bbad62c74f01b2099163890fd11ab7b37e8a496528e6af2dfaa1f29369c2e24"
CONTAINER_NAME="zeus_builder_container"
ZEUS_PATH=/olympus/zeus

docker run --rm -it --name $CONTAINER_NAME -v `pwd`:$ZEUS_PATH $BUILDER_IMAGE bash -c \
     'echo -e "\n\n********************************\n*** Building ZEUS...\n********************************\n" && \
      cd /olympus/zeus ; yarn install --frozen-lockfile && \
      cd /olympus/zeus/android ; ./gradlew app:assembleRelease && \

      echo -e "\n\n********************************\n**** APKs and SHA256 Hashes\n********************************\n" && \
      cd /olympus/zeus && \
      for f in android/app/build/outputs/apk/release/*.apk;
      do
	      RENAMED_FILENAME=$(echo $f | sed -e "s/app-/zeus-/" | sed -e "s/-release-unsigned//")
	      mv $f $RENAMED_FILENAME
	      sha256sum $RENAMED_FILENAME
      done && \
      echo -e "\n" ';

