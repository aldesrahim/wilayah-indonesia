const axios = require("axios");
const fs = require("fs");
const path = require("path");

const BASE = "https://sig.bps.go.id";
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(__dirname, "data");

const RETRIES = 3;
const RETRY_DELAY = 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  let lastError;

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await axios.get(url, { timeout: 30000 });

      if (!Array.isArray(res.data)) {
        throw new Error(`expected an array, got ${typeof res.data}`);
      }

      return res.data;
    } catch (e) {
      lastError = e;
      if (attempt < RETRIES) await sleep(RETRY_DELAY * attempt);
    }
  }

  throw new Error(`GET ${url} failed after ${RETRIES} attempts: ${lastError.message}`);
}

const toCapitalCase = (str) =>
  str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// Region codes are hierarchical and fixed-width per level (11, 1101, 1101010,
// 1101010001), so sorting each batch lexicographically by code makes the whole
// traversal - and therefore the generated ids - deterministic across runs even
// if the upstream API changes the order it returns rows in.
const byCode = (a, b) => (a.kode_dagri.trim() < b.kode_dagri.trim() ? -1 : 1);

// The upstream API occasionally returns placeholder rows with an empty code and
// name. Dropping them here keeps the validator's format rules strict.
let skipped = 0;

function clean(rows, level, parent) {
  const kept = rows.filter((r) => (r.kode_dagri || "").trim() && (r.nama_dagri || "").trim());

  if (kept.length !== rows.length) {
    skipped += rows.length - kept.length;
    console.warn(`  skipped ${rows.length - kept.length} empty ${level} row(s) under parent ${parent}`);
  }

  return kept.sort(byCode);
}

class JsonArrayWriter {
  constructor(filePath) {
    this.stream = fs.createWriteStream(filePath);
    this.first = true;
    this.stream.write("[");
  }

  write(obj) {
    const prefix = this.first ? "" : ",";
    this.first = false;
    this.stream.write(prefix + JSON.stringify(obj));
  }

  close() {
    return new Promise((resolve, reject) => {
      this.stream.write("]");
      this.stream.end();
      this.stream.on("finish", resolve);
      this.stream.on("error", reject);
    });
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const writers = {
    provinces: new JsonArrayWriter(path.join(OUT, "provinces.json")),
    cities: new JsonArrayWriter(path.join(OUT, "cities.json")),
    districts: new JsonArrayWriter(path.join(OUT, "districts.json")),
    villages: new JsonArrayWriter(path.join(OUT, "villages.json")),
  };

  let provinceSeq = 0;
  let citySeq = 0;
  let districtSeq = 0;
  let villageSeq = 0;

  console.log(`Writing to ${OUT}`);
  console.log("Fetching provinces...");
  const rawProvinces = clean(
    await get(`${BASE}/rest-bridging-dagri/getwilayah?level=provinsi&parent=0`),
    "province",
    "root",
  );

  for (const p of rawProvinces) {
    const provinceId = ++provinceSeq;
    const provinceCode = p.kode_dagri.trim();
    const provinceName = toCapitalCase(p.nama_dagri);

    writers.provinces.write({ id: provinceId, code: provinceCode, name: provinceName });
    console.log(`[${provinceId}/${rawProvinces.length}] ${provinceName}`);

    await sleep(200);
    const rawCities = clean(
      await get(`${BASE}/rest-bridging/getwilayah?level=kabupaten&parent=${p.kode_bps}`),
      "city",
      provinceCode,
    );

    for (const c of rawCities) {
      const cityId = ++citySeq;
      const cityCode = c.kode_dagri.trim();
      const cityName = toCapitalCase(c.nama_dagri);

      writers.cities.write({ id: cityId, code: cityCode, name: cityName, province_id: provinceId });

      await sleep(100);
      const rawDistricts = clean(
        await get(`${BASE}/rest-bridging/getwilayah?level=kecamatan&parent=${c.kode_bps}`),
        "district",
        cityCode,
      );

      for (const d of rawDistricts) {
        const districtId = ++districtSeq;
        const districtCode = d.kode_dagri.trim();
        const districtName = toCapitalCase(d.nama_dagri);

        writers.districts.write({ id: districtId, code: districtCode, name: districtName, city_id: cityId });

        await sleep(100);
        const rawVillages = clean(
          await get(`${BASE}/rest-bridging/getwilayah?level=desa&parent=${d.kode_bps}`),
          "village",
          districtCode,
        );

        for (const v of rawVillages) {
          writers.villages.write({
            id: ++villageSeq,
            code: v.kode_dagri.trim(),
            name: toCapitalCase(v.nama_dagri),
            district_id: districtId,
          });
        }
      }
    }
  }

  await Promise.all(Object.values(writers).map((w) => w.close()));
  console.log(`Done. provinces=${provinceSeq} cities=${citySeq} districts=${districtSeq} villages=${villageSeq}`);
  if (skipped) console.warn(`Skipped ${skipped} empty upstream row(s) in total.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
