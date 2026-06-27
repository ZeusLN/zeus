import Foundation
import UIKit

@objc(AppIcon)
class AppIcon: NSObject {

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc(setAlternateIcon:resolver:rejecter:)
    func setAlternateIcon(
        _ name: NSString?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            guard UIApplication.shared.supportsAlternateIcons else {
                reject(
                    "APP_ICON_UNSUPPORTED",
                    "Alternate icons are not supported on this device",
                    nil
                )
                return
            }

            let targetName = (name as String?).flatMap { $0.isEmpty ? nil : $0 }

            if UIApplication.shared.alternateIconName == targetName {
                resolve(true)
                return
            }

            UIApplication.shared.setAlternateIconName(targetName) { error in
                if let error = error {
                    reject(
                        "APP_ICON_ERROR",
                        error.localizedDescription,
                        error
                    )
                } else {
                    resolve(true)
                }
            }
        }
    }

    @objc(getAlternateIcon:rejecter:)
    func getAlternateIcon(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            resolve(UIApplication.shared.alternateIconName)
        }
    }
}
