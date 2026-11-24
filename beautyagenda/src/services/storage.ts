import { STORAGE_BUCKET, supabase } from '../lib/supabase.ts';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/** Envia uma imagem para o Storage e devolve a URL pública. Somente admin (RLS). */
export async function uploadImage(file: File, folder: 'professionals' | 'logo'): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error('Formato não permitido. Use PNG, JPG ou WEBP.');
  if (file.size > MAX_BYTES) throw new Error('Imagem muito grande. O limite é 2 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
