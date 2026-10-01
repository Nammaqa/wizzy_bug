import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { v2 as cloudinary, type UploadApiResponse, type DeleteApiResponse } from 'cloudinary';

dotenv.config();

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn(
    'Cloudinary environment variables are not fully configured. Image upload requests may fail.',
  );
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = (
  buffer: Buffer,
  filename: string,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const safeName = filename
      .replace(/\.[^/.]+$/, '')
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'attachment';
    const publicId = `${Date.now()}_${randomUUID()}_${safeName}`;
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'auto',
        folder: 'wizzybug/bugs',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result) {
          reject(new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};

export const deleteFromCloudinary = (
  publicId: string,
): Promise<DeleteApiResponse> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: 'auto' },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result) {
          reject(new Error('Cloudinary destroy returned no result'));
          return;
        }
        resolve(result as DeleteApiResponse);
      },
    );
  });
};
