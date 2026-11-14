package com.lightticket.sbb

import android.Manifest
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lightticket.sbb.data.Connection
import com.lightticket.sbb.data.Departure
import com.lightticket.sbb.data.Ticket
import com.lightticket.sbb.ui.SbbLightTheme
import com.thelightphone.sdk.InitialScreen
import com.thelightphone.sdk.LightMedia
import com.thelightphone.sdk.LightScreen
import com.thelightphone.sdk.SealedLightActivity
import com.thelightphone.sdk.checkPermission
import com.thelightphone.sdk.rememberPermissionRequestLauncher
import com.thelightphone.sdk.shared.LightServiceMethod
import com.thelightphone.sdk.shared.asKotlinResult
import kotlinx.coroutines.launch

/**
 * Boot screen of the tool. The light-sdk finds it via @InitialScreen (KSP) and
 * renders [Content]. Three tabs — Fahrplan, Abfahrten, Tickets — plus a
 * fullscreen ticket viewer for showing a barcode.
 */
@InitialScreen
class HomeScreen(sealedActivity: SealedLightActivity) :
    LightScreen<Unit, HomeScreenViewModel>(sealedActivity) {

    override val viewModelClass: Class<HomeScreenViewModel>
        get() = HomeScreenViewModel::class.java

    override fun createViewModel(): HomeScreenViewModel =
        HomeScreenViewModel(lightContext.filesDir, lightContext.media)

    @Composable
    override fun Content() {
        SbbLightApp(viewModel)
    }
}

@Composable
private fun SbbLightApp(vm: HomeScreenViewModel) {
    SbbLightTheme {
        val tab by vm.tab.collectAsState()
        var viewing by remember { mutableStateOf<Ticket?>(null) }

        Surface(color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize()) {
                Text(
                    "SBB Light",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(16.dp),
                )
                TabRow(tab, vm::selectTab)
                Box(Modifier.weight(1f)) {
                    when (tab) {
                        Tab.FAHRPLAN -> FahrplanScreen(vm)
                        Tab.ABFAHRTEN -> AbfahrtenScreen(vm)
                        Tab.TICKETS -> TicketsScreen(vm, onShow = { viewing = it })
                    }
                }
            }
        }

        viewing?.let { TicketViewer(it) { viewing = null } }
    }
}

@Composable
private fun TabRow(selected: Tab, onSelect: (Tab) -> Unit) {
    val labels = listOf(Tab.FAHRPLAN to "Fahrplan", Tab.ABFAHRTEN to "Abfahrten", Tab.TICKETS to "Tickets")
    Row(Modifier.fillMaxWidth().height(48.dp)) {
        labels.forEach { (t, label) ->
            val active = t == selected
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.background)
                    .border(1.dp, MaterialTheme.colorScheme.outline)
                    .clickableTab { onSelect(t) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = if (active) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onBackground,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                )
            }
        }
    }
}

/* ------------------------- Fahrplan ------------------------- */
@Composable
private fun FahrplanScreen(vm: HomeScreenViewModel) {
    var from by remember { mutableStateOf("") }
    var to by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(vm.today()) }
    var time by remember { mutableStateOf(vm.now()) }
    var isArrival by remember { mutableStateOf(false) }
    val result by vm.connections.collectAsState()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Field("Von", from) { from = it }
        Field("Nach", to) { to = it }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.weight(1f)) { Field("Datum", date) { date = it } }
            Box(Modifier.weight(1f)) { Field("Zeit", time) { time = it } }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(if (isArrival) "Ankunft" else "Abfahrt", Modifier.weight(1f))
            Switch(checked = isArrival, onCheckedChange = { isArrival = it })
        }
        PrimaryButton("Verbindungen suchen") {
            vm.searchConnections(from.trim(), to.trim(), date.trim(), time.trim(), isArrival)
        }
        LoadContent(result, empty = "Keine Verbindungen gefunden.") { list ->
            list.forEach { ConnectionCard(it) }
        }
    }
}

@Composable
private fun ConnectionCard(c: Connection) {
    Card {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                buildString {
                    append(c.departure)
                    if (c.depDelay > 0) append(" +${c.depDelay}")
                    append(" → ${c.arrival}")
                },
                fontSize = 22.sp, fontWeight = FontWeight.Bold,
            )
            Column(horizontalAlignment = Alignment.End) {
                Text(formatDur(c.durationMin), style = muted())
                Text("${c.transfers} Umst.", style = muted())
            }
        }
        if (c.platform.isNotBlank() || c.destination.isNotBlank()) {
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(if (c.platform.isNotBlank()) "Gleis ${c.platform}" else "", style = muted())
                Text(if (c.destination.isNotBlank()) "→ ${c.destination}" else "", style = muted())
            }
        }
        FlowChips(c.legs.map { it.label })
    }
}

