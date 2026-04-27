const axios = require("axios");
const fs = require("fs");
const path = require("path");

const BASE = "https://sig.bps.go.id";
const OUT = path.join(__dirname, "data");

const get = (url) => axios.get(url).then((r) => r.data);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toCapitalCase = (str) =>
  str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

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

  console.log("Fetching provinces...");
  const rawProvinces = await get(`${BASE}/rest-bridging-dagri/getwilayah?level=provinsi&parent=0`);

  for (let pi = 0; pi < rawProvinces.length; pi++) {
    const p = rawProvinces[pi];
    const provinceId = ++provinceSeq;
    const provinceCode = p.kode_dagri.trim();
    const provinceName = toCapitalCase(p.nama_dagri);

    writers.provinces.write({ id: provinceId, code: provinceCode, name: provinceName });
    console.log(`[${provinceId}/${rawProvinces.length}] ${provinceName}`);

    await sleep(200);
    const rawCities = await get(`${BASE}/rest-bridging/getwilayah?level=kabupaten&parent=${p.kode_bps}`);

    for (let ci = 0; ci < rawCities.length; ci++) {
      const c = rawCities[ci];
      const cityId = ++citySeq;
      const cityCode = c.kode_dagri.trim();
      const cityName = toCapitalCase(c.nama_dagri);

      writers.cities.write({ id: cityId, code: cityCode, name: cityName, province_id: provinceId });

      await sleep(100);
      const rawDistricts = await get(`${BASE}/rest-bridging/getwilayah?level=kecamatan&parent=${c.kode_bps}`);

      for (let di = 0; di < rawDistricts.length; di++) {
        const d = rawDistricts[di];
        const districtId = ++districtSeq;
        const districtCode = d.kode_dagri.trim();
        const districtName = toCapitalCase(d.nama_dagri);

        writers.districts.write({ id: districtId, code: districtCode, name: districtName, city_id: cityId });

        await sleep(100);
        const rawVillages = await get(`${BASE}/rest-bridging/getwilayah?level=desa&parent=${d.kode_bps}`);

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
