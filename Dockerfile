FROM reactnativecommunity/react-native-android:latest

WORKDIR /olympus

RUN git clone --depth 1 https://github.com/ZeusLN/zeus.git
WORKDIR /olympus/zeus
RUN npm install

CMD /bin/bash