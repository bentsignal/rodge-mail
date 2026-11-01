// Renders the flat icon assets from <name>.icon (its SVG layers and the fills
// in icon.json), without Liquid Glass:
//   <name>-android-foreground.png    Android adaptive foreground
//   <name>-android-background.png    Android adaptive background
//   <name>-android-monochrome.png    Android themed icon (white plane)
//   <name>-android-notification.png  Android notification small icon (white plane)
//   ../icon.png                      square, opaque fallback icon
//   apps/web/public icons            touch, PWA, and favicon PNGs
// The white plane shades its far wing with alpha, from the tinted fills.
// Usage: swift render-flat.swift "$PWD" rodge-mail (build-icons.py runs it).
import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let name = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "rodge-mail"
let bundle = root.appendingPathComponent("\(name).icon")
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let document = try! JSONSerialization.jsonObject(
  with: Data(contentsOf: bundle.appendingPathComponent("icon.json"))) as! [String: Any]

enum Appearance: String { case light, dark, tinted }

/// A fill as gradient stops (one stop for a solid color).
func stops(_ value: [String: Any]) -> [CGColor] {
  let colors = (value["linear-gradient"] as? [String]) ?? [value["solid"] as! String]
  return colors.map { c in
    let parts = c.replacingOccurrences(of: "extended-srgb:", with: "").split(separator: ",").map { CGFloat(Double($0)!) }
    return CGColor(colorSpace: space, components: parts)!
  }
}

/// The fill for an appearance: its specialization, else the unqualified one.
func fill(_ specializations: [[String: Any]], _ appearance: Appearance) -> [CGColor] {
  let name = appearance == .light ? nil : appearance.rawValue
  let match = specializations.first { ($0["appearance"] as? String) == name }
    ?? specializations.first { $0["appearance"] == nil }!
  return stops(match["value"] as! [String: Any])
}

/// The paths in an SVG layer; they use only absolute M, L, and Z.
func paths(_ image: String) -> [CGPath] {
  let svg = try! String(contentsOf: bundle.appendingPathComponent("Assets/\(image)"), encoding: .utf8)
  return svg.components(separatedBy: " d=\"").dropFirst().map { chunk in
    let tokens = chunk.components(separatedBy: "\"")[0].split(separator: " ").map(String.init)
    let path = CGMutablePath()
    var i = 0
    func point() -> CGPoint { defer { i += 2 }; return CGPoint(x: Double(tokens[i])!, y: Double(tokens[i + 1])!) }
    while i < tokens.count {
      let command = tokens[i]; i += 1
      switch command {
      case "M": path.move(to: point())
      case "L": path.addLine(to: point())
      case "Z": path.closeSubpath()
      default: fatalError(command)
      }
    }
    return path
  }
}

struct Layer {
  let paths: [CGPath]
  let fills: [[String: Any]]
  var bounds: CGRect { paths.reduce(CGRect.null) { $0.union($1.boundingBoxOfPath) } }
}

// Back to front: Icon Composer lists groups and their layers front to back.
let layers: [Layer] = (document["groups"] as! [[String: Any]]).reversed().flatMap { group in
  (group["layers"] as! [[String: Any]]).reversed().map { layer in
    Layer(paths: paths(layer["image-name"] as! String),
          fills: layer["fill-specializations"] as! [[String: Any]])
  }
}
let box = layers.flatMap(\.paths).reduce(CGRect.null) { $0.union($1.boundingBoxOfPath) }
let full = CGRect(x: 0, y: 0, width: 1024, height: 1024)
let iconWidth = max(box.width, box.height) // Its size on the Icon Composer canvas.

