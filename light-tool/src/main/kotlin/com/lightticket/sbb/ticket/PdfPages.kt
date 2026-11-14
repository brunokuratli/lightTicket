package com.lightticket.sbb.ticket

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File

/**
 * Renders the pages of a ticket PDF with the Android platform renderer
 * (android.graphics.pdf.PdfRenderer, no third-party library). Not blocked by
 * the light-sdk build rules; whether LightOS runs it is unchecked (no device).
 */
object PdfPages {
    /** Tickets are one or two pages; more only costs memory. */
    const val MAX_PAGES = 3

    /** About 150 dpi for A4: enough pixels for a sharp QR crop. */
    const val RENDER_WIDTH = 1240

    class Rendered(val pages: List<Bitmap>, val pageCount: Int)

    fun render(file: File, width: Int = RENDER_WIDTH): Rendered {
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
            val renderer = PdfRenderer(fd)
            try {
                val count = renderer.pageCount
                val pages = (0 until minOf(count, MAX_PAGES)).map { i ->
                    val page = renderer.openPage(i)
                    try {
                        val height = (page.height.toFloat() * width / page.width).toInt().coerceAtLeast(1)
                        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                        bmp.eraseColor(android.graphics.Color.WHITE) // PDFs are transparent by default
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        bmp
                    } finally {
                        page.close()
                    }
                }
                return Rendered(pages, count)
            } finally {
                renderer.close()
            }
        }
    }

    /** Looks for a QR/Aztec code on the pages and cuts it out in original pixels. */
    fun qrCrop(pages: List<Bitmap>): Bitmap? {
        for (page in pages) {
            val px = IntArray(page.width * page.height)
            page.getPixels(px, 0, page.width, 0, 0, page.width, page.height)
            val c = QrCrop.find(px, page.width, page.height) ?: continue
            return Bitmap.createBitmap(page, c.left, c.top, c.width, c.height)
        }
        return null
    }
}