/* ------------------------- Abfahrten ------------------------- */
@Composable
private fun AbfahrtenScreen(vm: HomeScreenViewModel) {
    var station by remember { mutableStateOf("") }
    val result by vm.board.collectAsState()

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Field("Haltestelle", station) { station = it }
        PrimaryButton("Abfahrten anzeigen") { vm.loadBoard(station.trim()) }
        LoadContent(result, empty = "Keine Abfahrten gefunden.") { (name, list) ->
            if (name.isNotBlank()) Text(name, style = muted())
            LazyColumn(Modifier.fillMaxWidth()) {
                items(list) { DepartureRow(it) }
            }
        }
    }
}

@Composable
private fun DepartureRow(d: Departure) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            buildString { append(d.time); if (d.delay > 0) append(" +${d.delay}") },
            fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(84.dp),
        )
        Chip(d.line)
        Text(d.destination, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (d.platform.isNotBlank()) Text("Gl. ${d.platform}", style = muted())
    }
    HorizontalDivider()
}

/* ------------------------- Tickets ------------------------- */
@Composable
private fun TicketsScreen(vm: HomeScreenViewModel, onShow: (Ticket) -> Unit) {
    val tickets by vm.tickets.collectAsState()
    var showAdd by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Tickets bleiben nur auf diesem Gerät. Füge den Barcode deines gekauften " +
                "SBB-Tickets als Bild hinzu und zeige ihn dem Kontrollpersonal.",
            style = muted(),
        )
        PrimaryButton("Ticket hinzufügen") { showAdd = true }
        if (tickets.isEmpty()) {
            Text("Noch keine Tickets gespeichert.", style = muted())
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(tickets) { TicketCard(it, onShow) { vm.deleteTicket(it.id) } }
            }
        }
    }

    if (showAdd) {
        AddTicketDialog(
            vm = vm,
            onDismiss = { showAdd = false },
            onSave = { title, from, to, note, image ->
                vm.addTicket(title, from, to, note, image)
                showAdd = false
            },
        )
    }
}

@Composable
private fun TicketCard(t: Ticket, onShow: (Ticket) -> Unit, onDelete: () -> Unit) {
    Card {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            BarcodeThumb(t.imagePath, size = 64)
            Column(Modifier.weight(1f)) {
                Text(t.title, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                val dates = listOf(t.fromDate, t.toDate).filter { it.isNotBlank() }.joinToString(" – ")
                if (dates.isNotBlank()) Text(dates, style = muted())
                if (t.note.isNotBlank()) Text(t.note, style = muted(), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PrimaryButton("Zeigen", small = true) { onShow(t) }
                OutlinedButton(onClick = onDelete) { Text("Löschen") }
            }
        }
    }
}

@Composable
private fun AddTicketDialog(
    vm: HomeScreenViewModel,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, LightMedia.Item.Image) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var fromDate by remember { mutableStateOf("") }
    var toDate by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var picked by remember { mutableStateOf<LightMedia.Item.Image?>(null) }
    var choosing by remember { mutableStateOf(false) }
    var hint by remember { mutableStateOf<String?>(null) }
    val images by vm.images.collectAsState()

    // Bild-Auswahl über lightContext.media (READ_MEDIA_IMAGES). Der Android
    // Photo Picker (androidx.activity) ist im light-sdk gesperrt.
    val permissionLauncher = rememberPermissionRequestLauncher(Manifest.permission.READ_MEDIA_IMAGES)
    val scope = rememberCoroutineScope()

    var pickedBitmap by remember { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(picked) {
        pickedBitmap = picked?.let { runCatching { vm.decodeImage(it) }.getOrNull() }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            Button(
                enabled = picked != null && title.isNotBlank(),
                onClick = { picked?.let { onSave(title.trim(), fromDate.trim(), toDate.trim(), note.trim(), it) } },
            ) { Text("Speichern") }
        },
        dismissButton = { OutlinedButton(onClick = onDismiss) { Text("Abbrechen") } },
        title = { Text("Ticket hinzufügen") },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Field("Titel", title) { title = it }
                Field("Gültig ab (JJJJ-MM-TT)", fromDate) { fromDate = it }
                Field("Gültig bis (JJJJ-MM-TT)", toDate) { toDate = it }
                Field("Notiz", note) { note = it }
                OutlinedButton(onClick = {
                    scope.launch {
                        val granted = checkPermission(Manifest.permission.READ_MEDIA_IMAGES).asKotlinResult
                            .map { it.permissionResult == LightServiceMethod.GetPermission.Result.Granted }
                            .getOrDefault(false)
                        if (granted) {
                            hint = null
                            choosing = true
                            vm.loadImages()
                        } else {
                            hint = "Zugriff auf Bilder erlauben, dann erneut tippen."
                            permissionLauncher?.launch()
                        }
                    }
                }) { Text(if (picked == null) "Barcode-Bild wählen" else "Bild gewählt ✓") }
                hint?.let { Text(it, style = muted()) }
                if (choosing) {
                    when (val list = images) {
                        null -> Text("Laden…", style = muted())
                        else -> if (list.isEmpty()) {
                            Text("Keine Bilder gefunden.", style = muted())
                        } else {
                            list.take(30).forEach { img ->
                                Text(
                                    img.name,
                                    Modifier
                                        .fillMaxWidth()
                                        .clickable { picked = img; choosing = false }
                                        .padding(vertical = 8.dp),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }
                }
                if (picked != null) BarcodeThumb(bitmap = pickedBitmap, size = 120)
            }
        },
    )
}

/* ------------------------- Fullscreen viewer ------------------------- */
@Composable
private fun TicketViewer(t: Ticket, onClose: () -> Unit) {
    // TODO(Etappe 2): Bildschirm wach halten und Helligkeit maximal, solange
    // ein Barcode gezeigt wird. Der bisherige Weg über das Activity-Fenster
    // (FLAG_KEEP_SCREEN_ON) ist im light-sdk gesperrt (kein Zugriff auf
    // Activity/Context); eine SDK-Schnittstelle dafür ist nicht belegt.
    // Always light for scannability, regardless of system theme.
    Surface(color = androidx.compose.ui.graphics.Color.White) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                OutlinedButton(onClick = onClose) { Text("Schliessen", color = androidx.compose.ui.graphics.Color.Black) }
            }
            Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(t.title, color = androidx.compose.ui.graphics.Color.Black, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))
                BarcodeThumb(t.imagePath, size = 300)
                Spacer(Modifier.height(12.dp))
                val meta = listOf(
                    listOf(t.fromDate, t.toDate).filter { it.isNotBlank() }.joinToString(" – "),
                    t.note,
                ).filter { it.isNotBlank() }.joinToString(" · ")
                if (meta.isNotBlank()) Text(meta, color = androidx.compose.ui.graphics.Color(0xFF333333))
            }
        }
    }
}

