import { HttpError } from '../lib/httpError';

export function detectMedia(buffer: Buffer, kind: string) {
  if (kind === 'cover') {
    if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { extension: 'png', mimeType: 'image/png' };
    if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return { extension: 'jpg', mimeType: 'image/jpeg' };
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mimeType: 'image/webp' };
  }
  if (kind === 'audio') {
    if (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 255 && (buffer[1] & 0xe0) === 0xe0)) return { extension: 'mp3', mimeType: 'audio/mpeg' };
    if (buffer.toString('ascii', 0, 4) === 'OggS') return { extension: 'ogg', mimeType: 'audio/ogg' };
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return { extension: 'wav', mimeType: 'audio/wav' };
    if (buffer.toString('ascii', 4, 8) === 'ftyp') return { extension: 'm4a', mimeType: 'audio/mp4' };
    if (buffer.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))) return { extension: 'webm', mimeType: 'audio/webm' };
  }
  throw new HttpError(400, kind === 'cover' ? 'جلد را به صورت PNG، JPG یا WebP بفرستید.' : 'فایل صوتی MP3، WAV، OGG، M4A یا WebM انتخاب کنید.');
}
