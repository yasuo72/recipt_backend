const multer = require('multer');

// In-memory storage; files are streamed directly to Cloudinary and not
// persisted on disk in the backend container.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

module.exports = upload;
