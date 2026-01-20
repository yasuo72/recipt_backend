const axios = require('axios');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

async function downloadFile(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  const contentType = (response.headers['content-type'] || '').toLowerCase();
  return { buffer, contentType };
}

function isPdf(url, contentType) {
  if (contentType && contentType.includes('pdf')) return true;
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.pdf');
}

async function extractTextFromPdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  return (data.text || '').trim();
}

async function extractTextFromImageBuffer(buffer) {
  const result = await Tesseract.recognize(buffer, 'eng', { logger: () => {} });
  return (result.data && result.data.text ? result.data.text : '').trim();
}

async function extractTextFromCloudinaryUrl(url) {
  if (!url) return '';
  try {
    const { buffer, contentType } = await downloadFile(url);
    if (isPdf(url, contentType)) {
      return await extractTextFromPdfBuffer(buffer);
    }
    // Fallback to OCR for images and other formats
    return await extractTextFromImageBuffer(buffer);
  } catch (err) {
    console.error('OCR extractTextFromCloudinaryUrl failed:', err.message || err);
    return '';
  }
}

module.exports = {
  extractTextFromCloudinaryUrl,
};
