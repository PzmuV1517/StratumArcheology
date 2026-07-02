/**
 * @file
 * QR code generation utilities.
 *
 * Provides functions for generating QR code images from
 * resource identifiers.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
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
