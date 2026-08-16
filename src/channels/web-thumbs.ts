/**
 * Server-side image thumbnailing for gallery/library views (calcifer-d720.6).
 *
 * The gallery presentation previously served full-size images as tiles (heavy).
 * This resizes them with sharp and caches the result on disk keyed by
 * (path, mtime, width), so a 3MB photo becomes a ~10KB webp tile. Cache entries
 * are content-addressed by mtime, so an edited image regenerates automatically.
 *
 * sharp is already vendored (via baileys) and listed in onlyBuiltDependencies;
 * here it's a direct dep pinned to the resolved version.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import sharp from 'sharp';

import { DATA_DIR } from '../config.js';
import { log } from '../log.js';

const CACHE_DIR = path.join(DATA_DIR, 'thumb-cache');

/** Whether a content-type is a raster/vector image sharp can thumbnail. */
export function isThumbnailable(contentType: string): boolean {
  return /^image\/(png|jpeg|gif|webp|bmp|svg\+xml|tiff)$/.test(contentType);
}

/**
 * Return a webp thumbnail (<= `width` px wide) for an image file, from cache
 * when possible. EXIF orientation is honoured; images are never enlarged.
 */
export async function getThumbnail(absPath: string, mtimeMs: number, width: number): Promise<Buffer> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const key = crypto.createHash('sha1').update(`${absPath}\u0000${mtimeMs}\u0000${width}`).digest('hex');
  const cacheFile = path.join(CACHE_DIR, `${key}.webp`);
  try {
    return fs.readFileSync(cacheFile);
  } catch {
    // cache miss — generate below
  }
  const buf = await sharp(absPath, { animated: false, failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  try {
    fs.writeFileSync(cacheFile, buf);
  } catch (err) {
    log.warn('thumb cache write failed', { err });
  }
  return buf;
}
