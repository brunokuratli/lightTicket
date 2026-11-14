package com.lightticket.sbb

import com.thelightphone.sdk.EntryPoint
import com.thelightphone.sdk.LightEntryPoint
import com.thelightphone.toolmanager.ClientLeafNode
import com.thelightphone.toolmanager.ClientToolManifest
import com.thelightphone.toolmanager.FileBrowserSpec
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Makes SBB Light «Tool Manager capable» (light-sdk docs/tool_manager): on a
 * computer in the same network the user opens the Tool Manager in the browser,
 * picks «SBB Light» → «Billette» and uploads the ticket PDF (or an image of
 * the QR code). It lands in the tool's files/shared/billette and never leaves
 * the phone again. This replaces the file picker, which the SDK does not allow.
 */
@EntryPoint
object ToolEntryPoint : LightEntryPoint {
    const val TICKET_DIR = "billette"

    private val _updates = MutableStateFlow(0L)
    /** Changes whenever files were uploaded or deleted through the Tool Manager. */
    val updates: StateFlow<Long> = _updates.asStateFlow()

    override fun getToolManagerManifest(): ClientToolManifest = ClientToolManifest(
        title = "SBB Light",
        roots = listOf(
            ClientLeafNode(
                FileBrowserSpec(
                    label = "Billette",
                    path = TICKET_DIR,
                    headerText = "Billett als PDF (Original aus der App oder Mail) oder Bild des QR-Codes " +
                        "hochladen. Die Datei bleibt nur auf dem Telefon.",
                ),
            ),
        ),
    )

    override suspend fun onToolManagerDataUpdate() {
        super.onToolManagerDataUpdate()
        _updates.value = System.currentTimeMillis()
    }
}
