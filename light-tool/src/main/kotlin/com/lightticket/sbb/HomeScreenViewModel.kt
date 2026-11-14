package com.lightticket.sbb

import androidx.lifecycle.viewModelScope
import com.lightticket.sbb.data.Connection
import com.lightticket.sbb.data.Departure
import com.lightticket.sbb.data.Ticket
import com.lightticket.sbb.data.TicketStore
import com.lightticket.sbb.data.TransportApi
import com.thelightphone.sdk.LightMedia
import com.thelightphone.sdk.LightViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class Tab { FAHRPLAN, ABFAHRTEN, TICKETS }

/** Async result wrapper for the two timetable screens. */
sealed interface Load<out T> {
    data object Idle : Load<Nothing>
    data object Loading : Load<Nothing>
    data class Ok<T>(val value: T) : Load<T>
    data class Err(val message: String) : Load<Nothing>
}

/**
 * Holds all UI state for the tool (three tabs). A light-sdk [LightViewModel];
 * it gets the private files dir and the media access from the screen's
 * `lightContext` instead of an Android Context (not allowed in tools).
 */
class HomeScreenViewModel(
    filesDir: File,
    private val media: LightMedia,
) : LightViewModel<Unit>() {

    private val store = TicketStore(filesDir)

    private val _tab = MutableStateFlow(Tab.FAHRPLAN)
    val tab: StateFlow<Tab> = _tab.asStateFlow()

    private val _connections = MutableStateFlow<Load<List<Connection>>>(Load.Idle)
    val connections: StateFlow<Load<List<Connection>>> = _connections.asStateFlow()

    private val _board = MutableStateFlow<Load<Pair<String, List<Departure>>>>(Load.Idle)
    val board: StateFlow<Load<Pair<String, List<Departure>>>> = _board.asStateFlow()

    private val _tickets = MutableStateFlow<List<Ticket>>(emptyList())
    val tickets: StateFlow<List<Ticket>> = _tickets.asStateFlow()

    /** Images from the device album (null = not loaded yet). */
    private val _images = MutableStateFlow<List<LightMedia.Item.Image>?>(null)
    val images: StateFlow<List<LightMedia.Item.Image>?> = _images.asStateFlow()

    /** Last ticket error, shown on the Tickets tab until dismissed. */
    private val _ticketError = MutableStateFlow<String?>(null)
    val ticketError: StateFlow<String?> = _ticketError.asStateFlow()
    fun clearTicketError() { _ticketError.value = null }

    init { refreshTickets() }

    fun selectTab(t: Tab) { _tab.value = t }

    fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())
    fun now(): String = SimpleDateFormat("HH:mm", Locale.ROOT).format(Date())

    fun searchConnections(from: String, to: String, date: String, time: String, isArrival: Boolean) {
        if (from.isBlank() || to.isBlank()) return
        _connections.value = Load.Loading
        viewModelScope.launch {
            _connections.value = try {
                Load.Ok(TransportApi.connections(from, to, date, time, isArrival))
            } catch (e: Exception) {
                Load.Err(e.message ?: "Fehler")
            }
        }
    }

    fun loadBoard(station: String) {
        if (station.isBlank()) return
        _board.value = Load.Loading
        viewModelScope.launch {
            _board.value = try {
                Load.Ok(TransportApi.stationboard(station))
            } catch (e: Exception) {
                Load.Err(e.message ?: "Fehler")
            }
        }
    }

    /** Lists album images. Needs READ_MEDIA_IMAGES (checked by the UI first). */
    fun loadImages() {
        viewModelScope.launch {
            _images.value = try {
                withContext(Dispatchers.IO) { media.loadImages().items }
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    suspend fun decodeImage(item: LightMedia.Item.Image) = media.decodeImage(item)

    fun addTicket(title: String, fromDate: String, toDate: String, note: String, image: LightMedia.Item.Image) {
        viewModelScope.launch {
            _ticketError.value = try {
                val saved = media.readItem(image) { input -> store.add(title, fromDate, toDate, note, input) }
                if (saved == null) "Das Bild ist nicht mehr lesbar. Ticket nicht gespeichert." else null
            } catch (e: Exception) {
                // e.g. storage full, or the image permission was revoked meanwhile
                "Ticket nicht gespeichert (${e.message ?: "unbekannter Fehler"})."
            }
            refreshTickets()
        }
    }

    fun deleteTicket(id: String) {
        viewModelScope.launch {
            try { store.delete(id) } catch (e: Exception) { _ticketError.value = "Löschen fehlgeschlagen (${e.message ?: "unbekannter Fehler"})." }
            refreshTickets()
        }
    }

    private fun refreshTickets() {
        viewModelScope.launch { _tickets.value = store.all() }
    }
}