func context(_ size: Int, opaque: Bool = false) -> CGContext {
  CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space,
            bitmapInfo: (opaque ? CGImageAlphaInfo.noneSkipLast : .premultipliedLast).rawValue)!
}
func write(_ ctx: CGContext, _ name: String) {
  let d = CGImageDestinationCreateWithURL(root.appendingPathComponent(name) as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(d, ctx.makeImage()!, nil); precondition(CGImageDestinationFinalize(d))
}
/// Fills the current clip with a top-to-bottom gradient over `rect` (SVG coordinates).
func gradient(_ ctx: CGContext, _ colors: [CGColor], _ rect: CGRect) {
  let g = CGGradient(colorsSpace: space, colors: (colors.count == 1 ? colors + colors : colors) as CFArray, locations: nil)!
  ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: rect.minY), end: CGPoint(x: 0, y: rect.maxY),
                         options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
}

/// The plane on a transparent canvas, `width` pixels across, placed as on the
/// Icon Composer canvas (optically centered). `white` draws it white, each
/// wing as opaque as its tinted fill is light (the monochrome icons).
func leaves(size: Int, width: CGFloat, appearance: Appearance, white: Bool = false) -> CGImage {
  let ctx = context(size)
  let s = width / iconWidth, c = CGFloat(size) / 2
  ctx.translateBy(x: 0, y: CGFloat(size)); ctx.scaleBy(x: 1, y: -1)
  ctx.translateBy(x: c, y: c); ctx.scaleBy(x: s, y: s); ctx.translateBy(x: -full.midX, y: -full.midY)
  for (i, layer) in layers.enumerated() {
    // Each wing also fills the wings in front of it, so the fold, where they
    // meet, has no antialiasing seam.
    ctx.saveGState()
    for path in layers[i...].flatMap(\.paths) { ctx.addPath(path) }
    ctx.clip()
    let colors = white
      ? fill(layer.fills, .tinted).map { CGColor(colorSpace: space, components: [1, 1, 1, $0.components![0]])! }
      : fill(layer.fills, appearance)
    gradient(ctx, colors, layer.bounds)
    ctx.restoreGState()
  }
  return ctx.makeImage()!
}

let background = stops((document["fill"] as! [String: Any]))
func drawBackground(_ ctx: CGContext, _ size: Int) {
  let g = CGGradient(colorsSpace: space, colors: background as CFArray, locations: nil)!
  ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: size), end: .zero, options: [])
}

// Android: the plane inside the 66% safe zone of the adaptive icon.
let foreground = context(1024)
foreground.draw(leaves(size: 1024, width: 600, appearance: .light), in: full)
write(foreground, "\(name)-android-foreground.png")
let androidBackground = context(1024, opaque: true)
drawBackground(androidBackground, 1024)
write(androidBackground, "\(name)-android-background.png")

let monochrome = context(1024)
monochrome.draw(leaves(size: 1024, width: 600, appearance: .light, white: true), in: full)
write(monochrome, "\(name)-android-monochrome.png")

// Notification small icon: Android draws only its alpha, so the plane fills
// the 20dp live area of the 24dp icon.
let notification = context(1024)
notification.draw(leaves(size: 1024, width: 1024 * 20 / 24, appearance: .light, white: true), in: full)
write(notification, "\(name)-android-notification.png")

/// The light appearance without glass, square and opaque.
func flatIcon(_ size: Int, cornerRadius: CGFloat = 0) -> CGContext {
  let ctx = context(size, opaque: cornerRadius == 0)
  if cornerRadius > 0 {
    ctx.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: size, height: size),
                       cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil))
    ctx.clip()
  }
  ctx.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)
  drawBackground(ctx, 1024)
  ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 24, color: CGColor(colorSpace: space, components: [0, 0, 0, 0.22])!)
  ctx.draw(leaves(size: 1024, width: iconWidth, appearance: .light), in: full)
  return ctx
}
write(flatIcon(1024), "../icon.png")

// The web app's icons. Touch and PWA icons are square (the OS masks them);
// browser tab icons get their own rounded corners.
let web = "../../../web/public"
for (size, file) in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")] {
  write(flatIcon(size), "\(web)/\(file)")
}
for size in [16, 32, 48] {
  write(flatIcon(size, cornerRadius: CGFloat(size) * 0.225), "\(web)/favicon-\(size)x\(size).png")
}
