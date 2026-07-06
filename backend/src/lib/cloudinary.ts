import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { env } from './env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadImage(buffer: Buffer, filename: string): Promise<string> {
  // Keep a readable slug from the original name but append a unique suffix so
  // two products uploaded with the same filename don't overwrite each other.
  const slug = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 60);
  const publicId = `${slug}-${randomUUID().slice(0, 8)}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'blitzcart/products',
        public_id: publicId,
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'));
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}
