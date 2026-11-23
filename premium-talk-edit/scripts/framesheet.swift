// 从视频里抽若干帧拼成一张对照图（JPEG），用来抽查成片。每格左下角标时间。
// 用法: swift framesheet.swift <video> <out.jpg> <列数> t1 t2 ...
import AVFoundation
import AppKit
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let g = AVAssetImageGenerator(asset: asset); g.appliesPreferredTrackTransform = true
g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
g.maximumSize = CGSize(width: 540, height: 960)
let cols = Int(a[3])!, times = a[4...].map { Double($0)! }
var imgs: [CGImage] = []
for t in times { imgs.append(try! g.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil)) }
let cw = imgs[0].width, ch = imgs[0].height, rows = (imgs.count + cols - 1) / cols
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: cw * cols, pixelsHigh: ch * rows, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.white.setFill(); NSRect(x: 0, y: 0, width: cw * cols, height: ch * rows).fill()
for (i, cg) in imgs.enumerated() {
  let x = (i % cols) * cw, y = (rows - 1 - i / cols) * ch
  NSImage(cgImage: cg, size: NSSize(width: cw, height: ch)).draw(in: NSRect(x: x, y: y, width: cw - 6, height: ch - 6))
  let label = String(format: " %.1fs ", times[i]) as NSString
  label.draw(at: NSPoint(x: x + 8, y: y + 8), withAttributes: [.font: NSFont.boldSystemFont(ofSize: 26), .foregroundColor: NSColor.white, .backgroundColor: NSColor.black])
}
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.8])!.write(to: URL(fileURLWithPath: a[2]))
print(cw * cols, ch * rows)
