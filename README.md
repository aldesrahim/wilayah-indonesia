# Indonesian Region Data

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

## Releases

Data is versioned with [CalVer](https://calver.org/) (`vYYYY.MM`). A new release is automatically created on the 1st of every month.

To trigger manually, push a tag:

```bash
git tag v2026.04 && git push origin v2026.04
```

GitHub Actions will:
1. Create a pre-release immediately (visible while generating)
2. Generate and commit data to `main`
3. Attach JSON files and promote to full release

## Inspiration

Inspired by [gilang-as/indonesian-region-code](https://github.com/gilang-as/indonesian-region-code).

## License

- Scripts: [MIT](LICENSE)
- Source data: [Badan Pusat Statistik (BPS) Indonesia](https://sig.bps.go.id/)
