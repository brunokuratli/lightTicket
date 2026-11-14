package com.lightticket.sbb.ticket

import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.ResultPoint
import com.google.zxing.common.HybridBinarizer
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** A rectangle in the pixels of the rendered page. */
data class Crop(val left: Int, val top: Int, val width: Int, val height: Int)

/**
 * Finds the QR (or Aztec) code on a rendered ticket page and returns the
 * rectangle around it, so the viewer can show exactly those original pixels
 * large. The code is never decoded into content or redrawn: the scanner at a
 * control reads the pixels of the original ticket.
 *
 * Pure JVM (zxing core, allowed by the light-sdk), so it runs in unit tests.
 */
object QrCrop {
    private val hints = mapOf(
        DecodeHintType.TRY_HARDER to true,
        DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE, BarcodeFormat.AZTEC),
    )

    /** [argb] is the page in ARGB, row by row ([width] × [height]). */
    fun find(argb: IntArray, width: Int, height: Int): Crop? {
        val bitmap = BinaryBitmap(HybridBinarizer(RGBLuminanceSource(width, height, argb)))
        val result = try {
            MultiFormatReader().decode(bitmap, hints)
        } catch (_: Exception) {
            return null // NotFound / Checksum / Format: no readable code on this page
        }
        val points = result.resultPoints?.filterNotNull().orEmpty()
        if (points.size < 3) return null
        return around(points, result.barcodeFormat, width, height)
    }

    /**
     * Square around the points zxing reports. For QR these are the centres of
     * the finder patterns, 3.5 modules inside the edge, so the box is widened
     * generously; a little extra white around a code never hurts scanning,
     * a cut-off edge does.
     */
    fun around(points: List<ResultPoint>, format: BarcodeFormat, width: Int, height: Int): Crop {
        val minX = points.minOf { it.x }; val maxX = points.maxOf { it.x }
        val minY = points.minOf { it.y }; val maxY = points.maxOf { it.y }
        val size = max(maxX - minX, maxY - minY)
        val margin = size * if (format == BarcodeFormat.QR_CODE) 0.35f else 0.2f
        val side = size + 2 * margin
        val cx = (minX + maxX) / 2
        val cy = (minY + maxY) / 2
        var left = (cx - side / 2).roundToInt()
        var top = (cy - side / 2).roundToInt()
        var s = side.roundToInt()
        s = min(s, min(width, height))
        left = left.coerceIn(0, width - s)
        top = top.coerceIn(0, height - s)
        return Crop(left, top, s, s)
    }
}
