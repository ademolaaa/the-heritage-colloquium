import { db as pgDb } from './postgres.js';
import { createId } from './jsonStore.js';

export async function runAutoRepair() {
  console.log('[AUTO-REPAIR] Starting database gallery auto-repair...');
  try {
    const result = await pgDb.query("SELECT id, type, title, file_path, category FROM media WHERE file_path LIKE 'zip://%'");
    let fixedCount = 0;
    let albumCreatedCount = 0;
    let linkedCount = 0;

    for (const row of result.rows) {
      if (row.type !== 'image' || row.category === 'speaker_portrait') {
        continue;
      }

      const zipPath = row.file_path;
      const pathPart = zipPath.replace(/^zip:\/\/[^\/]+\//, '');
      const folders = pathPart.split('/');
      
      if (folders.length <= 1) {
        continue;
      }

      const folderName = folders[folders.length - 2];
      const filename = folders[folders.length - 1];

      if (row.category !== 'gallery') {
        await pgDb.query("UPDATE media SET category = 'gallery', updated_at = NOW() WHERE id = $1", [row.id]);
        console.log(`[AUTO-REPAIR] Updated media "${row.title}" category to 'gallery'.`);
        fixedCount++;
      }

      let albumResult = await pgDb.query("SELECT id FROM gallery WHERE title = $1 AND media_id IS NULL", [folderName]);
      let albumId;
      if (albumResult.rowCount === 0) {
        albumId = createId('gal');
        await pgDb.query(
          "INSERT INTO gallery (id, title, description, category, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
          [albumId, folderName, `Album synchronized from ZIP archive folder "${folderName}"`, 'Events']
        );
        console.log(`[AUTO-REPAIR] Created new Gallery Album: "${folderName}"`);
        albumCreatedCount++;
      } else {
        albumId = albumResult.rows[0].id;
      }

      const linkCheck = await pgDb.query(
        "SELECT id FROM gallery WHERE media_id = $1 AND category = $2",
        [row.id, folderName]
      );
      if (linkCheck.rowCount === 0) {
        const galleryItemId = createId('gal_item');
        await pgDb.query(
          "INSERT INTO gallery (id, title, description, media_id, category, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
          [galleryItemId, filename, `Photo from ZIP archive folder ${folderName}`, row.id, folderName]
        );
        console.log(`[AUTO-REPAIR] Linked photo "${filename}" to album "${folderName}".`);
        linkedCount++;
      }
    }

    if (fixedCount > 0 || albumCreatedCount > 0 || linkedCount > 0) {
      console.log(`[AUTO-REPAIR] Completed: ${fixedCount} media re-categorized, ${albumCreatedCount} albums created, ${linkedCount} photos linked.`);
    } else {
      console.log('[AUTO-REPAIR] No actions needed. Database is fully consistent.');
    }
  } catch (error) {
    console.error('[AUTO-REPAIR] Error during gallery auto-repair:', error);
  }
}
