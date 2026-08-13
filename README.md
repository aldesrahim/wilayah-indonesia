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

- `id` — sequential integer, assigned in `code` order, stable for joins
- `code` — official Dagri administrative code, for interop with other datasets
- `name` — Capitalize Case
- Parent refs are integer `id`s

Rows are always emitted in ascending `code` order per parent, so regenerating unchanged upstream data produces byte-identical files. Treat `code` as the stable key across releases: `id` values shift whenever regions are added or removed.

## Generate locally

```bash
npm install
npm run generate
# output → data/

npm run check
# generate → build/, validate it, and diff it against the published data/
```

## Releases

Data is versioned with [CalVer](https://calver.org/) (`vYYYY.MM`). A release runs on the 1st of every month, and can also be started from the Actions tab or by pushing a `v*` tag.

Each run:
1. Generates fresh data into `build/`, leaving `data/` untouched until it passes
2. Validates it — code formats, unique codes, sequential ids, deterministic order, parent references, and a guard against an upstream response that lost more than 5% of its rows
3. Compares it to the published `data/`, matching rows by `code`
4. **Stops here if nothing changed** — no commit, no tag, no release
5. Otherwise commits to `main`, then creates the release with the JSON files attached and a changelog of what was added, removed, renamed, or reparented

Use the **Force** input on a manual run to publish even when the data is unchanged.

## Inspiration

Inspired by [gilang-as/indonesian-region-code](https://github.com/gilang-as/indonesian-region-code).

## License

- Scripts: [MIT](LICENSE)
- Source data: [Badan Pusat Statistik (BPS) Indonesia](https://sig.bps.go.id/)
