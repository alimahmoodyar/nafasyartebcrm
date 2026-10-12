# Iranian office locations

The offline catalog in `lib/iran-locations.ts` is a projection of the MIT-licensed [IranCountryDivisions dataset](https://github.com/esafb52/irancountrydivisions), snapshot commit [`68687cf96cc1852d5d38c7283353c80829331758`](https://github.com/esafb52/irancountrydivisions/tree/68687cf96cc1852d5d38c7283353c80829331758), retrieved on 2026-10-12. Its [metadata](https://github.com/esafb52/irancountrydivisions/blob/68687cf96cc1852d5d38c7283353c80829331758/data/1404/metadata.json) identifies the annual Statistical Center of Iran geographical file for Solar Hijri year 1404 as its source. This repository is a software dataset mirror, not an official government service.

Source input: `packages/npm/data/1404/core.json`; SHA-256: `b3664914f6da70463dee991282f7b6c326179c75fcdcaac9d037105e37a7b6ea`. The [MIT copyright and permission notice](https://github.com/esafb52/irancountrydivisions/blob/68687cf96cc1852d5d38c7283353c80829331758/LICENSE) is retained in the catalog's license comment.

The projection retains all 31 provinces, 484 counties and 1,481 cities from that source snapshot. City ancestry follows the source's explicit city → district → county → province parent links. Urban zones, villages, coordinates and unrelated data are omitted. County and city record types remain distinct; a county is not relabeled as a city.

The office-location selector stores the existing province and locality-name fields. A city and county with the same name share one displayed option labeled «شهر / شهرستان»; counties without a same-name city appear in a separate «شهرستان‌ها» group. Duplicate city names in one province share their name option; the existing record format does not persist a county ID. No «all cities» value is used for a specific office address. Service coverage continues to use its separate coverage settings.

Changing the selected province clears the office locality. The server checks a newly supplied locality against the selected province. Existing legacy values are preserved only when the province/locality pair is unchanged; their presence does not grant permission to assign an unknown locality to another province. Omitted properties preserve the previous record on edit. Neither browser rendering nor validation requires a live external geographic service.

For an update, pin the new source commit, re-project the same administrative levels, update the source hash/counts and run `tests/iran-locations.cjs`. Do not silently claim a newer official source year or merge same-name locations from different provinces.
