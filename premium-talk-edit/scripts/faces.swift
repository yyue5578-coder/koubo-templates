// 在指定时间点找最大的人脸，输出源画面像素坐标（左上角为原点）。
// 用法: swift faces.swift <video> <宽> <高> t1 t2 ...   -> 每行: t cx cy w h
import AVFoundation
import Vision
import Foundation
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let W = Double(a[2])!, H = Double(a[3])!
let g = AVAssetImageGenerator(asset: asset); g.appliesPreferredTrackTransform = true
g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
g.maximumSize = CGSize(width: 540, height: 960)
for ts in a[4...] {
  guard let cg = try? g.copyCGImage(at: CMTime(seconds: Double(ts)!, preferredTimescale: 600), actualTime: nil) else { print(ts, "ERR"); continue }
  let req = VNDetectFaceRectanglesRequest()
  try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
  if let b = (req.results ?? []).map({ $0.boundingBox }).max(by: { $0.width < $1.width }) {
    print(ts, Int(b.midX * W), Int((1 - b.midY) * H), Int(b.width * W), Int(b.height * H))
  } else { print(ts, "NONE") }
}
