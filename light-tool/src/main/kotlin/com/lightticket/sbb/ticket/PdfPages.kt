package com.lightticket.sbb.ticket

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.InputStream

/**
 * Renders the pages of a ticket PDF with the Android platform renderer
 * (android.graphics.pdf.PdfRenderer, no third-party library). Not blocked by
 * the light-sdk build rules; whether LightOS runs it is unchecked (no device).
 */
object PdfPages {
    /** Tickets are one or two pages; more only costs memory. */
    const val MAX_PAGES = 3

    /** About 150 dpi for A4: enough to find the code and show the whole page. */
    const val RENDER_WIDTH = 1240

    /** Pages longer than this many pixels are rendered narrower (odd page formats). */
    const val MAX_HEIGHT = 3600

    /** Side of the QR view, rendered straight from the PDF at this size (screen width). */
    const val QR_SIZE = 1080

    /** Images larger than this edge are decoded downsampled (camera photos). */
    const val MAX_IMAGE_EDGE = 2400

    class Rendered(val pages: List<Bitmap>, val pageCount: Int, val qr: Bitmap?)

    fun render(file: File): Rendered {
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
            val renderer = PdfRenderer(fd)
            try {
                val count = renderer.pageCount
                var qr: Bitmap? = null
                val pages = (0 until minOf(count, MAX_PAGES)).map { i ->
                    val page = renderer.openPage(i)
                    try {
                        var width = RENDER_WIDTH
                        if (page.height.toFloat() * width / page.width > MAX_HEIGHT) {
                            width = (MAX_HEIGHT.toFloat() * page.width / page.height).toInt().coerceAtLeast(1)
                        }
                        val height = (page.height.toFloat() * width / page.width).toInt().coerceAtLeast(1)
                        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                        bmp.eraseColor(android.graphics.Color.WHITE) // PDFs are transparent by default
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        if (qr == null) {
                            find(bmp)?.let { c ->
                                // Render only the code region again, straight from the PDF at
                                // screen size: sharp module edges, nothing redrawn or decoded.
                                val toPt = page.width.toFloat() / width
                                val scale = QR_SIZE / (c.width * toPt)
                                val m = Matrix().apply {
                                    setScale(scale, scale)
                                    postTranslate(-c.left * toPt * scale, -c.top * toPt * scale)
                                }
                                val out = Bitmap.createBitmap(QR_SIZE, QR_SIZE, Bitmap.Config.ARGB_8888)
                                out.eraseColor(android.graphics.Color.WHITE)
                                page.render(out, null, m, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                                qr = out
                            }
                        }
                        bmp
                    } finally {
                        page.close()
                    }
                }
                return Rendered(pages, count, qr)
            } finally {
                renderer.close()
            }
        }
    }

    /**
     * Decodes an uploaded image, downsampled if very large. [open] is called
     * twice (size first, then pixels). Null if it is not a readable image.
     */
    fun decodeImage(open: ((InputStream) -> Unit) -> Unit): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        open { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > MAX_IMAGE_EDGE) sample *= 2
        var bmp: Bitmap? = null
        open { bmp = BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
        return bmp
    }

    /** For an image: cut the code out of the image's own pixels. */
    fun imageQr(image: Bitmap): Bitmap? =
        find(image)?.let { c -> Bitmap.createBitmap(image, c.left, c.top, c.width, c.height) }

    private fun find(bmp: Bitmap): Crop? {
        val px = IntArray(bmp.width * bmp.height)
        bmp.getPixels(px, 0, bmp.width, 0, 0, bmp.width, bmp.height)
        return QrCrop.find(px, bmp.width, bmp.height)
    }
}
