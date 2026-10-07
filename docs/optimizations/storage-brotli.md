# Browser storage format v2

Managed keys (`emojiGroup_*`, `appSettings`, `favorites`, `archivedGroupIds`,
`discourseDomains`, `emojiGroupIndex`, `telegramBotToken`) no longer need a
`{data,timestamp}` envelope. Small values remain plain JSON. Larger values use
Brotli WASM quality 9, bundled with the extension (no remote codec/server).

Compressed values are `["br2", compressedByteLength, unsigned32BitWords]`.
Words contain four compressed bytes each in little-endian order. This avoids
Base64 and the JSON overhead of one number per byte. Compression is selected
only when the **complete persisted JSON UTF-8 byte count** is smaller than the
plain value. This is lossless compression, not encryption.

Legacy wrapped/plain values and `eg1:` DEFLATE values remain readable and are
automatically replaced on access/startup. Migration checks the original
snapshot before replacing it; a concurrent edit or failed write retains the
original. Use `simpleStorage` rather than writing managed keys directly, and
initialize the codec before calling its synchronous encode/decode functions.

Archiving commits IndexedDB before deleting active keys. Startup removes old
active duplicates only for IDs actually present in the archive database.
Restoring writes the active copy before deleting its archive; quota errors
preserve the archive. All managed writes/deletes share a lock to prevent old
pending saves from resurrecting archived packs.
