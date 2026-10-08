// Uploaded family photos for the ambient screensaver — stored in Supabase
// Storage (bucket `family-photos`, see supabase/schema.sql /
// migrate_v7.sql) rather than on-device, so a photo added from any family
// member's phone shows up in the slideshow on the wall tablet too.
import * as ImagePicker from 'expo-image-picker';
import { isSupabaseConfigured, supabase } from './supabase';
import { makeId } from './id';

const BUCKET = 'family-photos';

export type AmbientPhoto = { path: string; url: string };

/** Lists every uploaded photo, newest first. Returns [] (never throws) if
 * Supabase isn't configured or the bucket doesn't exist yet (e.g. the
 * migration hasn't been run) — the screensaver just has nothing to show
 * from "My Photos" until then. */
export async function listAmbientPhotos(): Promise<AmbientPhoto[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.storage.from(BUCKET).list('', {
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error || !data) {
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[ambientPhotos] list failed — has migrate_v7.sql been run?', error);
    }
    return [];
  }
  return data
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({
      path: f.name,
      url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
    }));
}

/** Opens the system photo picker and uploads whatever was chosen. Returns
 * the number of photos actually uploaded. */
export async function pickAndUploadAmbientPhotos(): Promise<number> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library permission was not granted.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.85,
  });
  if (result.canceled || result.assets.length === 0) return 0;

  let uploaded = 0;
  for (const asset of result.assets) {
    try {
      await uploadOneAmbientPhoto(asset.uri, asset.mimeType);
      uploaded += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ambientPhotos] upload failed for one photo —', err);
    }
  }
  return uploaded;
}

async function uploadOneAmbientPhoto(uri: string, mimeType?: string): Promise<void> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const ext = (mimeType ?? blob.type ?? 'image/jpeg').split('/')[1] ?? 'jpg';
  const path = `${makeId()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType ?? blob.type ?? 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
}

export async function removeAmbientPhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
