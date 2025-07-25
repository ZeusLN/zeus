#!/bin/bash
# reactnativecommunity/react-native-android:18.0
BUILDER_IMAGE="reactnativecommunity/react-native-android@sha256:c390bfb35a15ffdf52538bdd0e6c5a926469cefa8c8c6da54bfd501c122de25d"
CONTAINER_NAME="zeus_builder_container"
ZEUS_PATH=/olympus/zeus

# Default options for the Docker command
TTY_FLAG="-it"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --no-tty) TTY_FLAG="" ;; # Remove -it if --no-tty is provided
        *) echo "Unknown parameter: $1" && exit 1 ;;
    esac
    shift
done

# Run the Docker command
docker run --rm $TTY_FLAG --name $CONTAINER_NAME -v "$(pwd):$ZEUS_PATH" $BUILDER_IMAGE bash -c \
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
