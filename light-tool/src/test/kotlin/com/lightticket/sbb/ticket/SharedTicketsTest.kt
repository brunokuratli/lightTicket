package com.lightticket.sbb.ticket

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SharedTicketsTest {
    @Test
    fun kindByName() {
        assertEquals(FileKind.PDF, SharedTickets.kindOf("Billett.PDF"))
        assertEquals(FileKind.IMAGE, SharedTickets.kindOf("qr.jpeg"))
        assertEquals(FileKind.IMAGE, SharedTickets.kindOf("qr.png"))
        assertNull(SharedTickets.kindOf("notiz.txt"))
        assertNull(SharedTickets.kindOf(".Billett.pdf.123.tmp"))
        assertNull(SharedTickets.kindOf(".versteckt.pdf"))
    }

    @Test
    fun onlyTicketFilesNewestFirst() {
        val list = SharedTickets.from(
            listOf(
                Triple("alt.pdf", true, 1L),
                Triple("ordner.pdf", false, 9L),
                Triple("neu.png", true, 5L),
                Triple("liesmich.txt", true, 7L),
            ),
        )
        assertEquals(listOf("neu.png", "alt.pdf"), list.map { it.name })
    }

    @Test
    fun titleFromName() {
        assertEquals("Billett Zuerich Bern", SharedTicket("Billett_Zuerich_Bern.pdf", FileKind.PDF, 0).title)
        assertEquals("ohne-endung", SharedTicket("ohne-endung", FileKind.PDF, 0).title)
    }
}
