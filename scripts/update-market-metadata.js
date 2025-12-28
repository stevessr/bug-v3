
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MARKET_DIR = path.join(__dirname, 'cfworker/public/assets/market');
const METADATA_FILE = path.join(MARKET_DIR, 'metadata.json');

// Get all JSON files in the directory except metadata.json
const files = fs.readdirSync(MARKET_DIR).filter(file =>
    file.endsWith('.json') && file !== 'metadata.json'
);

const groups = [];

files.forEach(file => {
    try {
        const content = fs.readFileSync(path.join(MARKET_DIR, file), 'utf8');
        const data = JSON.parse(content);

        // Extract group summary info
        const groupInfo = {
            id: data.id,
            name: data.name,
            icon: data.icon,
            order: data.order || 0,
            emojiCount: data.emojis ? data.emojis.length : 0,
            isArchived: !!data.isArchived // Use isArchived from file if exists, default false
        };

        groups.push(groupInfo);
    } catch (err) {
        console.error(`Error reading ${file}:`, err);
    }
});

// We need to preserve isArchived status from existing metadata.json if possible
let existingMetadata = {};
try {
    if (fs.existsSync(METADATA_FILE)) {
        const content = fs.readFileSync(METADATA_FILE, 'utf8');
        existingMetadata = JSON.parse(content);
    }
} catch (err) {
    console.warn('Could not read existing metadata.json, starting fresh');
}

// Map existing archived status
const existingGroupsMap = new Map();
if (existingMetadata.groups) {
    existingMetadata.groups.forEach(g => {
        existingGroupsMap.set(g.id, g);
    });
}

// Update groups with preserved metadata
groups.forEach(group => {
    const existing = existingGroupsMap.get(group.id);
    if (existing) {
        // Preserve manually set properties if they are not in the individual files
        // logic: if individual file doesn't have isArchived, take from existing metadata
        if (group.isArchived === false && existing.isArchived) {
             group.isArchived = existing.isArchived;
        }

        // It seems the source files don't have isArchived at all in the examples shown.
        // So we should default to what's in metadata.json, or false if new.
        if (existing.isArchived !== undefined) {
            group.isArchived = existing.isArchived;
        }
    }
});

// Sort groups by order
groups.sort((a, b) => a.order - b.order);

// Ensure unique order values by incrementing duplicates
const usedOrders = new Set();
for (let i = 0; i < groups.length; i++) {
    let currentOrder = groups[i].order;
    while (usedOrders.has(currentOrder)) {
        currentOrder++;
    }
    groups[i].order = currentOrder;
    usedOrders.add(currentOrder);
}

const metadata = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    totalGroups: groups.length,
    includeArchived: true,
    groups: groups
};

fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
console.log(`Generated metadata.json with ${groups.length} groups.`);
