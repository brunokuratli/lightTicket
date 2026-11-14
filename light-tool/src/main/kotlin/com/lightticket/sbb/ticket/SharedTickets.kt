package com.lightticket.sbb.ticket

/** What a file uploaded through the Tool Manager is, judged by its name. */
enum class FileKind { PDF, IMAGE }

data class SharedTicket(val name: String, val kind: FileKind, val lastModifiedMillis: Long) {
    /** Name without extension, «_» as space: «Billett_Zuerich_Bern.pdf» → «Billett Zuerich Bern». */
    val title: String
        get() = name.substringBeforeLast('.', name).replace('_', ' ').trim().ifBlank { name }
}

object SharedTickets {
    private val pdf = Regex("""\.pdf$""", RegexOption.IGNORE_CASE)
    private val image = Regex("""\.(png|jpe?g|webp|gif|bmp)$""", RegexOption.IGNORE_CASE)

    fun kindOf(name: String): FileKind? = when {
        name.startsWith(".") -> null // hidden / temporary upload files
        pdf.containsMatchIn(name) -> FileKind.PDF
        image.containsMatchIn(name) -> FileKind.IMAGE
        else -> null
    }

    /** Usable tickets only, newest first. */
    fun from(files: List<Triple<String, Boolean, Long>>): List<SharedTicket> =
        files.filter { (_, isFile, _) -> isFile }
            .mapNotNull { (name, _, modified) -> kindOf(name)?.let { SharedTicket(name, it, modified) } }
            .sortedByDescending { it.lastModifiedMillis }
}
