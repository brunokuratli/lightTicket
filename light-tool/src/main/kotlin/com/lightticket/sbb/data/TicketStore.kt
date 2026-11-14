package com.lightticket.sbb.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.InputStream

/**
 * On-device ticket wallet. Nothing leaves the phone.
 *
 * Barcode images are copied into the tool's private files dir; ticket metadata
 * is kept in a small JSON index file next to them. No database dependency.
 *
 * Takes the private files dir (from the light-sdk `lightContext.filesDir`)
 * instead of an Android Context: the SDK does not allow tools to touch
 * Context/contentResolver directly.
 */
class TicketStore(filesDir: File) {

    private val dir = File(filesDir, "tickets").apply { mkdirs() }
    private val index = File(dir, "index.json")

    /** add/delete read, change and rewrite index.json; never two at once. */
    private val lock = Mutex()

    suspend fun all(): List<Ticket> = withContext(Dispatchers.IO) { read() }

    private fun read(): List<Ticket> {
        if (!index.exists()) return emptyList()
        val arr = try { JSONArray(index.readText()) } catch (_: Exception) { return emptyList() }
        return (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            Ticket(
                id = o.optString("id"),
                title = o.optString("title"),
                fromDate = o.optString("fromDate"),
                toDate = o.optString("toDate"),
                note = o.optString("note"),
                imagePath = o.optString("imagePath"),
                created = o.optLong("created"),
            )
        }.sortedByDescending { it.created }
    }

    /**
     * Copy the image bytes from [image] into private storage and persist a ticket.
     * The caller owns (and closes) the stream.
     */
    suspend fun add(
        title: String,
        fromDate: String,
        toDate: String,
        note: String,
        image: InputStream,
    ): Ticket = withContext(Dispatchers.IO) { lock.withLock {
        val id = "t-" + System.currentTimeMillis()
        val imageFile = File(dir, "$id.img")
        try {
            imageFile.outputStream().use { output -> image.copyTo(output) }
        } catch (e: Exception) {
            imageFile.delete() // no half-written file without an index entry
            throw e
        }

        val ticket = Ticket(
            id = id,
            title = title.ifBlank { "Ticket" },
            fromDate = fromDate,
            toDate = toDate,
            note = note,
            imagePath = imageFile.absolutePath,
            created = System.currentTimeMillis(),
        )
        try {
            write(read().toMutableList().apply { add(0, ticket) })
        } catch (e: Exception) {
            imageFile.delete()
            throw e
        }
        ticket
    } }

    suspend fun delete(id: String) = withContext(Dispatchers.IO) { lock.withLock {
        val current = read()
        current.firstOrNull { it.id == id }?.let { runCatching { File(it.imagePath).delete() } }
        write(current.filterNot { it.id == id })
    } }

    private fun write(tickets: List<Ticket>) {
        val arr = JSONArray()
        tickets.forEach { t ->
            arr.put(JSONObject().apply {
                put("id", t.id)
                put("title", t.title)
                put("fromDate", t.fromDate)
                put("toDate", t.toDate)
                put("note", t.note)
                put("imagePath", t.imagePath)
                put("created", t.created)
            })
        }
        index.writeText(arr.toString())
    }
}
