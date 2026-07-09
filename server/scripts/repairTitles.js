// One-off repair pass: re-derive pdf/epub titles from the files' own metadata
// (falling back to filename patterns) instead of whatever was guessed before.
// Run with the server stopped, since it writes data/kept-things.json directly:
//   npm run repair-titles
const path = require('path');
const db = require('../db');
const { resolveItemTitle } = require('../lib/metadata');

async function run() {
  db.load();
  const state = db.getState();
  let fixed = 0;
  let skipped = 0;

  for (const mod of state.modules) {
    for (const item of mod.items) {
      if (item.type !== 'pdf' && item.type !== 'epub') continue;
      if (!item.file || !item.file.storedName) continue;
      if (item.titleManual) {
        skipped++;
        continue;
      }

      const filePath = path.join(db.LIBRARY_DIR, item.file.storedName);
      try {
        const { title, titleVerified } = await resolveItemTitle({
          filePath,
          ext: item.type,
          originalName: item.file.originalName || item.file.storedName
        });
        if (title !== item.title) {
          console.log(`[repair] ${item.title}  ->  ${title}`);
        }
        item.title = title;
        item.titleVerified = titleVerified;
        fixed++;
      } catch (e) {
        console.error(`[repair] 处理失败 (${item.id}):`, e.message);
      }
    }
    db.sortItems(mod.items);
  }

  db.persistNow();
  console.log(`\n完成：处理 ${fixed} 条，跳过（已手动确认标题）${skipped} 条`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
