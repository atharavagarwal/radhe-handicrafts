const express = require("express");
const fs = require("fs");
const path = require("path");
const https = require("https");

// Load .env manually — ONLY for local development.
// On Render (or any host), you set GEMINI_API_KEY in the dashboard's
// "Environment" tab instead, so this block is skipped safely in production.
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf8");
  envFile.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.substring(0, index).trim();
    const value = trimmed.substring(index + 1).trim().replace(/\r/g, "");
    if (key) process.env[key] = value;
  });
}

console.log("GEMINI KEY loaded:", process.env.GEMINI_API_KEY ? "YES" : "NO");

const app = express();
// Render (and most hosts) assign the port dynamically via process.env.PORT.
// Falls back to 3000 for local development.
const PORT = process.env.PORT || 3000;

// ==============================
// MIDDLEWARE
// ==============================
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));


// ==============================
// SHARED HELPER: serve a JSON catalogue file from /data
// ==============================
function serveCatalogue(fileName) {
  return (req, res) => {
    const filePath = path.join(__dirname, "data", fileName);

    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.error(`Error reading ${fileName}:`, err);
        return res.status(500).json({ error: `Failed to load ${fileName}` });
      }

      try {
        const products = JSON.parse(data);
        res.json(products);
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr);
        res.status(500).json({ error: "Invalid JSON format" });
      }
    });
  };
}

// ==============================
// PRODUCTS API (Raw Material)
// ==============================
app.get("/api/products", serveCatalogue("products.json"));

// ==============================
// FESTIVE API
// ==============================
// Reads data/festive.json — same schema as products.json.
// Drop your real festive catalogue in that file and this route just works.
app.get("/api/festive", serveCatalogue("festive.json"));


// ==============================
// IMAGES API
// ==============================
// Looks for images matching a SKU across both the raw and festive image
// folders, so the same endpoint works for either catalogue without the
// frontend needing to know which collection a product belongs to.
app.get("/api/images/:sku", (req, res) => {
  const sku = req.params.sku;
  const folders = [
    { dir: path.join(__dirname, "public", "images", "raw"), urlPrefix: "/images/raw/" },
    { dir: path.join(__dirname, "public", "images", "festive"), urlPrefix: "/images/festive/" }
  ];

  const readFolder = ({ dir, urlPrefix }) =>
    new Promise(resolve => {
      fs.readdir(dir, (err, files) => {
        if (err) return resolve([]); // folder missing is fine, just skip it
        const matched = files
          .filter(f => f.startsWith(sku))
          .map(f => `${urlPrefix}${f}`);
        resolve(matched);
      });
    });

  Promise.all(folders.map(readFolder))
    .then(results => res.json(results.flat()))
    .catch(err => {
      console.error("Error reading images folders:", err);
      res.json([]);
    });
});


