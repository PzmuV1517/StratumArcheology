import QRCode from "qrcode";

/**
 * Generates a Base64 Data URL for a QR code.
 * This is an async function because QR generation is non-blocking.
 */
export async function generateQRCode(data: string): Promise<string> {
  try {
    const url = await QRCode.toDataURL(data, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
      color: {
        dark: "#FF2A2A",
        light: "#FFFFFF",
      },
    });
    return url;
  } catch (err) {
    console.error("QR Generation Error:", err);
    throw err;
  }
}
