# Ahiajoku Centre Content Store (v1)

This project ships with a file-backed JSON “database” designed to mirror a relational model with 10 main tables. Each table is stored as a single JSON file under `server/db/tables/`.

## Tables

### Lectures
- File: `lectures.json`
- Purpose: 44 years of lecture content, chronologically filterable by `year`.
- Shape (per item):
  - `id` (string)
  - `year` (number)
  - `title` (string)
  - `theme` (string|null)
  - `speaker` (string|null)
  - `description` (string|null)
  - `image` (string|null)
  - `role` (string|null)
  - `createdAt` (ISO string)
  - `updatedAt` (ISO string)

### Events
- File: `events.json`
- Purpose: Event listings with postponement/cancellation/status tracking.
- Shape (per item):
  - `id` (string)
  - `title` (string)
  - `description` (string|null)
  - `location` (string|null)
  - `startAt` (ISO datetime|null)
  - `endAt` (ISO datetime|null)
  - `status` (string; e.g. `scheduled|postponed|cancelled|completed`)
  - `statusHistory` (array of `{ at, status, note }`)
  - `createdAt` (ISO string)
  - `updatedAt` (ISO string)

### Media
- File: `media.json`
- Purpose: Videos, audio, PDF, images and external URLs; can link to lectures/events.
- Shape (per item):
  - `id` (string)
  - `type` (string; e.g. `video|audio|pdf|image`)
  - `title` (string)
  - `description` (string|null)
  - `url` (string)
  - `filePath` (string|null)
  - `mimeType` (string|null)
  - `sizeBytes` (number|null)
  - `relatedLectureId` (string|null)
  - `relatedEventId` (string|null)
  - `createdAt` (ISO string)
  - `updatedAt` (ISO string)

### Publications
- File: `publications.json`
- Purpose: Publications, with optional `mediaId` or external `url`.
- Shape (per item):
  - `id` (string)
  - `title` (string)
  - `authors` (string[])
  - `publishedAt` (string|null)
  - `abstract` (string|null)
  - `url` (string|null)
  - `mediaId` (string|null)
  - `createdAt` (ISO string)
  - `updatedAt` (ISO string)

### Press Releases
- File: `pressReleases.json`
- Purpose: Press releases and announcements (supports linking to PDFs via `mediaId`).
- Shape (per item):
  - `id` (string)
  - `title` (string)
  - `excerpt` (string|null)
  - `body` (string)
  - `publishedAt` (string|null)
  - `mediaId` (string|null)
  - `createdAt` (ISO string)
  - `updatedAt` (ISO string)

### Social Media Links
- File: `socialLinks.json`
- Purpose: Multi-platform social integration, ordered display.
- Shape (per item):
  - `id` (string)
  - `platform` (string)
  - `url` (string)
  - `handle` (string|null)
  - `order` (number)
  - `active` (boolean)
  - `updatedAt` (ISO string)

### Gallery
- File: `gallery.json`
- Purpose: Gallery groupings by event/year with a set of `mediaIds`.
- Shape (per item):
  - `id` (string)
  - `title` (string)
  - `description` (string|null)
  - `year` (number|null)
  - `eventId` (string|null)
  - `mediaIds` (string[])
  - `createdAt` (ISO string)
  - `updatedAt` (ISO string)

### Contributors
- File: `contributors.json`
- Purpose: People/roles and optional social links.
- Shape (per item):
  - `id` (string)
  - `name` (string)
  - `role` (string|null)
  - `bio` (string|null)
  - `photoMediaId` (string|null)
  - `socials` (array of `{ platform, url }`)
  - `createdAt` (ISO string)
  - `updatedAt` (ISO string)

### Navigation Menu
- File: `navigationMenu.json`
- Purpose: Database-driven navigation items.
- Shape (per item):
  - `id` (string)
  - `label` (string)
  - `path` (string)
  - `order` (number)
  - `visible` (boolean)
  - `updatedAt` (ISO string)

### Site Settings
- File: `siteSettings.json`
- Purpose: Key/value store for site-wide configuration.
- Shape:
  - `id` (always `site`)
  - `updatedAt` (ISO string|null)
  - `data` (object)

