
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.resolve(__dirname, 'cfworker/public/assets/bilibili');
const INDEX_FILE = path.join(ASSETS_DIR, 'index.json');

interface BilibiliEmotePackageLite {
  id: number;
  text: string;
  url: string;
}

function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Directory not found: ${ASSETS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  const indexData: BilibiliEmotePackageLite[] = [];

  console.log(`Processing ${files.length} files...`);

  for (const file of files) {
    const filePath = path.join(ASSETS_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.id && data.text) {
        indexData.push({
          id: data.id,
          text: data.text,
          url: data.url || ''
        });
      }
    } catch (err) {
      console.error(`Error reading ${file}:`, err);
    }
  }

  // Sort by ID
  indexData.sort((a, b) => a.id - b.id);

  // Write new index.json
  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2));
  console.log(`Generated index.json with ${indexData.length} entries.`);

  // Delete individual files
  console.log('Deleting individual JSON files...');
  for (const file of files) {
      fs.unlinkSync(path.join(ASSETS_DIR, file));
  }
  console.log('Cleanup complete.');
}

main();
