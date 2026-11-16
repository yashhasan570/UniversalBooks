# UniversalBooks plugin for CrossPoint

An [SD-card plugin](https://github.com/crosspoint-reader/crosspoint-reader/blob/develop/docs/sd-plugins.md)
for [CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader) e-readers
(Xteink X3/X4 and other FreeInk devices) that connects the reader to your
[UniversalBooks](https://universalbooks.com) account:

- **Library**: browse and search the EPUBs in your UniversalBooks cloud library on the
  reader and download them to `/UniversalBooks/` on the SD card.
- **Reading statistics**: every reading session on the reader (active reading
  time and how far you got) is added to your UniversalBooks reading statistics.
- **Reading progress**: the reader's built-in CrossPoint Sync syncs your
  position with UniversalBooks, with no sync server to set up.
- **Highlights**: with **Sync Clippings** on, the reader's clippings and your
  UniversalBooks highlights sync both ways.

## Requirements

- CrossPoint 2.0 or later, the first release with SD plugins. A new install
  starts with them off: turn on **Settings → Connectivity → Plugins**.
- A UniversalBooks account. Any sign-in method works, since the reader never sees your
  password.
- Books uploaded to UniversalBooks Cloud. Only EPUBs are listed, since that is the
  format CrossPoint reads.

## Install

Download `UniversalBooks-<version>.crosspoint-plugin.zip` from the
[latest UniversalBooks release](https://github.com/universalbooks/universalbooks/releases/latest)
and unzip it. Copy the `universalbooks/` folder to the SD card as
`/.crosspoint/plugins/universalbooks/` (or `/plugins/universalbooks/`), then restart the
reader.

## Update

The reader's plugin list shows the installed version under **UniversalBooks**, and
so does the **UniversalBooks** card on the web **Plugins** page (see Sign in below
for opening it). On that card, select **Check for update**, then **Update**
when a newer release is available, and reload the page.

## Sign in

Signing in links the reader to your account with a code you approve on the
UniversalBooks web app. The reader gets its own key, which works only for this plugin
and is revoked when you sign out; your password is never stored on the reader.

On the reader, open **File Transfer**, join your Wi-Fi network, and open the
address it shows in a browser on your phone or computer. Go to **Plugins**,
find the **UniversalBooks** card, and select **Sign in**. Open the link it shows, check
that the code matches, and select **Link Reader**.

Sign-in happens only on this web page, because CrossPoint lets a plugin set up
CrossPoint Sync from there but not from the reader's own screen. Until you sign
in, **Plugins → UniversalBooks** on the reader points you to the web page.

Your library then appears on the reader under **Plugins → UniversalBooks**. With
**Sync reading progress** on, signing in from the web page sets the reader's
**CrossPoint Sync** to sync progress with UniversalBooks. The box starts on unless
CrossPoint Sync is already set up with another server; turning it on replaces
that server. **Sign out** revokes the reader's key and clears CrossPoint Sync
only while it still points at UniversalBooks.

## Reading statistics

Reading sessions are queued on the reader and sent to UniversalBooks the next time it
is online: when File Transfer joins a network, or on the way to sleep if Wi-Fi
credentials for the last network are saved. Each session's time is spread over
the pages it covered, in the book's UniversalBooks page count, so it counts like
reading in UniversalBooks. Until a UniversalBooks app has opened the book, sessions are
counted in steps of 1% of the book. Books matching one in your UniversalBooks library
(the same file, identified by its KOReader-compatible partial MD5) merge with
that book's statistics, and so does a copy rewritten by **Optimize EPUB** once
its first **Sync Progress** has linked it (see Reading progress). Others appear
under their file hash.

## Reading progress

Signing in from the web page points the reader's built-in CrossPoint Sync at
UniversalBooks (`/api/crosspoint`) with the reader's key, your email as the username,
and **Document Matching** set to **Binary** so books match UniversalBooks's
partial-MD5 book ids. The key alone authenticates the reader, so changing your
UniversalBooks email does not break sync. Sync from the reader menu with **Sync
Progress**; CrossPoint does not sync progress automatically. UniversalBooks apps move
to the synced position the next time they open the book (the furthest position
wins).

Positions travel as KOReader XPointers. UniversalBooks to CrossPoint lands on the right
page. CrossPoint to UniversalBooks lands one to three lines late; CrossPoint PR #3424
makes it exact.

Sign-in also turns on CrossPoint Sync's **Send Document Metadata**, so each upload carries
the book's title and authors. A book uploaded with the File Manager's
**Optimize EPUB** is rewritten, so it no longer matches UniversalBooks's copy by
partial MD5. Its first **Sync Progress** links it to the UniversalBooks EPUB with the
same title without moving UniversalBooks's position back. When titles collide, the
book must also share the first author, and of several such books (the same
book imported twice, or another edition) the most recently read one wins. The next sync brings UniversalBooks's position over, and from then on
it syncs both ways like the original.

## Highlights

Turn on **Sync Clippings** in **Settings → Connectivity → CrossPoint Sync**.
Each **Sync Progress** then syncs the book's clippings with its UniversalBooks
highlights first, through the same `/api/crosspoint` server, using CrossPoint
Sync's clippings API. A clipping saved on the reader becomes a highlight in
UniversalBooks the next time a UniversalBooks app opens the book. A highlight made in UniversalBooks
appears on the reader after its next sync. Deleting one on either side deletes
it on the other.

CrossPoint anchors a clipping by its chapter and a range of characters in it.
UniversalBooks keeps that anchor next to KOReader's XPointers, places the highlight by
it, and checks the text there; when a rewritten copy shifted it, UniversalBooks finds
the same text nearby. The reader shows no colors or notes, so those stay in
UniversalBooks. An X3 or X4 holds 256 clippings a book, so it gets at most a book's
first 256 highlights.

## Development

Tests live with the app, in
`apps/universalbooks-app/src/__tests__/crosspoint-plugin/universalbooks-plugin.test.ts`. The
server side is the routes in `apps/universalbooks-app/src/app/api/crosspoint/` (device
sign-in, catalog, reading sessions, the KOSync-compatible progress routes and
the clippings API under `api/v1/clippings`) and the `/link` page where codes are
approved. Reader keys and pending sign-ins live in the tables from
`docker/volumes/db/migrations/024_crosspoint_devices.sql`; a clipping is a
`book_notes` row with the `crosspoint` anchor from `033_add_book_notes_crosspoint.sql`.
