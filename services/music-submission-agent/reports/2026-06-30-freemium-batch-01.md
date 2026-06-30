# Freemium Batch 01 — 30 Platforms

Date: 2026-06-30

## Objective

Process 30 freemium platforms with a strict free-path-first posture. These platforms have a free entry point, limited free tier, free inspection path or public onboarding path, but also include paid upgrades, credits, paid campaigns, subscriptions, commissions or premium packages.

## Summary

| Metric | Value |
|---|---:|
| Platforms in batch | 30 |
| Pricing model | freemium |
| Queue priority | 30 |
| Auto-submit candidates | 0 |
| Manual review required | 30 |
| Paid upgrades blocked | 30 |
| Free-path focus | 30 |

## Platforms

| # | Platform | Free path focus | Paid path blocked |
|---:|---|---|---|
| 1 | SubmitHub | Standard/free routes where available | Premium credits |
| 2 | Groover | Free opportunities where available | Curator credits |
| 3 | MusoSoup | Campaign review/offer discovery | Campaign fee and curator offers |
| 4 | DailyPlaylists | Free playlist submissions | Premium submissions/marketplace |
| 5 | Soundplate | Free Spotify/Deezer submissions | Promotional services/OAuth review |
| 6 | A&R Factory | Free submission option | Standard/Premium packages |
| 7 | ReverbNation | Artist profile/basic opportunities | Paid tools/promoted opportunities |
| 8 | Broadjam | Basic participation/profile | Submission fees/memberships |
| 9 | Music Xray | Opportunity browsing/profile | Song submission fees |
| 10 | Radio Airplay / Jango | Limited free/trial path | Airplay packages |
| 11 | Playlist Push | Eligibility/account review | Campaign budgets |
| 12 | SoundCampaign | Eligibility/account review | Campaign budgets |
| 13 | DropTrack | Trial/basic campaign path | Promo plans |
| 14 | LabelRadar | Basic submissions/remix opportunities | Pro/priority features |
| 15 | Feature.fm | Limited smart links/pre-save tools | Marketing plans/analytics |
| 16 | Bandcamp | Artist page/store setup | Pro/label/enhanced commerce |
| 17 | SoundCloud for Artists | Creator upload/profile | Next Pro/artist services |
| 18 | Audiomack | Artist upload/profile | Promo/monetization features |
| 19 | Audius | Artist upload/profile | Token/web3/premium ecosystem actions |
| 20 | Mixcloud | Creator upload/profile | Pro subscriptions/monetization |
| 21 | RouteNote | Free distribution tier | Premium distribution |
| 22 | LANDR | Limited free/trial tools | Distribution/mastering plans |
| 23 | TuneCore | Account/tools where available | Distribution/publishing plans |
| 24 | DistroKid | Research/account path only | Paid distribution subscription |
| 25 | UnitedMasters | Basic tier where available | SELECT/paid services |
| 26 | BeatStars | Basic marketplace/profile | Paid marketplace/distribution plans |
| 27 | Songtradr | Catalog/profile setup where available | Paid services/licensing decisions |
| 28 | Pond5 | Contributor application/upload path | Commission/promotional ecosystem |
| 29 | AudioJungle / Envato | Author onboarding | Commission/promotional ecosystem |
| 30 | Jamendo Artists | Artist upload/licensing setup | Promotion/licensing/service options |

## Worker rules

- Only inspect and map the free path.
- Stop on checkout, payment fields, credits, package upgrades, subscription prompts, OAuth, account walls, CAPTCHA or unclear rights terms.
- Never start paid campaigns.
- Never enter payment details.
- Never accept terms automatically.
- Never upload or distribute music without explicit owner approval.

## Output files

- `data/freemium-batch-01-platforms.json`
- `data/freemium-batch-01-review-queue.csv`
- `reports/2026-06-30-freemium-batch-01.md`
