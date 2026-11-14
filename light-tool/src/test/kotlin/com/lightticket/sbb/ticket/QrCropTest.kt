package com.lightticket.sbb.ticket

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * A self-made sample page ("MUSTER", no real ticket): white A4 page at the
 * render width of the tool, a QR code placed off-centre, plus some grey
 * "text" bars. The crop must contain the whole code and little else.
 */
class QrCropTest {
    private val white = 0xFFFFFFFF.toInt()
    private val black = 0xFF000000.toInt()
    private val grey = 0xFF888888.toInt()

    private fun samplePage(qrLeft: Int, qrTop: Int, qrSize: Int, w: Int = 1240, h: Int = 1754): IntArray {
        val px = IntArray(w * h) { white }
        // text-like bars
        for (row in 0 until 12) for (y in 0 until 10) for (x in 100 until 1100) {
            if ((x / 37) % 5 != 4) px[(150 + row * 40 + y) * w + x] = grey
        }
        val m = QRCodeWriter().encode(
            "MUSTER-BILLETT SBB-LIGHT-TEST 0000-0000-0000",
            BarcodeFormat.QR_CODE, qrSize, qrSize, mapOf(EncodeHintType.MARGIN to 0),
        )
        for (y in 0 until m.height) for (x in 0 until m.width) {
            if (m[x, y]) px[(qrTop + y) * w + qrLeft + x] = black
        }
        return px
    }

    @Test
    fun findsQrAndCropsAroundItInOriginalPixels() {
        val left = 700; val top = 900; val size = 360
        val crop = assertNotNull(QrCrop.find(samplePage(left, top, size), 1240, 1754))
        // whole code inside the crop
        assertTrue(crop.left <= left && crop.top <= top, "crop starts after code: $crop")
        assertTrue(crop.left + crop.width >= left + size && crop.top + crop.height >= top + size, "code cut off: $crop")
        // but much smaller than the page (not just the whole page)
        assertTrue(crop.width < size * 2, "crop too large: $crop")
        assertEquals(crop.width, crop.height)
        // inside the page
        assertTrue(crop.left >= 0 && crop.top >= 0 && crop.left + crop.width <= 1240 && crop.top + crop.height <= 1754)
    }

    @Test
    fun codeAtThePageEdgeStaysInsideThePage() {
        val crop = assertNotNull(QrCrop.find(samplePage(1240 - 300, 0, 300), 1240, 1754))
        assertTrue(crop.left >= 0 && crop.top >= 0 && crop.left + crop.width <= 1240 && crop.top + crop.height <= 1754, "$crop")
        assertTrue(crop.left + crop.width >= 1240 - 1 && crop.top == 0, "$crop")
    }

    @Test
    fun pageWithoutCodeGivesNull() {
        val w = 600; val h = 800
        val px = IntArray(w * h) { white }
        for (y in 100 until 110) for (x in 50 until 550) px[y * w + x] = grey
        assertNull(QrCrop.find(px, w, h))
    }
}
