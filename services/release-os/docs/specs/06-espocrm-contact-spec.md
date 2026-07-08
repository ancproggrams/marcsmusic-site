# EspoCRM Contact Spec

EspoCRM is the source of truth for contacts. The app must not create a separate
CRM. If required fields are missing in EspoCRM, document the mapping instead of
inventing a parallel contact system.

## Expected Fields

- email
- name
- organization/account name
- type
- language
- country
- genres
- priority
- tags
- status/suppression flags
- artist audience tags

## Segment Filters

`selectedTypes`, `selectedTags`, `selectedLanguages`, `selectedCountries`,
`selectedGenres`, `selectedPriorities`, `artistSlug`.

