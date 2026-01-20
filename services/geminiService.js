const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Default to a free-friendly, widely available text model.
// You can override this via GEMINI_MODEL in your environment.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// For text-only use, the recommended endpoint is the v1 generateContent route.
// GEMINI_API_URL can still override this if explicitly set.
const GEMINI_API_URL =
  process.env.GEMINI_API_URL ||
  `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

if (!GEMINI_API_KEY) {
  console.warn(
    'GEMINI_API_KEY is not set. Receipt summaries will fail until it is configured.'
  );
}

function buildPrompt(context) {
  const {
    cloudinaryFileUrl,
    documentType,
    ocrText,
    ocrJson,
    receipt,
  } = context || {};

  const url = (cloudinaryFileUrl || '').trim() || 'Not provided';
  const docType = (documentType || '').trim() ||
    'Medical Receipt / Pharmacy Bill / Lab Report / Hospital Invoice';

  let ocrTextSafe = (ocrText || '').toString().trim();
  if (!ocrTextSafe) {
    ocrTextSafe = 'Not provided';
  } else {
    // Safety: avoid sending excessively long raw OCR blobs
    const MAX_OCR_CHARS = 8000;
    if (ocrTextSafe.length > MAX_OCR_CHARS) {
      ocrTextSafe = `${ocrTextSafe.slice(0, MAX_OCR_CHARS)}\n[truncated]`;
    }
  }

  const structured = ocrJson || receipt || {};
  const structuredStr = JSON.stringify(structured, null, 2);

  return (
    'You are MediAssist AI, a medical document understanding assistant.\n\n' +
    'Your responsibility is to process medical receipts, bills, pharmacy invoices,\n' +
    'lab reports, and hospital documents uploaded by users.\n\n' +
    'You MUST follow medical safety rules:\n' +
    '- Do NOT diagnose diseases\n' +
    '- Do NOT provide medical advice\n' +
    '- Do NOT suggest treatment changes\n' +
    '- Only summarize what is explicitly present in the document\n' +
    '- Always use clear, neutral, and professional language\n\n' +
    'Your output must be structured, easy to read, and suitable for both patients and doctors.\n\n' +
    'A user has uploaded a medical document (receipt, bill, or report).\n' +
    'The file is already stored securely in Cloudinary as an image or PDF.\n\n' +
    'Your task is to:\n\n' +
    '1. Understand the OCR-extracted content provided below.\n' +
    '2. Identify and classify medical information accurately.\n' +
    '3. Generate a clean, well-structured medical summary.\n' +
    '4. Prepare the summary so it can be stored in the MediAssist Receipt Store.\n' +
    '5. Ensure compliance with medical safety rules.\n\n' +
    '---------------------------------\n' +
    'INPUT DATA\n' +
    '---------------------------------\n\n' +
    'Cloudinary File URL:\n' +
    `${url}\n\n` +
    'Document Type:\n' +
    `${docType}\n\n` +
    'OCR Extracted Text:\n' +
    `${ocrTextSafe}\n\n` +
    'Structured OCR (if available):\n' +
    `${structuredStr}\n\n` +
    '---------------------------------\n' +
    'PROCESSING RULES\n' +
    '---------------------------------\n\n' +
    '1. Identify the following if present:\n' +
    '   - Hospital / Pharmacy / Diagnostic Center name\n' +
    '   - Date of visit or billing\n' +
    '   - Doctor name (if mentioned)\n' +
    '   - Medicines (name, strength, form)\n' +
    '   - Tests / Investigations\n' +
    '   - Procedures / Treatments\n' +
    '   - Individual item costs\n' +
    '   - Total amount paid\n\n' +
    '2. Classify extracted items into:\n' +
    '   - Medicines\n' +
    '   - Lab Tests\n' +
    '   - Diagnostic Procedures\n' +
    '   - Consultation / Services\n' +
    '   - Other charges\n\n' +
    '3. If medicine names are present:\n' +
    '   - Keep names exactly as written\n' +
    '   - Do NOT add usage instructions\n' +
    '   - Do NOT explain dosage unless written in receipt\n\n' +
    '4. If test names are present:\n' +
    '   - Expand common abbreviations (e.g., CBC → Complete Blood Count)\n' +
    '   - Do NOT interpret results\n\n' +
    '5. If any information is missing:\n' +
    '   - Clearly mark it as "Not mentioned"\n\n' +
    '---------------------------------\n' +
    'SUMMARY OUTPUT FORMAT (STRICT)\n' +
    '---------------------------------\n\n' +
    'Generate the summary in the following format ONLY:\n\n' +
    '### 🧾 Medical Document Summary\n\n' +
    '**Document Type:**  \n' +
    '**Hospital / Pharmacy / Lab:**  \n' +
    '**Date:**  \n\n' +
    '### 👨‍⚕️ Doctor / Consultant\n' +
    '- Name:  \n\n' +
    '### 💊 Medicines\n' +
    '- Medicine Name – Cost (if available)\n\n' +
    '### 🧪 Tests / Investigations\n' +
    '- Test Name – Cost (if available)\n\n' +
    '### 🏥 Procedures / Services\n' +
    '- Procedure Name – Cost (if available)\n\n' +
    '### 💰 Billing Summary\n' +
    '- Medicines Total:\n' +
    '- Tests Total:\n' +
    '- Procedures / Services Total:\n' +
    '- Other Charges:\n' +
    '- **Total Amount Paid:**\n\n' +
    '### ☁️ File Reference\n' +
    `- Stored Securely at: ${url}\n\n` +
    '### ℹ️ Important Note\n' +
    'This summary is auto-generated from the uploaded medical document.\n' +
    'It is for record-keeping purposes only and does not replace professional medical advice.\n\n' +
    'TONE & STYLE GUIDELINES\n\n' +
    '- Use simple, professional language\n' +
    '- Use bullet points\n' +
    '- No emojis except section headers\n' +
    '- Do not assume anything not written in the document\n' +
    '- Be precise and factual'
  );
}

async function summarizeReceipt(context) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = buildPrompt(context || {});

  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  const data = response.data || {};
  const candidates = data.candidates || [];

  let text = '';
  if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
    text = candidates[0].content.parts
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .join('');
  }

  if (!text && typeof data.output_text === 'string') {
    text = data.output_text;
  }

  if (!text) {
    throw new Error('No summary text returned from Gemini');
  }

  return text.trim();
}

module.exports = { summarizeReceipt };
