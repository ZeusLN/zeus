/** @format */

import * as React from 'react'
import {Platform, StyleSheet, Text, View} from 'react-native'
import {Header, Icon} from 'react-native-elements'
import ActivityResult from 'react-native-activity-result-fork'
import {CameraKitCamera, CameraKitCameraScreen} from 'react-native-camera-kit'
import Permissions from 'react-native-permissions'

const QRINTENT = 'com.google.zxing.client.android.SCAN'

const badQRscanners = {'com.motorola.camera': true}

interface QRProps {
  title: string
  text: string
  handleQRScanned: any
  goBack: any
}

interface QRState {
  hasCameraPermission: boolean | null
  useInternalScanner: boolean
}

export default class QRCodeScanner extends React.Component<QRProps, QRState> {
  state = {
    hasCameraPermission: null,
    useInternalScanner: false
  }

  async startExternalQRScanner() {
    const {goBack} = this.props

    const activity = await ActivityResult.resolveActivity(QRINTENT)
    if (!activity || activity.package in badQRscanners) {
      this.setState({useInternalScanner: true})
      return
    }

    try {
      const uniqueId = 0
      const response = await ActivityResult.startActivityForResult(
        uniqueId,
        QRINTENT,
        {SCAN_MODE: 'QR_CODE_MODE'}
      )

      if (!response || response.resultCode === ActivityResult.CANCELED) {
        // scan was canceled
        goBack()
        return
      }

      if (response.resultCode !== ActivityResult.OK) {
        // some different error, try internal scanner
        this.setState({useInternalScanner: true})
        return
      }

      this.props.handleQRScanned(response.data.SCAN_RESULT)
    } catch (e) {
      // it seems this will never happen
      this.setState({useInternalScanner: true})
      return
    }
  }

  async componentDidMount() {
    // When on Android we'll try to use the external scanner
    if (Platform.OS === 'android') {
      this.startExternalQRScanner()
    }

    // permissions
    if (Platform.OS === 'ios') {
      const isCameraAuthorized = await CameraKitCamera.checkDeviceCameraAuthorizationStatus()

      if (isCameraAuthorized) {
        this.setState({hasCameraPermission: true})
      }
    }
  }

  async componentDidUpdate() {
    // this will only be called after we setState to useInternalScanner
    if (Platform.OS === 'android' && this.state.useInternalScanner) {
      // CameraKitCamera permissions don't work on Android at the moment
      // use react-native-permissions
      await Permissions.request('camera').then((response: any) => {
        this.setState({hasCameraPermission: response === 'authorized'})
      })
    }
  }

  render() {
    const {hasCameraPermission} = this.state
    const {title, text, handleQRScanned, goBack} = this.props

    if (!this.state.useInternalScanner) {
      // don't show anything here as the screen will be taken by the external scanner
      return null
    }

    if (hasCameraPermission === null) {
      return <Text>Requesting for camera permission</Text>
    }

    if (hasCameraPermission === false) {
      return <Text>No access to camera</Text>
    }

    return (
      <React.Fragment>
        <Header
          leftComponent={
            <Icon
              name="arrow-back"
              onPress={goBack}
              color="#fff"
              underlayColor="transparent"
            />
          }
          centerComponent={{text: title, style: {color: '#fff'}}}
          backgroundColor="grey"
        />
        <View style={styles.content}>
          <Text>{text}</Text>
        </View>
        <CameraKitCameraScreen
          laserColor={'orange'}
          frameColor={'yellow'}
          scanBarcode={true}
          onReadCode={(event: any) =>
            handleQRScanned(event.nativeEvent.codeStringValue)
          }
          hideControls={false}
          showFrame={true}
          heightForScannerFrame={250}
          style={{
            flex: 1
          }}
        />
      </React.Fragment>
    )
  }
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 10,
    paddingTop: 5
  }
})
