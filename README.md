# Wilayah Indonesia

Provinces, cities, districts, and villages of Indonesia — auto-generated from [BPS](https://sig.bps.go.id/) and published via GitHub Actions.

## Data

Download from the [latest release](../../releases/latest).

| File | Description |
|------|-------------|
| `provinces.json` | Provinces |
| `cities.json` | Regencies/cities |
| `districts.json` | Districts (kecamatan) |
| `villages.json` | Villages (kelurahan/desa) |

## Schema

```json
// provinces.json
[{ "id": 1, "code": "11", "name": "Aceh" }]

// cities.json
[{ "id": 1, "code": "11.09", "name": "Kab. Simeulue", "province_id": 1 }]

// districts.json
[{ "id": 1, "code": "11.09.07", "name": "Teupah Selatan", "city_id": 1 }]

// villages.json
[{ "id": 1, "code": "11.09.07.2008", "name": "Latiung", "district_id": 1 }]
```

- `id` — sequential integer, stable for joins
- `code` — official Dagri administrative code, for interop with other datasets
- `name` — Capitalize Case
- Parent refs are integer `id`s

## Generate locally

```bash
npm install
npm run generate
# output → data/
```

## Updates

GitHub Actions runs monthly and on manual trigger. Each run commits updated data and creates a tagged release (`data-YYYYMMDD`, counter-suffixed if multiple runs per day).

## Inspiration

Inspired by [gilang-as/indonesian-region-code](https://github.com/gilang-as/indonesian-region-code).

## License

- Scripts: [MIT](LICENSE)
- Source data: [Badan Pusat Statistik (BPS) Indonesia](https://sig.bps.go.id/)
