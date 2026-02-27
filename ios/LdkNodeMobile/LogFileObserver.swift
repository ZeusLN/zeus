import Foundation

public class LogFileObserver {
    private let filePath: String
    private let onNewData: (String) -> Void
    private var fileHandle: FileHandle?
    private var source: DispatchSourceFileSystemObject?

    public init(filePath: String, onNewData: @escaping (String) -> Void) {
        self.filePath = filePath
        self.onNewData = onNewData
    }

    public func startObserving() {
        // Create file if needed
        let fm = FileManager.default
        if !fm.fileExists(atPath: filePath) {
            let dir = (filePath as NSString).deletingLastPathComponent
            try? fm.createDirectory(atPath: dir, withIntermediateDirectories: true)
            fm.createFile(atPath: filePath, contents: nil)
        }

        guard let fh = FileHandle(forReadingAtPath: filePath) else { return }
        self.fileHandle = fh

        // Seek to end (skip historical)
        fh.seekToEndOfFile()

        // Use GCD dispatch source to watch for writes
        let fd = fh.fileDescriptor
        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: .write,
            queue: DispatchQueue.global(qos: .utility)
        )
        source.setEventHandler { [weak self] in
            let data = fh.availableData
            if data.count > 0, let str = String(data: data, encoding: .utf8) {
                self?.onNewData(str)
            }
        }
        source.setCancelHandler {
            fh.closeFile()
        }
        source.resume()
        self.source = source
    }

    public func stopObserving() {
        source?.cancel()
        source = nil
        fileHandle = nil
    }

    public static func tailFile(path: String, numLines: Int) -> String {
        guard let fh = FileHandle(forReadingAtPath: path) else { return "" }
        defer { fh.closeFile() }

        let fileSize = fh.seekToEndOfFile()
        if fileSize == 0 { return "" }

        // Read last chunk (256KB should be plenty for typical numLines)
        var chunkSize: UInt64 = 262144
        if chunkSize > fileSize { chunkSize = fileSize }
        fh.seek(toFileOffset: fileSize - chunkSize)

        guard let data = String(data: fh.readDataToEndOfFile(), encoding: .utf8) else { return "" }
        let lines = data.components(separatedBy: "\n")
        return lines.suffix(numLines).joined(separator: "\n")
    }
}
