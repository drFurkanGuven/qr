import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
  Result,
} from "@zxing/library";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

let barcodeDetector: BarcodeDetectorLike | null | undefined;
let zxingReader: QRCodeReader | null = null;
let zxingHints: Map<DecodeHintType, unknown> | null = null;

function getZxing(): { reader: QRCodeReader; hints: Map<DecodeHintType, unknown> } {
  if (!zxingReader) {
    zxingReader = new QRCodeReader();
  }
  if (!zxingHints) {
    zxingHints = new Map();
    zxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    zxingHints.set(DecodeHintType.TRY_HARDER, true);
  }
  return { reader: zxingReader, hints: zxingHints };
}

function getBarcodeDetector(): BarcodeDetectorLike | null {
  if (barcodeDetector !== undefined) return barcodeDetector;
  const Detector = (globalThis as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
  if (!Detector) {
    barcodeDetector = null;
    return null;
  }
  try {
    barcodeDetector = new Detector({ formats: ["qr_code"] });
  } catch {
    barcodeDetector = null;
  }
  return barcodeDetector;
}

function luminanceFromImageData(imageData: ImageData, invert: boolean, contrast: number): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const luminances = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (contrast !== 1) {
      g = (g - 128) * contrast + 128;
    }
    if (invert) g = 255 - g;
    luminances[p] = g < 0 ? 0 : g > 255 ? 255 : g;
  }
  return luminances;
}

function decodeZxing(imageData: ImageData, invert: boolean, contrast: number): string | null {
  try {
    const { reader, hints } = getZxing();
    const luminances = luminanceFromImageData(imageData, invert, contrast);
    const source = new RGBLuminanceSource(luminances, imageData.width, imageData.height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const result: Result = reader.decode(bitmap, hints);
    const text = result?.getText()?.trim();
    return text || null;
  } catch {
    return null;
  }
}

async function decodeNative(source: ImageBitmapSource): Promise<string | null> {
  const detector = getBarcodeDetector();
  if (!detector) return null;
  try {
    const codes = await detector.detect(source);
    const text = codes.find((c) => c.rawValue)?.rawValue?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function decodeQrFromImageData(
  imageData: ImageData,
  options?: { thorough?: boolean }
): Promise<string | null> {
  const thorough = options?.thorough ?? false;
  const passes: Array<[boolean, number]> = thorough
    ? [
        [false, 1],
        [false, 1.8],
        [true, 1],
        [true, 1.8],
        [false, 2.4],
        [true, 2.4],
      ]
    : [
        [false, 1],
        [true, 1],
      ];

  for (const [invert, contrast] of passes) {
    const text = decodeZxing(imageData, invert, contrast);
    if (text) return text;
  }
  return null;
}

export async function decodeQrFromCanvas(
  canvas: HTMLCanvasElement,
  options?: { thorough?: boolean }
): Promise<string | null> {
  const native = await decodeNative(canvas);
  if (native) return native;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeQrFromImageData(imageData, options);
}

function drawImageToCanvas(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  maxEdge: number
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function cropImageToCanvas(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  maxEdge: number
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  return canvas;
}

export async function decodeQrFromVideo(
  video: HTMLVideoElement,
  thorough = false
): Promise<string | null> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const native = await decodeNative(video);
  if (native) return native;

  const maxEdge = thorough ? 2200 : 1400;
  const canvas = drawImageToCanvas(video, vw, vh, maxEdge);
  const result = await decodeQrFromCanvas(canvas, { thorough });
  if (result) return result;

  if (thorough && vw > 400 && vh > 400) {
    const cropW = Math.round(vw * 0.65);
    const cropH = Math.round(vh * 0.65);
    const cropX = Math.round((vw - cropW) / 2);
    const cropY = Math.round((vh - cropH) / 2);
    const croppedCanvas = cropImageToCanvas(video, cropX, cropY, cropW, cropH, 2000);
    const cropResult = await decodeQrFromCanvas(croppedCanvas, { thorough: true });
    if (cropResult) return cropResult;
  }

  return null;
}

export async function decodeQrFromBlob(blob: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(blob);
  try {
    const native = await decodeNative(bitmap);
    if (native) return native;

    const canvas = drawImageToCanvas(bitmap, bitmap.width, bitmap.height, 2600);
    const result = await decodeQrFromCanvas(canvas, { thorough: true });
    if (result) return result;

    if (bitmap.width > 600 && bitmap.height > 600) {
      const cropW = Math.round(bitmap.width * 0.65);
      const cropH = Math.round(bitmap.height * 0.65);
      const cropX = Math.round((bitmap.width - cropW) / 2);
      const cropY = Math.round((bitmap.height - cropH) / 2);
      const croppedCanvas = cropImageToCanvas(bitmap, cropX, cropY, cropW, cropH, 2400);
      const cropResult = await decodeQrFromCanvas(croppedCanvas, { thorough: true });
      if (cropResult) return cropResult;
    }

    return null;
  } finally {
    bitmap.close();
  }
}
