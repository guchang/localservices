import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import config from '../config.js';

const SETTINGS_FILE = join(config.dataDir, 'settings.json');

const DEFAULTS = {
  projectRoots: [],
  initialized: false,
};

export function loadSettings() {
  if (!existsSync(SETTINGS_FILE)) return { ...DEFAULTS };
  try {
    const data = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return settings;
}
