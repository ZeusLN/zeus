#!/bin/bash
# reactnativecommunity/react-native-android:13.0
BUILDER_IMAGE="reactnativecommunity/react-native-android@sha256:4ff9c9f80da57c72284900fcfdbd079183e735684c62d7fafd3df50fdb895453"
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

