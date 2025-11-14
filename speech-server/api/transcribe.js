// Disable body parsing for multipart
module.exports.config = {
  api: { bodyParser: false }
};

const Busboy = require("busboy");
const FormData = require("form-data");
const fetch = require("node-fetch");

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    const chunks = [];

    let filename = "audio.webm";
    let contentType = "audio/webm";

    bb.on("file", (name, file, info) => {
      filename = info?.filename || filename;
      contentType = info?.mimeType || contentType;
      file.on("data", (chunk) => chunks.push(chunk));
    });

    bb.on("finish", () => {
      if (chunks.length === 0) return reject(new Error("No file uploaded"));
      resolve({
        buffer: Buffer.concat(chunks),
        filename,
        contentType
      });
    });

    bb.on("error", reject);
    req.pipe(bb);
  });
}

module.exports = async function handler(req, res) {
  // CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { buffer, filename, contentType } = await parseMultipart(req);

    const form = new FormData();
    form.append("file", buffer, { filename, contentType });
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "en");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const txt = await r.text();
    if (!r.ok) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(r.status).send(txt);
    }

    const data = JSON.parse(txt);

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ text: data.text });
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).send(err.message || "Transcription failed");
  }
};
