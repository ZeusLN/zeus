#!/bin/bash
# reactnativecommunity/react-native-android:18.0
BUILDER_IMAGE="reactnativecommunity/react-native-android@sha256:c390bfb35a15ffdf52538bdd0e6c5a926469cefa8c8c6da54bfd501c122de25d"
CONTAINER_NAME="zeus_builder_container"
ZEUS_PATH=/olympus/zeus

# SOURCE_DATE_EPOCH for reproducible builds - set to a fixed timestamp
# Can use the timestamp of a release commit (or use 0 for epoch)
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-0}"

# Default options for the Docker command
TTY_FLAG="-it"

# android/gradle.properties asks the Gradle daemon for -Xmx8192m plus a 4096m
# metaspace. On a machine that cannot supply that, the daemon is killed
# mid-compile and Gradle reports "daemon disappeared unexpectedly", which
# arrives AFTER yarn install and codegen have both succeeded, so it reads as a
# build bug rather than a memory one. --low-memory trades build time for a
# footprint that fits in ~4GB.
LOW_MEMORY=""

# By default the Gradle cache lives at .gradle-cache INSIDE the repo, so a
# second checkout of Zeus downloads and stores everything a second time. That
# cache measures ~6GB. --gradle-cache points several checkouts at one shared
# directory instead. It is mounted, so it may live anywhere on the host.
GRADLE_CACHE_HOST=""

usage() {
    cat <<'USAGE'
Usage: ./build.sh [options]

  --no-tty              Do not allocate a TTY. Required in CI and anywhere
                        stdin is not a terminal, or Docker fails with
                        "the input device is not a TTY".
  --low-memory          Build within roughly 4GB of RAM: ~2.2GB Gradle heap,
                        one worker, in-process Kotlin compilation. Slower.
                        Does not affect the APKs: determinism comes from
                        SOURCE_DATE_EPOCH, and builds made this way reproduce
                        the published release hashes.
  --gradle-cache DIR    Use DIR as the Gradle cache instead of ./.gradle-cache,
                        so multiple checkouts share one (~6GB) cache.
  -h, --help            Show this message.
USAGE
}

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --no-tty) TTY_FLAG="" ;; # Remove -it if --no-tty is provided
        --low-memory) LOW_MEMORY="1" ;;
        --gradle-cache)
            shift
            case "${1:-}" in
                ""|-*) echo "--gradle-cache needs a directory" && usage && exit 1 ;;
            esac
            GRADLE_CACHE_HOST="$1"
            ;;
        -h|--help) usage && exit 0 ;;
        *) echo "Unknown parameter: $1" && usage && exit 1 ;;
    esac
    shift
done

# Where the cache lives inside the container, and what to mount to get it there.
GRADLE_USER_HOME_PATH="/olympus/zeus/.gradle-cache"
CACHE_MOUNT=()
if [ -n "$GRADLE_CACHE_HOST" ]; then
    mkdir -p "$GRADLE_CACHE_HOST" || exit 1
    GRADLE_CACHE_ABS="$(cd "$GRADLE_CACHE_HOST" && pwd)" || exit 1
    GRADLE_USER_HOME_PATH="/olympus/gradle-cache"
    CACHE_MOUNT=(-v "$GRADLE_CACHE_ABS:$GRADLE_USER_HOME_PATH")
fi

# Run the Docker command with SOURCE_DATE_EPOCH for reproducible builds
docker run --rm $TTY_FLAG --name $CONTAINER_NAME \
    -e SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH \
    -e GRADLE_USER_HOME="$GRADLE_USER_HOME_PATH" \
    -e LOW_MEMORY="$LOW_MEMORY" \
    "${CACHE_MOUNT[@]}" \
    -v "$(pwd):$ZEUS_PATH" $BUILDER_IMAGE bash -c \
     'echo -e "\n\n********************************\n*** Building ZEUS...\n********************************\n" && \
      GRADLE_FLAGS=() && \
      if [ -n "$LOW_MEMORY" ]; then
          # The overrides ride the gradlew command line, which outranks every
          # gradle.properties, so neither the source tree nor the cache
          # directory is modified. That matters when building a signed tag for
          # verification, and it means nothing can go silently sticky across
          # builds on a reused cache. org.gradle.parallel is deliberately NOT
          # set here: the project sets it to false for reproducibility and
          # that must stay in force.
          GRADLE_FLAGS=(
              "--max-workers=1"
              "-Dorg.gradle.jvmargs=-Xmx2200m -XX:MaxMetaspaceSize=512m"
              "-Pkotlin.compiler.execution.strategy=in-process"
          );
      fi && \
      cd /olympus/zeus ; yarn install --frozen-lockfile && \
      cd /olympus/zeus/android ; ./gradlew "${GRADLE_FLAGS[@]}" generateCodegenArtifactsFromSchema && ./gradlew "${GRADLE_FLAGS[@]}" app:assembleRelease && \

      echo -e "\n\n********************************\n**** APKs and SHA256 Hashes\n********************************\n" && \
      cd /olympus/zeus && \
      for f in android/app/build/outputs/apk/release/*.apk;
      do
	      RENAMED_FILENAME=$(echo $f | sed -e "s/app-/zeus-/" | sed -e "s/-release-unsigned//")
	      mv $f $RENAMED_FILENAME
	      sha256sum $RENAMED_FILENAME
      done && \
      echo -e "\n" ';
