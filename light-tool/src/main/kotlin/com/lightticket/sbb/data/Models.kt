package com.lightticket.sbb.data

/** A single train/bus leg of a connection, e.g. "IC1". */
data class Leg(val label: String)

/** A connection from A to B (result of a timetable search). */
data class Connection(
    val departure: String,   // "HH:mm"
    val arrival: String,     // "HH:mm"
    val depDelay: Int,       // minutes, 0 if none
    val platform: String,    // departure platform, may be empty
    val destination: String, // final station name
    val durationMin: Int,    // total minutes
    val transfers: Int,
    val legs: List<Leg>,
)

/** A departure row on a station board. */
data class Departure(
    val time: String,        // "HH:mm"
    val delay: Int,          // minutes, 0 if none
    val line: String,        // e.g. "IC8"
    val destination: String,
    val platform: String,
)

/** A locally stored ticket. The barcode itself lives as an image file. */
data class Ticket(
    val id: String,
    val title: String,
    val fromDate: String,    // "yyyy-MM-dd" or empty
    val toDate: String,
    val note: String,
    val imagePath: String,   // absolute path to the barcode image in filesDir
    val created: Long,
)