/* ------------------------- shared bits ------------------------- */
@Composable
private fun BarcodeThumb(path: String, size: Int) {
    val bitmap = remember(path) {
        try { BitmapFactory.decodeFile(path)?.asImageBitmap() } catch (_: Exception) { null }
    }
    BarcodeThumb(bitmap = bitmap, size = size)
}

@Composable
private fun BarcodeThumb(bitmap: ImageBitmap?, size: Int) {
    Box(
        Modifier.size(size.dp).background(androidx.compose.ui.graphics.Color.White)
            .border(1.dp, MaterialTheme.colorScheme.outline),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(bitmap, contentDescription = "Ticket-Barcode", Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        } else {
            Text("kein Bild", style = muted())
        }
    }
}

@Composable
private fun Field(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
    )
}

@Composable
private fun PrimaryButton(text: String, small: Boolean = false, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(4.dp),
        modifier = if (small) Modifier else Modifier.fillMaxWidth(),
    ) { Text(text, fontWeight = FontWeight.Bold) }
}

@Composable
private fun Card(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().border(2.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp)).padding(12.dp),
        content = content,
    )
}

@Composable
private fun Chip(text: String) {
    Text(
        text,
        Modifier.border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 1.dp),
        fontWeight = FontWeight.Bold, fontSize = 14.sp,
    )
}

@Composable
private fun FlowChips(labels: List<String>) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        labels.take(6).forEach { Chip(it) }
    }
}

@Composable
private fun <T> LoadContent(state: Load<T>, empty: String, content: @Composable (T) -> Unit) {
    when (state) {
        is Load.Idle -> Unit
        is Load.Loading -> Text("Laden…", style = muted())
        is Load.Err -> Text("Fehler: ${state.message}", style = muted())
        is Load.Ok -> {
            val v = state.value
            if (v is List<*> && v.isEmpty()) Text(empty, style = muted()) else content(v)
        }
    }
}

@Composable
private fun muted() = LocalTextStyleColorMuted()

/* Small helpers to keep the code above readable. */
@Composable
private fun LocalTextStyleColorMuted() = androidx.compose.ui.text.TextStyle(
    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
    fontSize = 14.sp,
)

private fun formatDur(min: Int): String {
    val h = min / 60
    val m = min % 60
    return if (h > 0) "${h}h ${m.toString().padStart(2, '0')}" else "$m min"
}

private fun Modifier.clickableTab(onClick: () -> Unit): Modifier = this.clickable { onClick() }
