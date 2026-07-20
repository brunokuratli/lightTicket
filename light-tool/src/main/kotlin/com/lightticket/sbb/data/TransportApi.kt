package com.lightticket.sbb.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Client for the free Swiss public-transport API at transport.opendata.ch.
 * No API key required. Kept dependency-free (HttpURLConnection + org.json) to
 * respect the SDK's restrictions on third-party libraries.
 */
object TransportApi {

    private const val BASE = "https://transport.opendata.ch/v1"

    // The API returns ISO timestamps like "2026-07-20T14:32:00+0200".
    private val isoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.ROOT)
    private val hhmm = SimpleDateFormat("HH:mm", Locale.ROOT).apply {
        timeZone = TimeZone.getTimeZone("Europe/Zurich")
    }

    private fun fmtTime(iso: String?): String {
        if (iso.isNullOrBlank()) return "--:--"
        return try { hhmm.format(isoParser.parse(iso)!!) } catch (_: Exception) { "--:--" }
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private suspend fun getJson(url: String): JSONObject = withContext(Dispatchers.IO) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 10_000
            setRequestProperty("Accept", "application/json")
        }
        try {
            if (conn.responseCode !in 200..299) error("HTTP ${conn.responseCode}")
            JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        } finally {
            conn.disconnect()
        }
    }

    /** Station-name suggestions for autocomplete. */
    suspend fun locations(query: String): List<String> {
        if (query.length < 2) return emptyList()
        val json = getJson("$BASE/locations?type=station&query=${enc(query)}")
        val arr = json.optJSONArray("stations") ?: return emptyList()
        return (0 until arr.length())
            .mapNotNull { arr.optJSONObject(it)?.optString("name") }
            .filter { it.isNotBlank() }
            .distinct()
            .take(7)
    }

    /** Connection search from → to. `isArrival` treats time as arrival time. */
    suspend fun connections(
        from: String,
        to: String,
        date: String,
        time: String,
        isArrival: Boolean,
    ): List<Connection> {
        val url = buildString {
            append("$BASE/connections?from=${enc(from)}&to=${enc(to)}&limit=6")
            if (date.isNotBlank()) append("&date=${enc(date)}")
            if (time.isNotBlank()) append("&time=${enc(time)}")
            append("&isArrivalTime=${if (isArrival) 1 else 0}")
        }
        val arr = getJson(url).optJSONArray("connections") ?: return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val c = arr.optJSONObject(i) ?: return@mapNotNull null
            val f = c.optJSONObject("from")
            val t = c.optJSONObject("to")
            val legs = c.optJSONArray("sections")?.let { secs ->
                (0 until secs.length()).mapNotNull { j ->
                    val jr = secs.optJSONObject(j)?.optJSONObject("journey") ?: return@mapNotNull null
                    val label = (jr.optString("category") + jr.optString("number")).trim()
                    if (label.isBlank()) null else Leg(label)
                }
            } ?: emptyList()
            Connection(
                departure = fmtTime(f?.optString("departure")),
                arrival = fmtTime(t?.optString("arrival")),
                depDelay = f?.optInt("delay", 0) ?: 0,
                platform = f?.optString("platform").orEmpty(),
                destination = t?.optJSONObject("station")?.optString("name").orEmpty(),
                durationMin = parseDuration(c.optString("duration")),
                transfers = c.optInt("transfers", 0),
                legs = if (legs.isEmpty()) listOf(Leg("Fussweg")) else legs,
            )
        }
    }

    /** Live departure board for a station. */
    suspend fun stationboard(station: String): Pair<String, List<Departure>> {
        val json = getJson("$BASE/stationboard?station=${enc(station)}&limit=14")
        val name = json.optJSONObject("station")?.optString("name").orEmpty()
        val arr = json.optJSONArray("stationboard") ?: return name to emptyList()
        val list = (0 until arr.length()).mapNotNull { i ->
            val s = arr.optJSONObject(i) ?: return@mapNotNull null
            val stop = s.optJSONObject("stop")
            Departure(
                time = fmtTime(stop?.optString("departure")),
                delay = stop?.optInt("delay", 0) ?: 0,
                line = (s.optString("category") + s.optString("number")).trim()
                    .ifBlank { s.optString("name") },
                destination = s.optString("to"),
                platform = stop?.optString("platform").orEmpty(),
            )
        }
        return name to list
    }

    /** Parse the API duration format "00d02:15:00" into total minutes. */
    private fun parseDuration(dur: String?): Int {
        val m = Regex("""(\d+)d(\d+):(\d+):""").find(dur ?: "") ?: return 0
        val (d, h, min) = m.destructured
        return d.toInt() * 24 * 60 + h.toInt() * 60 + min.toInt()
    }
}
