import UIKit
import Social
import MobileCoreServices

class ShareViewController: SLComposeServiceViewController {

    let appGroupID = "group.com.zeusln.zeus"
    let sharedKey = "sharedImageBase64"
    let appURLScheme = "zeusln://"

    private var hasProcessed = false

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if !hasProcessed {
            hasProcessed = true
            processImage()
        }
    }

    func processImage() {
        guard let item = self.extensionContext?.inputItems.first as? NSExtensionItem,
              let itemProvider = item.attachments?.first else {
            self.cancelRequest(withError: "No item found")
            return
        }

        let imageType = String(kUTTypeImage)
        
        if itemProvider.hasItemConformingToTypeIdentifier(imageType) {
            itemProvider.loadItem(forTypeIdentifier: imageType, options: nil) { (imageData, error) in
            if let error = error {
                    self.cancelRequest(withError: "Error loading item: \(error.localizedDescription)")
                    return
                }
                
                var image: UIImage?
                if let img = imageData as? UIImage {
                    image = img
                } else if let imgURL = imageData as? URL,
                          let imgData = try? Data(contentsOf: imgURL) {
                    image = UIImage(data: imgData)
                }
                
                if let image = image, let jpegData = image.jpegData(compressionQuality: 1.0) {
                    let base64String = jpegData.base64EncodedString()
                    self.saveBase64ToFile(base64String: base64String)

                    self.openMainApp()
                } else {
                    self.cancelRequest(withError: "Failed to load or convert image")
                }
            }
        } else {
            self.cancelRequest(withError: "Item is not an image")
        }
    }

    func saveBase64ToFile(base64String: String) {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) else {
            self.cancelRequest(withError: "Could not get App Group container URL")
            return
        }
        
        let fileURL = containerURL.appendingPathComponent("sharedQR.txt")
        
        do {
            try base64String.write(to: fileURL, atomically: true, encoding: .utf8)
        } catch {
            self.cancelRequest(withError: "Failed to write data to file: \(error.localizedDescription)")
        }
    }

    func openMainApp() {
        guard let url = URL(string: appURLScheme) else {
            self.cancelRequest(withError: "Could not create URL")
            return
        }

        var responder = self as UIResponder?
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url)
                self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                return
            }
            responder = responder?.next
        }
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    func cancelRequest(withError: String) {
        let error = NSError(domain: "app.zeusln.zeus.ShareQR", code: 0, userInfo: [NSLocalizedDescriptionKey: withError])
        self.extensionContext?.cancelRequest(withError: error)
    }

    override func isContentValid() -> Bool { return true }
    override func didSelectPost() { self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil) }
    override func configurationItems() -> [Any]! { return [] }
}