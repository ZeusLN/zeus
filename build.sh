#!/bin/bash
BUILDER_IMAGE="reactnativecommunity/react-native-android:5.4"
CONTAINER_NAME="zeus_builder_container"
ZEUS_PATH=/olympus/zeus

docker run --rm --name $CONTAINER_NAME -v `pwd`:$ZEUS_PATH $BUILDER_IMAGE bash -c \
     'echo -e "\n\n********************************\n*** Building Zeus...\n********************************\n" && \
      cd /olympus/zeus ; yarn install && yarn run install-lnc && \
      cd /olympus/zeus/android ; ./gradlew assembleRelease && \

      echo -e "\n\n********************************\n**** APKs and MD5\n********************************\n" && \
      cd /olympus/zeus && \
      for f in android/app/build/outputs/apk/release/*.apk;
      do
	      RENAMED_FILENAME=$(echo $f | sed -e "s/app-/zeus-/" | sed -e "s/-release-unsigned//")
	      mv $f $RENAMED_FILENAME
	      md5sum $RENAMED_FILENAME
      done && \
      echo -e "\n" ';

