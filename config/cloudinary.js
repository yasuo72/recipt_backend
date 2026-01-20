const cloudinary = require('cloudinary').v2;

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn(
    'Cloudinary env vars are not fully configured. File uploads will fail until CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set.'
  );
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

function uploadBufferToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const options = {
      folder: 'medassist/receipts',
      resource_type: 'auto',
    };

    if (filename) {
      const baseName = filename.split('.').slice(0, -1).join('.') || filename;
      options.public_id = baseName;
    }

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    stream.end(buffer);
  });
}

module.exports = { uploadBufferToCloudinary };
