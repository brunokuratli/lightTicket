package com.lightticket.sbb

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.lightticket.sbb.data.Connection
import com.lightticket.sbb.data.Departure
import com.lightticket.sbb.data.Ticket
import com.lightticket.sbb.data.TicketStore
import com.lightticket.sbb.data.TransportApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
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
 * Holds all UI state for the tool. Kept as one ViewModel (three tabs) to match
 * the light-sdk scaffold, which drives a single HomeScreen.
 */
class HomeScreenViewModel(app: Application) : AndroidViewModel(app) {

    private val store = TicketStore(app)

    private val _tab = MutableStateFlow(Tab.FAHRPLAN)
    val tab: StateFlow<Tab> = _tab.asStateFlow()

    private val _connections = MutableStateFlow<Load<List<Connection>>>(Load.Idle)
    val connections: StateFlow<Load<List<Connection>>> = _connections.asStateFlow()

    private val _board = MutableStateFlow<Load<Pair<String, List<Departure>>>>(Load.Idle)
    val board: StateFlow<Load<Pair<String, List<Departure>>>> = _board.asStateFlow()

    private val _tickets = MutableStateFlow<List<Ticket>>(emptyList())
    val tickets: StateFlow<List<Ticket>> = _tickets.asStateFlow()

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

    fun addTicket(title: String, fromDate: String, toDate: String, note: String, image: Uri) {
        viewModelScope.launch {
            store.add(getApplication(), title, fromDate, toDate, note, image)
            refreshTickets()
        }
    }

    fun deleteTicket(id: String) {
        viewModelScope.launch {
            store.delete(id)
            refreshTickets()
        }
    }

    private fun refreshTickets() {
        viewModelScope.launch { _tickets.value = store.all() }
    }
}