// ==============================
// AI IMAGE SEARCH PROXY (GEMINI)
// ==============================
app.post("/api/ai", (req, res) => {
  const { base64, mimeType, productList } = req.body;

  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: mimeType,
            data: base64
          }
        },
      {
  text: `You are a highly accurate product-matching AI for Radhe Handicraft, an Indian wedding and festive decoration store.
Your job: analyze the image and find matching raw materials from the catalogue provided at the bottom.

--------------------------------------
STEP 1: UNDERSTAND IMAGE TYPE
--------------------------------------
Classify the image into ONE:
A) FINISHED PRODUCT (latkan, toran, rakhi, kalire, jewellery, decoration, bouquet, pagdi, sehra, bandhanwar, doli decoration, diwali decoration, etc.)
B) RAW MATERIAL (single item like lace, buti, patch, flower, bangle, latkan, etc.)

Indian product reference guide:
- Latkan/Lumba = hanging decoration with lace + buti + beads + tassel
- Toran/Bandhanwar = door hanging with lace + patches + MDF + flowers
- Rakhi = wrist band with base circle + charm + dori + beads
- Kalire = umbrella shaped hanging with bangles + caps + buties + lace
- Pagdi/Sehra = groom headwear with lace + flowers + buties + pins
- Bouquet = flower bunch with flowers + lace + pearls
- Diwali decoration = MDF shapes + laxmi charan + lace + flowers
- Jewellery set = stones + metal + lace + beads

--------------------------------------
STEP 2: BREAK INTO COMPONENTS
--------------------------------------
ONLY if FINISHED product → mentally break into parts:

Think like a karigar (craftsman) who is making this from scratch.
What individual raw materials would he need?

Break into:
- BASE: what is the structural base? (fabric, MDF, wire, ring, circle)
- DECORATION: what decorative elements are on it? (lace, buti, patch, flower, bangle)
- HANGING: does it have any hanging elements? (latkan, tassel, beads, chains)
- CONNECTORS: how is it held together? (glue, pins, thread, hooks)
- EXTRAS: any additional elements? (stones, pearls, metal plates)

Example thinking:
Kalire = base(bangle/ring) + decoration(buties+lace+caps) + hanging(latkan+beads) + connectors(glue+pins)
Toran = base(fabric strip) + decoration(MDF+patches+flowers+lace) + connectors(glue+pins)
Rakhi = base(circle) + decoration(charm+beads) + connectors(glue+dori)

--------------------------------------
STEP 3: MATERIAL DETECTION
--------------------------------------
Identify ALL materials — both visible AND hidden:

VISIBLE — look carefully for:
- Gota: golden/silver shimmer woven lace or border
- Pearl/Moti: white round pearl beads or strings
- Fabric/Cloth: dupatta, bandhej, net, silk, velvet
- Plastic: shiny hard decorative elements
- Metal: golden/silver plates, pins, hooks, charms
- MDF: flat wooden laser-cut shapes/designs
- Stones/Kundan: decorative gems or crystals
- Wool/Un: fluffy soft textured flowers or pompoms
- Beads/Chids: small round decorative beads strung together
- Bukrum: stiff fabric used as base for buties/patches
- Handwork: embroidered or hand-crafted decorative elements
- Resham/Silk: smooth shiny thread or fabric
- Glass: small glass bottles or elements

HIDDEN — always consider:
- Any assembled/glued product → ALWAYS include glue stick
- Any product with pins or hooks → include coat pin
- Any product with metal support → include metal plates

--------------------------------------
STEP 4: CATEGORY BASED MATCHING
--------------------------------------
Match by visual category — DO NOT hardcode product names, use categories as guide:

If you see LACE or BORDER element:
→ search Laces category in catalogue

If you see small DECORATIVE MOTIF or BUTI:
→ search Buties category in catalogue

If you see APPLIQUE or PATCH:
→ search Patches category in catalogue

If you see FLOWER (artificial/fabric/wool):
→ search Flowers category in catalogue

If you see HANGING or TASSEL element:
→ search Hangings category in catalogue

If you see BANGLE or RING shape:
→ search Bangles category in catalogue

If you see CAP or CONE shape:
→ search Caps category in catalogue

If you see WOODEN CUTOUT or MDF shape:
→ search MDF category in catalogue

If you see RAKHI related element:
→ search Rakhi Raw category in catalogue

If you see DIWALI related element (charan, diya, laxmi):
→ search Diwali Raw category in catalogue

If you see TORAN or door hanging strip:
→ search Toran category in catalogue

If product is ASSEMBLED or GLUED:
→ ALWAYS include glue from Raw category

If product has PINS or HOOKS:
→ include pin from Raw category

--------------------------------------
STEP 5: USAGE BASED EXPANSION
--------------------------------------
Think about what items are COMMONLY USED TOGETHER in Indian handicraft:

For hanging/latkan products → also consider laces + buties + hangings + glue
For toran/door decoration → also consider laces + MDF + patches + flowers + glue
For rakhi → also consider base + charms + dori + beads + glue
For kalire → also consider hangings + bangles + caps + buties + lace + glue
For pagdi/sehra → also consider laces + flowers + buties + pins
For diwali → also consider MDF + diwali raw + laces + flowers
For bouquet → also consider flowers + laces + pearls + glue
For jewellery → also consider stones + metal + laces + beads

--------------------------------------
STEP 6: TEXTURE AND FINISH MATCHING
--------------------------------------
Focus on texture/finish NOT color (most products come in all colors):

- Shiny metallic finish → look in Laces, Metal, Hangings
- Matte fabric finish → look in Laces, Flowers, Toran
- Fluffy soft texture → look in Flowers (wool/un)
- Hard structured shape → look in MDF, Bangles, Caps
- Pearl glossy beads → look in Bangles, Laces, Hangings
- Embroidered handwork → look in Buties, Patches
- Stone sparkle/kundan → look in Buties, Diwali Raw
- Woven gota shimmer → look in Laces, Caps, Bangles

--------------------------------------
STEP 7: STRICT FILTERING
--------------------------------------
- ONLY use EXACT product names from the CATALOGUE section below
- DO NOT invent names or modify product names
- DO NOT add products not in catalogue
- Avoid duplicates
- QUALITY OVER QUANTITY: 5 accurate results better than 10 guesses
- Only include a product if you are at least 85% confident it belongs

--------------------------------------
OUTPUT FORMAT
--------------------------------------
- Return ONLY a valid JSON array
- Minimum 4 products, Maximum 10 products
- No explanation, no extra text, just the JSON array
- Example: ["Gota Patti Lace01", "Moti Gota Cap", "Brown Glue Stick", "Chid-Latkan 20 line"]

--------------------------------------
CATALOGUE (ONLY use exact names from this list):
--------------------------------------
${productList}
`
}
      ]
    }],
  generationConfig: {
  temperature: 0.1,
  topP: 0.9,
  maxOutputTokens: 800
}
  });

  const apiKey = process.env.GEMINI_API_KEY;
  const bodyBuffer = Buffer.from(requestBody, "utf8");

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": bodyBuffer.length
    }
  };

  const proxyReq = https.request(options, proxyRes => {
    let data = "";
    proxyRes.on("data", chunk => data += chunk);
    proxyRes.on("end", () => {
      console.log("Gemini status:", proxyRes.statusCode);
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          res.status(400).json({ error: parsed.error });
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.status(200).json(parsed);
      } catch(e) {
        console.error("Gemini returned non-JSON:", data.substring(0, 200));
        res.status(500).json({ error: { message: "Invalid response from AI" } });
      }
    });
  });

  proxyReq.on("error", err => {
    console.error("AI proxy error:", err);
    res.status(500).json({ error: { message: err.message } });
  });

  proxyReq.write(bodyBuffer);
  proxyReq.end();
});
// ==============================
// START SERVER
// ==============================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});