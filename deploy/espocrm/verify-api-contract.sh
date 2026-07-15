#!/bin/bash
set -Eeuo pipefail
umask 0077

if [ "$#" -ne 5 ]; then
  echo >&2 'usage: verify-api-contract.sh <app-container> <db-container> <base-url> <admin-password-file> <database-password-file>'
  exit 64
fi

readonly APPLICATION_CONTAINER="$1"
readonly DATABASE_CONTAINER="$2"
readonly BASE_URL="${3%/}/api/v1"
readonly ADMIN_PASSWORD_FILE="$4"
readonly DATABASE_PASSWORD_FILE="$5"
readonly EXPECTED_CONFLICT_MESSAGE='A record with the same unique identity already exists.'

if [ ! -r "$ADMIN_PASSWORD_FILE" ] || [ ! -r "$DATABASE_PASSWORD_FILE" ]; then
  echo >&2 'error: API contract secret file is unavailable.'
  exit 66
fi

temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/marcsmusic-api-contract.XXXXXX")"
trap 'rm -rf "$temporary_root"' EXIT
readonly RESULTS="${temporary_root}/results"
mkdir -p "$RESULTS"

printf 'user = "admin:%s"\nsilent\nshow-error\n' "$(<"$ADMIN_PASSWORD_FILE")" >"${temporary_root}/admin.curlrc"
chmod 0600 "${temporary_root}/admin.curlrc"

call_count=0
conflict_count=0
immutable_contract_count=0
relationship_check_count=0
state_hook_count=0
successful_update_count=0

fail() {
  local name="$1"
  local message="$2"

  echo >&2 "error: API contract ${name}: ${message}"
  if [ -f "${RESULTS}/${name}.headers" ]; then
    tr -d '\r' <"${RESULTS}/${name}.headers" | head -n 20 >&2
  fi
  if [ -f "${RESULTS}/${name}.json" ]; then
    head -c 2000 "${RESULTS}/${name}.json" >&2
    echo >&2
  fi
  docker logs --tail 80 "$APPLICATION_CONTAINER" >&2 || true
  exit 1
}

api() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local body="${4:-}"
  local version="${5:-}"
  local -a arguments=(
    --config "${temporary_root}/admin.curlrc"
    --dump-header "${RESULTS}/${name}.headers"
    --output "${RESULTS}/${name}.json"
    --write-out '%{http_code}'
    --request "$method"
    --header 'Content-Type: application/json'
  )

  if [ -n "$version" ]; then
    arguments+=(--header "X-Version-Number: ${version}")
  fi
  if [ -n "$body" ]; then
    arguments+=(--data "$body")
  fi

  call_count=$((call_count + 1))
  curl "${arguments[@]}" "${BASE_URL}${endpoint}" >"${RESULTS}/${name}.status"
}

assert_status() {
  local name="$1"
  local expected="$2"
  local actual
  actual="$(<"${RESULTS}/${name}.status")"

  if [ "$actual" != "$expected" ]; then
    fail "$name" "expected HTTP ${expected}, received ${actual}"
  fi
}

assert_conflict() {
  local name="$1"
  assert_status "$name" 409

  jq --exit-status --arg expected "$EXPECTED_CONFLICT_MESSAGE" \
    '.message == $expected and (keys | sort) == ["message"]' \
    "${RESULTS}/${name}.json" >/dev/null ||
    fail "$name" 'unique conflict body is not the stable one-field contract'

  if ! tr -d '\r' <"${RESULTS}/${name}.headers" |
      grep -Eiq '^X-Status-Reason:[[:space:]]*unique-conflict[[:space:]]*$'; then
    fail "$name" 'unique conflict reason header is absent or unstable'
  fi

  if grep -Eiq 'SQLSTATE|PDO|duplicate entry|UNIQ_|mysql|maria|constraint' \
      "${RESULTS}/${name}.headers" "${RESULTS}/${name}.json"; then
    fail "$name" 'unique conflict leaked database implementation details'
  fi

  conflict_count=$((conflict_count + 1))
}

assert_forbidden() {
  local name="$1"
  assert_status "$name" 403

  if grep -Eiq 'SQLSTATE|PDO|duplicate entry|UNIQ_|mysql|maria|constraint' \
      "${RESULTS}/${name}.headers" "${RESULTS}/${name}.json"; then
    fail "$name" 'forbidden response leaked database implementation details'
  fi
}

assert_identity_metadata_unchanged() {
  local name="$1"
  local before="$2"
  local after="$3"
  shift 3
  local fields_json

  fields_json="$(printf '%s\n' "$@" | jq --raw-input --slurp 'split("\n") | map(select(length > 0))')"
  jq --exit-status --null-input \
    --slurpfile before "$before" \
    --slurpfile after "$after" \
    --argjson fields "$fields_json" '
      $before[0] as $beforeRecord |
      $after[0] as $afterRecord |
      all($fields[]; $beforeRecord[.] == $afterRecord[.])
    ' >/dev/null || fail "$name" 'rejected identity update changed identity, OCC or audit metadata'
}

db_scalar() {
  local sql="$1"
  docker exec \
    --env "MYSQL_PWD=$(<"$DATABASE_PASSWORD_FILE")" \
    "$DATABASE_CONTAINER" \
    mysql --batch --skip-column-names --user=espocrm espocrm --execute="$sql"
}

verify_immutable_api_contract() {
  local name="$1"
  local entity_type="$2"
  local id="$3"
  local identity_field="$4"
  local changed_value="$5"
  local database_query="$6"
  shift 6
  local database_after
  local database_before
  local version

  api "${name}_before" GET "/${entity_type}/${id}"
  assert_status "${name}_before" 200
  version="$(jq -er .versionNumber "${RESULTS}/${name}_before.json")"
  database_before="$(db_scalar "$database_query")"

  api "${name}_null" PUT "/${entity_type}/${id}" \
    "$(jq -nc --arg field "$identity_field" '{($field):null}')" "$version"
  assert_forbidden "${name}_null"
  api "${name}_empty" PUT "/${entity_type}/${id}" \
    "$(jq -nc --arg field "$identity_field" '{($field):""}')" "$version"
  assert_forbidden "${name}_empty"
  api "${name}_changed" PUT "/${entity_type}/${id}" \
    "$(jq -nc --arg field "$identity_field" --arg value "$changed_value" '{($field):$value}')" "$version"
  assert_forbidden "${name}_changed"

  api "${name}_after" GET "/${entity_type}/${id}"
  assert_status "${name}_after" 200
  assert_identity_metadata_unchanged \
    "$name" \
    "${RESULTS}/${name}_before.json" \
    "${RESULTS}/${name}_after.json" \
    "$@" versionNumber modifiedAt modifiedById
  database_after="$(db_scalar "$database_query")"
  if [ "$database_before" != "$database_after" ]; then
    fail "$name" 'identity rejection changed database identity or OCC/audit metadata'
  fi

  immutable_contract_count=$((immutable_contract_count + 1))
}

verify_rejected_update_unchanged() {
  local name="$1"
  local entity_type="$2"
  local id="$3"
  local body="$4"
  local database_query="$5"
  shift 5
  local database_after
  local database_before
  local version

  api "${name}_before" GET "/${entity_type}/${id}"
  assert_status "${name}_before" 200
  version="$(jq -er .versionNumber "${RESULTS}/${name}_before.json")"
  database_before="$(db_scalar "$database_query")"
  api "${name}_reject" PUT "/${entity_type}/${id}" "$body" "$version"
  assert_forbidden "${name}_reject"
  api "${name}_after" GET "/${entity_type}/${id}"
  assert_status "${name}_after" 200
  assert_identity_metadata_unchanged \
    "$name" \
    "${RESULTS}/${name}_before.json" \
    "${RESULTS}/${name}_after.json" \
    "$@" versionNumber modifiedAt modifiedById
  database_after="$(db_scalar "$database_query")"
  if [ "$database_before" != "$database_after" ]; then
    fail "$name" 'rejected state transition changed database state or OCC/audit metadata'
  fi

  state_hook_count=$((state_hook_count + 1))
}

verify_forbidden_delete() {
  local name="$1"
  local entity_type="$2"
  local id="$3"
  local database_query="$4"
  local database_after
  local database_before

  database_before="$(db_scalar "$database_query")"
  api "$name" DELETE "/${entity_type}/${id}"
  assert_forbidden "$name"
  database_after="$(db_scalar "$database_query")"
  if [ "$database_before" != "$database_after" ]; then
    fail "$name" 'forbidden delete changed database state'
  fi

  state_hook_count=$((state_hook_count + 1))
}

api app_user GET /App/user
assert_status app_user 200
jq --exit-status '.user.userName == "admin" and .user.type == "admin" and .user.isActive == true' \
  "${RESULTS}/app_user.json" >/dev/null ||
  fail app_user 'authenticated identity is not the disposable administrator'

race_body_a='{"name":"API contract race A","artistName":"MarcsMusic","status":"Draft","isrc":"NLAAA2699801","epkAttestationState":"Unverified"}'
race_body_b='{"name":"API contract race B","artistName":"MarcsMusic","status":"Draft","isrc":"NL-AAA-26-99801","epkAttestationState":"Unverified"}'
api race_a POST /MusicRelease "$race_body_a" &
race_pid_a=$!
api race_b POST /MusicRelease "$race_body_b" &
race_pid_b=$!
wait "$race_pid_a"
wait "$race_pid_b"
call_count=$((call_count + 2))

race_statuses="$(printf '%s\n%s\n' "$(<"${RESULTS}/race_a.status")" "$(<"${RESULTS}/race_b.status")" | sort -n)"
if [ "$race_statuses" != $'200\n409' ]; then
  fail race_a "concurrent canonical ISRC create returned [${race_statuses//$'\n'/,}], expected [200,409]"
fi
if [ "$(<"${RESULTS}/race_a.status")" = 409 ]; then
  assert_conflict race_a
else
  assert_conflict race_b
fi
if [ "$(db_scalar "SELECT COUNT(*) FROM music_release WHERE isrc='NLAAA2699801' AND deleted=0")" != 1 ]; then
  fail race_a 'canonical ISRC race did not retain exactly one row'
fi

api release POST /MusicRelease \
  '{"name":"API contract projection","artistName":"MarcsMusic","status":"Draft","isrc":"NLAAA2699802","epkAttestationState":"Unverified"}'
assert_status release 200
release_id="$(jq -er .id "${RESULTS}/release.json")"
projection_key="music-release:${release_id}"

target_payload="$(jq -nc --arg release "$release_id" --arg key "$projection_key" '{name:"API contract Target List",musicReleaseId:$release,outreachProjectionKey:$key,outreachManaged:true,eligibilityPolicyVersion:"outreach-eligibility-v1"}')"
api target_list POST /TargetList "$target_payload"
assert_status target_list 200
target_list_id="$(jq -er .id "${RESULTS}/target_list.json")"

api target_list_duplicate POST /TargetList "$target_payload"
assert_conflict target_list_duplicate

api target_before GET "/TargetList/${target_list_id}"
assert_status target_before 200
target_version="$(jq -er .versionNumber "${RESULTS}/target_before.json")"
target_db_before="$(db_scalar "SELECT CONCAT_WS('|', outreach_projection_key, music_release_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM target_list WHERE id='${target_list_id}'")"

api target_key_attack_null PUT "/TargetList/${target_list_id}" '{"outreachProjectionKey":null}' "$target_version"
assert_forbidden target_key_attack_null
api target_key_attack_empty PUT "/TargetList/${target_list_id}" '{"outreachProjectionKey":""}' "$target_version"
assert_forbidden target_key_attack_empty
api target_key_attack_changed PUT "/TargetList/${target_list_id}" '{"outreachProjectionKey":"music-release:attacker-controlled"}' "$target_version"
assert_forbidden target_key_attack_changed
api target_after GET "/TargetList/${target_list_id}"
assert_status target_after 200

assert_identity_metadata_unchanged \
  target_key_attack_null \
  "${RESULTS}/target_before.json" \
  "${RESULTS}/target_after.json" \
  outreachProjectionKey musicReleaseId versionNumber modifiedAt modifiedById
target_db_after="$(db_scalar "SELECT CONCAT_WS('|', outreach_projection_key, music_release_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM target_list WHERE id='${target_list_id}'")"
if [ "$target_db_before" != "$target_db_after" ]; then
  fail target_key_attack_null 'API rejection changed database identity or OCC/audit metadata'
fi
immutable_contract_count=$((immutable_contract_count + 1))

docker exec \
  --env "TARGET_LIST_ID=${target_list_id}" \
  "$APPLICATION_CONTAINER" \
  php -r '
    require "/var/www/html/bootstrap.php";
    $app = new Espo\Core\Application();
    $app->setupSystemUser();
    $em = $app->getContainer()->getByClass(Espo\Core\ORM\EntityManager::class);
    $entity = $em->getRepository("TargetList")->getById((string) getenv("TARGET_LIST_ID"));
    if (!$entity) { exit(70); }
    $entity->set("outreachProjectionKey", null);
    try {
        $em->saveEntity($entity);
        exit(71);
    } catch (Espo\Core\Exceptions\Forbidden) {
        echo "direct-hook-forbidden\n";
    }
  ' >"${RESULTS}/direct-hook.txt" || fail target_key_attack_null 'direct EntityManager hook bypass was not rejected'

if [ "$(<"${RESULTS}/direct-hook.txt")" != 'direct-hook-forbidden' ]; then
  fail target_key_attack_null 'direct EntityManager hook did not return the expected proof marker'
fi
target_db_after="$(db_scalar "SELECT CONCAT_WS('|', outreach_projection_key, music_release_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM target_list WHERE id='${target_list_id}'")"
if [ "$target_db_before" != "$target_db_after" ]; then
  fail target_key_attack_null 'direct hook rejection changed database identity or OCC/audit metadata'
fi

campaign_payload="$(jq -nc --arg release "$release_id" --arg target "$target_list_id" --arg key "$projection_key" '{name:"API contract Campaign",status:"Planning",type:"Email",musicReleaseId:$release,outreachTargetListId:$target,outreachProjectionKey:$key,outreachManaged:true,targetMembershipProjectionState:"Projected",targetMembershipCount:0}')"
api campaign POST /Campaign "$campaign_payload"
assert_status campaign 200
campaign_id="$(jq -er .id "${RESULTS}/campaign.json")"
api campaign_duplicate POST /Campaign "$campaign_payload"
assert_conflict campaign_duplicate

outlet_payload='{"name":"API contract Outlet","type":"Music Blog","activityStatus":"Active","fingerprint":"1111111111111111111111111111111111111111111111111111111111119981"}'
api outlet POST /MediaOutlet "$outlet_payload"
assert_status outlet 200
outlet_id="$(jq -er .id "${RESULTS}/outlet.json")"
api outlet_duplicate POST /MediaOutlet "$outlet_payload"
assert_conflict outlet_duplicate

api contact_valid POST /MediaContact "$(jq -nc --arg outlet "$outlet_id" '{firstName:"Valid",lastName:"Contract",showName:"Night Shift",emailAddress:"valid-contract@example.test",contactPurpose:"Explicit Music Submission",contactBasis:"Explicit Submission Address",emailValidationStatus:"Valid",smtpValidationStatus:"Valid",status:"Active",mediaOutletId:$outlet,fingerprint:"2222222222222222222222222222222222222222222222222222222222229981"}')"
assert_status contact_valid 200
jq --exit-status '.showName == "Night Shift"' "${RESULTS}/contact_valid.json" >/dev/null ||
  fail contact_valid 'showName was not persisted through the custom entity contract'
contact_valid_id="$(jq -er .id "${RESULTS}/contact_valid.json")"

api contact_duplicate POST /MediaContact "$(jq -nc --arg outlet "$outlet_id" '{firstName:"Duplicate",lastName:"Contract",emailAddress:"duplicate-contract@example.test",contactPurpose:"Explicit Music Submission",contactBasis:"Explicit Submission Address",emailValidationStatus:"Valid",smtpValidationStatus:"Valid",status:"Active",mediaOutletId:$outlet,fingerprint:"2222222222222222222222222222222222222222222222222222222222229981"}')"
assert_conflict contact_duplicate

api contact_blocked POST /MediaContact "$(jq -nc --arg outlet "$outlet_id" --arg duplicate "$contact_valid_id" '{firstName:"Blocked",lastName:"Contract",emailAddress:"blocked-contract@example.test",contactPurpose:"Blocked",contactBasis:"Blocked",emailValidationStatus:"Invalid",smtpValidationStatus:"Invalid",status:"Blocked",mediaOutletId:$outlet,duplicateOfId:$duplicate,fingerprint:"3333333333333333333333333333333333333333333333333333333333339981"}')"
assert_status contact_blocked 200
contact_blocked_id="$(jq -er .id "${RESULTS}/contact_blocked.json")"

target_relation_params="$(jq -nc --arg id "$contact_valid_id" '{maxSize:2,select:["id"],where:[{type:"equals",attribute:"id",value:$id}]}')"
target_relation_endpoint="/TargetList/${target_list_id}/mediaContacts?searchParams=$(printf '%s' "$target_relation_params" | jq -sRr @uri)"
api target_relation_before GET "$target_relation_endpoint"
assert_status target_relation_before 200
jq --exit-status '((.list // .records // []) | length) == 0' "${RESULTS}/target_relation_before.json" >/dev/null ||
  fail target_relation_before 'TargetList relation fixture was not empty before projection'
api target_relation_create POST "/TargetList/${target_list_id}/mediaContacts" \
  "$(jq -nc --arg id "$contact_valid_id" '{id:$id}')"
assert_status target_relation_create 200
api target_relation_after GET "$target_relation_endpoint"
assert_status target_relation_after 200
jq --exit-status --arg id "$contact_valid_id" \
  '((.list // .records // []) | map(.id)) == [$id]' \
  "${RESULTS}/target_relation_after.json" >/dev/null ||
  fail target_relation_after 'TargetList relation postcondition is not exactly one contact'
api target_relation_replay POST "/TargetList/${target_list_id}/mediaContacts" \
  "$(jq -nc --arg id "$contact_valid_id" '{id:$id}')"
assert_status target_relation_replay 200
api target_relation_replayed GET "$target_relation_endpoint"
assert_status target_relation_replayed 200
jq --exit-status --arg id "$contact_valid_id" \
  '((.list // .records // []) | map(.id)) == [$id]' \
  "${RESULTS}/target_relation_replayed.json" >/dev/null ||
  fail target_relation_replayed 'TargetList relation replay duplicated or lost membership'
relationship_check_count=$((relationship_check_count + 1))

campaign_relation_params="$(jq -nc --arg id "$target_list_id" '{maxSize:2,select:["id"],where:[{type:"equals",attribute:"id",value:$id}]}')"
campaign_relation_endpoint="/Campaign/${campaign_id}/targetLists?searchParams=$(printf '%s' "$campaign_relation_params" | jq -sRr @uri)"
api campaign_relation_before GET "$campaign_relation_endpoint"
assert_status campaign_relation_before 200
jq --exit-status '((.list // .records // []) | length) == 0' "${RESULTS}/campaign_relation_before.json" >/dev/null ||
  fail campaign_relation_before 'Campaign relation fixture was not empty before projection'
api campaign_relation_create POST "/Campaign/${campaign_id}/targetLists" \
  "$(jq -nc --arg id "$target_list_id" '{id:$id}')"
assert_status campaign_relation_create 200
api campaign_relation_after GET "$campaign_relation_endpoint"
assert_status campaign_relation_after 200
jq --exit-status --arg id "$target_list_id" \
  '((.list // .records // []) | map(.id)) == [$id]' \
  "${RESULTS}/campaign_relation_after.json" >/dev/null ||
  fail campaign_relation_after 'Campaign relation postcondition is not exactly one TargetList'
api campaign_relation_replay POST "/Campaign/${campaign_id}/targetLists" \
  "$(jq -nc --arg id "$target_list_id" '{id:$id}')"
assert_status campaign_relation_replay 200
api campaign_relation_replayed GET "$campaign_relation_endpoint"
assert_status campaign_relation_replayed 200
jq --exit-status --arg id "$target_list_id" \
  '((.list // .records // []) | map(.id)) == [$id]' \
  "${RESULTS}/campaign_relation_replayed.json" >/dev/null ||
  fail campaign_relation_replayed 'Campaign relation replay duplicated or lost TargetList membership'
relationship_check_count=$((relationship_check_count + 1))

api target_campaign_before GET "/TargetList/${target_list_id}"
assert_status target_campaign_before 200
target_campaign_version="$(jq -er .versionNumber "${RESULTS}/target_campaign_before.json")"
api target_campaign_link PUT "/TargetList/${target_list_id}" \
  "$(jq -nc --arg id "$campaign_id" '{outreachCampaignId:$id,membershipProjectedAt:"2026-07-15 09:30:00"}')" \
  "$target_campaign_version"
assert_status target_campaign_link 200
api target_campaign_after GET "/TargetList/${target_list_id}"
assert_status target_campaign_after 200
jq --exit-status --arg id "$campaign_id" '.outreachCampaignId == $id' \
  "${RESULTS}/target_campaign_after.json" >/dev/null ||
  fail target_campaign_after 'TargetList single-assignment campaign relation was not persisted'
relationship_check_count=$((relationship_check_count + 1))
successful_update_count=$((successful_update_count + 1))

match_base="$(jq -nc --arg release "$release_id" --arg campaign "$campaign_id" --arg contact "$contact_valid_id" --arg outlet "$outlet_id" '{name:"API contract eligible match",musicReleaseId:$release,campaignId:$campaign,mediaContactId:$contact,mediaOutletId:$outlet,matchScore:90,eligibilityStatus:"Eligible",campaignStatus:"New",idempotencyKey:"api-contract-match-eligible-9981"}')"
api match_eligible POST /OutreachMatch "$match_base"
assert_status match_eligible 200
match_eligible_id="$(jq -er .id "${RESULTS}/match_eligible.json")"
api match_duplicate POST /OutreachMatch "$match_base"
assert_conflict match_duplicate

api match_before GET "/OutreachMatch/${match_eligible_id}"
assert_status match_before 200
match_version="$(jq -er .versionNumber "${RESULTS}/match_before.json")"
match_db_before="$(db_scalar "SELECT CONCAT_WS('|', music_release_id, media_contact_id, media_outlet_id, idempotency_key, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_match WHERE id='${match_eligible_id}'")"
api match_key_attack_null PUT "/OutreachMatch/${match_eligible_id}" '{"idempotencyKey":null}' "$match_version"
assert_forbidden match_key_attack_null
api match_key_attack_empty PUT "/OutreachMatch/${match_eligible_id}" '{"idempotencyKey":""}' "$match_version"
assert_forbidden match_key_attack_empty
api match_key_attack_changed PUT "/OutreachMatch/${match_eligible_id}" '{"idempotencyKey":"attacker-controlled"}' "$match_version"
assert_forbidden match_key_attack_changed
api match_after GET "/OutreachMatch/${match_eligible_id}"
assert_status match_after 200
assert_identity_metadata_unchanged \
  match_key_attack_null \
  "${RESULTS}/match_before.json" \
  "${RESULTS}/match_after.json" \
  musicReleaseId mediaContactId mediaOutletId idempotencyKey versionNumber modifiedAt modifiedById
match_db_after="$(db_scalar "SELECT CONCAT_WS('|', music_release_id, media_contact_id, media_outlet_id, idempotency_key, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_match WHERE id='${match_eligible_id}'")"
if [ "$match_db_before" != "$match_db_after" ]; then
  fail match_key_attack_null 'custom-entity API rejection changed database identity or OCC/audit metadata'
fi
immutable_contract_count=$((immutable_contract_count + 1))

api match_blocked POST /OutreachMatch "$(jq -nc --arg release "$release_id" --arg campaign "$campaign_id" --arg contact "$contact_blocked_id" --arg outlet "$outlet_id" '{name:"API contract blocked match",musicReleaseId:$release,campaignId:$campaign,mediaContactId:$contact,mediaOutletId:$outlet,matchScore:-100,eligibilityStatus:"Blocked",campaignStatus:"New",idempotencyKey:"api-contract-match-blocked-9981"}')"
assert_status match_blocked 200

contract_timestamp="$(node -e 'process.stdout.write(new Date().toISOString().slice(0,19).replace("T"," "))')"
email_projection_key='send:11111111-1111-4111-8111-111111119981'
email_payload="$(jq -nc \
  --arg accepted "$contract_timestamp" \
  --arg campaign "$campaign_id" \
  --arg contact "$contact_valid_id" \
  --arg key "$email_projection_key" \
  --arg match "$match_eligible_id" \
  --arg outlet "$outlet_id" \
  --arg release "$release_id" \
  '{
    name:"API contract sent email",
    status:"Sent",
    dateSent:$accepted,
    from:"music@marcsmusic.test",
    fromString:"music@marcsmusic.test",
    to:"valid-contract@example.test",
    body:"API contract immutable delivery receipt.",
    isHtml:false,
    parentType:"OutreachMatch",
    parentId:$match,
    outreachProjectionKey:$key,
    outreachCorrelationId:"api-contract-correlation-9981",
    outreachProviderMessageId:"provider-message-9981",
    outreachDeterministicMessageId:"<api-contract-9981@marcsmusic.test>",
    outreachAcceptedAt:$accepted,
    outreachAutomaticResponse:false,
    outreachMatchId:$match,
    outreachCampaignId:$campaign,
    musicReleaseId:$release,
    mediaContactId:$contact,
    mediaOutletId:$outlet
  }')"
api email POST /Email "$email_payload"
assert_status email 200
email_id="$(jq -er .id "${RESULTS}/email.json")"
api email_duplicate POST /Email "$email_payload"
assert_conflict email_duplicate

event_payload="$(jq -nc \
  --arg campaign "$campaign_id" \
  --arg contact "$contact_valid_id" \
  --arg email "$email_id" \
  --arg match "$match_eligible_id" \
  --arg occurred "$contract_timestamp" \
  --arg outlet "$outlet_id" \
  --arg release "$release_id" \
  '{
    name:"API contract delivery event",
    outreachMatchId:$match,
    mediaContactId:$contact,
    musicReleaseId:$release,
    mediaOutletId:$outlet,
    campaignId:$campaign,
    emailId:$email,
    eventType:"Sent",
    eventDate:$occurred,
    externalEventId:"api-contract-event-9981",
    correlationId:"api-contract-correlation-9981",
    providerMessageId:"provider-message-9981",
    details:"immutable API contract receipt"
  }')"
api event POST /OutreachEvent "$event_payload"
assert_status event 200
event_id="$(jq -er .id "${RESULTS}/event.json")"
api event_duplicate POST /OutreachEvent "$event_payload"
assert_conflict event_duplicate

opportunity_key="match:${match_eligible_id}"
opportunity_payload="$(jq -nc \
  --arg campaign "$campaign_id" \
  --arg contact "$contact_valid_id" \
  --arg event "$event_id" \
  --arg key "$opportunity_key" \
  --arg match "$match_eligible_id" \
  --arg occurred "$contract_timestamp" \
  --arg outlet "$outlet_id" \
  --arg release "$release_id" \
  '{
    name:"API contract opportunity",
    stage:"Prospecting",
    campaignId:$campaign,
    outreachProjectionKey:$key,
    outreachMatchId:$match,
    musicReleaseId:$release,
    mediaContactId:$contact,
    mediaOutletId:$outlet,
    sourceOutreachEventId:$event,
    latestOutreachEventId:$event,
    outreachInterestStatus:"Warm",
    outreachInterestAt:$occurred,
    outreachRevenueState:"Unspecified"
  }')"
api opportunity POST /Opportunity "$opportunity_payload"
assert_status opportunity 200
opportunity_id="$(jq -er .id "${RESULTS}/opportunity.json")"
api opportunity_duplicate POST /Opportunity "$opportunity_payload"
assert_conflict opportunity_duplicate

suppression_hash='4444444444444444444444444444444444444444444444444444444444449981'
suppression_payload="$(jq -nc \
  --arg contact "$contact_blocked_id" \
  --arg hash "$suppression_hash" \
  --arg occurred "$contract_timestamp" \
  '{
    name:"API contract deny-wins suppression",
    subjectHash:$hash,
    subjectType:"contact",
    reason:"manual_block",
    source:"api-contract-v1",
    active:true,
    suppressedAt:$occurred,
    mediaContactId:$contact
  }')"
api suppression POST /OutreachSuppression "$suppression_payload"
assert_status suppression 200
suppression_id="$(jq -er .id "${RESULTS}/suppression.json")"
api suppression_duplicate POST /OutreachSuppression "$suppression_payload"
assert_conflict suppression_duplicate

report_payload="$(jq -nc --arg generated "$contract_timestamp" '{
  name:"API contract daily report",
  reportDate:"2026-07-15",
  status:"Final",
  generatedAt:$generated,
  newContacts:2,
  validatedContacts:1,
  duplicateContacts:1,
  eligibleContacts:1,
  blockedContacts:1,
  matchesCreated:2,
  failedJobs:0,
  summary:{contract:"api-matrix-v1"}
}')"
api report POST /OutreachDailyReport "$report_payload"
assert_status report 200
report_id="$(jq -er .id "${RESULTS}/report.json")"
api report_duplicate POST /OutreachDailyReport "$report_payload"
assert_conflict report_duplicate

verify_immutable_api_contract \
  release_identity MusicRelease "$release_id" isrc NLAAA2699999 \
  "SELECT CONCAT_WS('|', isrc, version_number, modified_at, COALESCE(modified_by_id,'')) FROM music_release WHERE id='${release_id}'" \
  isrc
verify_immutable_api_contract \
  outlet_identity MediaOutlet "$outlet_id" fingerprint 9999999999999999999999999999999999999999999999999999999999999999 \
  "SELECT CONCAT_WS('|', fingerprint, version_number, modified_at, COALESCE(modified_by_id,'')) FROM media_outlet WHERE id='${outlet_id}'" \
  fingerprint
verify_immutable_api_contract \
  campaign_identity Campaign "$campaign_id" outreachProjectionKey music-release:attacker-controlled \
  "SELECT CONCAT_WS('|', outreach_projection_key, music_release_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM campaign WHERE id='${campaign_id}'" \
  outreachProjectionKey musicReleaseId
verify_immutable_api_contract \
  email_identity Email "$email_id" outreachProjectionKey send:22222222-2222-4222-8222-222222229981 \
  "SELECT CONCAT_WS('|', outreach_projection_key, outreach_correlation_id, outreach_provider_message_id, outreach_deterministic_message_id, outreach_accepted_at, outreach_automatic_response, outreach_match_id, outreach_campaign_id, music_release_id, media_contact_id, media_outlet_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM email WHERE id='${email_id}'" \
  outreachProjectionKey outreachCorrelationId outreachProviderMessageId \
  outreachDeterministicMessageId outreachAcceptedAt outreachAutomaticResponse \
  outreachMatchId outreachCampaignId musicReleaseId mediaContactId mediaOutletId
verify_immutable_api_contract \
  opportunity_identity Opportunity "$opportunity_id" outreachProjectionKey match:attacker-controlled \
  "SELECT CONCAT_WS('|', outreach_projection_key, outreach_match_id, music_release_id, media_contact_id, media_outlet_id, source_outreach_event_id, campaign_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM opportunity WHERE id='${opportunity_id}'" \
  outreachProjectionKey outreachMatchId musicReleaseId mediaContactId mediaOutletId sourceOutreachEventId campaignId
verify_immutable_api_contract \
  event_identity OutreachEvent "$event_id" externalEventId api-contract-event-attacker \
  "SELECT CONCAT_WS('|', outreach_match_id, media_contact_id, music_release_id, media_outlet_id, campaign_id, email_id, external_event_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_event WHERE id='${event_id}'" \
  outreachMatchId mediaContactId musicReleaseId mediaOutletId campaignId emailId externalEventId
verify_immutable_api_contract \
  suppression_identity OutreachSuppression "$suppression_id" subjectHash 5555555555555555555555555555555555555555555555555555555555559981 \
  "SELECT CONCAT_WS('|', subject_hash, subject_type, domain, media_contact_id, media_outlet_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_suppression WHERE id='${suppression_id}'" \
  subjectHash subjectType emailAddress domain mediaContactId mediaOutletId
verify_immutable_api_contract \
  report_identity OutreachDailyReport "$report_id" reportDate 2026-07-14 \
  "SELECT CONCAT_WS('|', report_date, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_daily_report WHERE id='${report_id}'" \
  reportDate

window_start="$(node -e 'const d=new Date(Date.now()-3600000); process.stdout.write(d.toISOString().slice(0,19).replace("T"," "))')"
window_end="$(START="$window_start" node -e 'const d=new Date(process.env.START.replace(" ","T")+"Z"); d.setUTCDate(d.getUTCDate()+1); process.stdout.write(d.toISOString().slice(0,19).replace("T"," "))')"
aggregate_endpoint="/OutreachDailyReport/aggregate?start=${window_start// /%20}&end=${window_end// /%20}"
api aggregate GET "$aggregate_endpoint"
assert_status aggregate 200
jq --exit-status '
  . == {
    newContacts: 2,
    validatedContacts: 1,
    duplicateContacts: 1,
    eligibleContacts: 1,
    blockedContacts: 1,
    matchesCreated: 2
  }
' "${RESULTS}/aggregate.json" >/dev/null || fail aggregate 'seeded aggregate counters do not match the exact fixture'

verify_rejected_update_unchanged \
  release_activation_guard MusicRelease "$release_id" '{"status":"Active"}' \
  "SELECT CONCAT_WS('|', status, epk_attestation_state, epk_manifest_sha256, epk_verified_at, epk_evidence_reference, version_number, modified_at, COALESCE(modified_by_id,'')) FROM music_release WHERE id='${release_id}'" \
  status epkAttestationState epkManifestSha256 epkVerifiedAt epkEvidenceReference
verify_rejected_update_unchanged \
  target_managed_guard TargetList "$target_list_id" '{"outreachManaged":false}' \
  "SELECT CONCAT_WS('|', outreach_projection_key, outreach_managed, music_release_id, outreach_campaign_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM target_list WHERE id='${target_list_id}'" \
  outreachProjectionKey outreachManaged musicReleaseId outreachCampaignId
verify_rejected_update_unchanged \
  target_campaign_reassignment_guard TargetList "$target_list_id" '{"outreachCampaignId":"attacker-controlled"}' \
  "SELECT CONCAT_WS('|', outreach_projection_key, outreach_managed, music_release_id, outreach_campaign_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM target_list WHERE id='${target_list_id}'" \
  outreachProjectionKey outreachManaged musicReleaseId outreachCampaignId
verify_rejected_update_unchanged \
  campaign_managed_guard Campaign "$campaign_id" '{"outreachManaged":false}' \
  "SELECT CONCAT_WS('|', outreach_projection_key, outreach_managed, music_release_id, outreach_target_list_id, target_membership_projection_state, target_membership_count, version_number, modified_at, COALESCE(modified_by_id,'')) FROM campaign WHERE id='${campaign_id}'" \
  outreachProjectionKey outreachManaged musicReleaseId outreachTargetListId targetMembershipProjectionState targetMembershipCount
verify_rejected_update_unchanged \
  campaign_target_reassignment_guard Campaign "$campaign_id" '{"outreachTargetListId":"attacker-controlled"}' \
  "SELECT CONCAT_WS('|', outreach_projection_key, outreach_managed, music_release_id, outreach_target_list_id, target_membership_projection_state, target_membership_count, version_number, modified_at, COALESCE(modified_by_id,'')) FROM campaign WHERE id='${campaign_id}'" \
  outreachProjectionKey outreachManaged musicReleaseId outreachTargetListId targetMembershipProjectionState targetMembershipCount
verify_rejected_update_unchanged \
  match_transition_guard OutreachMatch "$match_eligible_id" '{"campaignStatus":"Sent 1"}' \
  "SELECT CONCAT_WS('|', campaign_status, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_match WHERE id='${match_eligible_id}'" \
  campaignStatus
verify_rejected_update_unchanged \
  email_receipt_guard Email "$email_id" '{"name":"tampered receipt"}' \
  "SELECT CONCAT_WS('|', name, outreach_projection_key, version_number, modified_at, COALESCE(modified_by_id,'')) FROM email WHERE id='${email_id}'" \
  name outreachProjectionKey
verify_rejected_update_unchanged \
  opportunity_interest_guard Opportunity "$opportunity_id" '{"outreachInterestStatus":"Interested"}' \
  "SELECT CONCAT_WS('|', outreach_interest_status, latest_outreach_event_id, outreach_interest_at, version_number, modified_at, COALESCE(modified_by_id,'')) FROM opportunity WHERE id='${opportunity_id}'" \
  outreachInterestStatus latestOutreachEventId outreachInterestAt
verify_rejected_update_unchanged \
  opportunity_campaign_guard Opportunity "$opportunity_id" '{"campaignId":"attacker-controlled"}' \
  "SELECT CONCAT_WS('|', campaign_id, outreach_projection_key, version_number, modified_at, COALESCE(modified_by_id,'')) FROM opportunity WHERE id='${opportunity_id}'" \
  campaignId outreachProjectionKey
verify_rejected_update_unchanged \
  event_append_only_guard OutreachEvent "$event_id" '{"details":"tampered event"}' \
  "SELECT CONCAT_WS('|', details, external_event_id, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_event WHERE id='${event_id}'" \
  details externalEventId
verify_rejected_update_unchanged \
  suppression_deny_wins_guard OutreachSuppression "$suppression_id" '{"active":false}' \
  "SELECT CONCAT_WS('|', active, subject_hash, subject_type, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_suppression WHERE id='${suppression_id}'" \
  active subjectHash subjectType

api match_valid_before GET "/OutreachMatch/${match_eligible_id}"
assert_status match_valid_before 200
match_valid_version="$(jq -er .versionNumber "${RESULTS}/match_valid_before.json")"
api match_valid_eligible PUT "/OutreachMatch/${match_eligible_id}" '{"campaignStatus":"Eligible"}' "$match_valid_version"
assert_status match_valid_eligible 200
api match_valid_ready_before GET "/OutreachMatch/${match_eligible_id}"
assert_status match_valid_ready_before 200
jq --exit-status '.campaignStatus == "Eligible"' "${RESULTS}/match_valid_ready_before.json" >/dev/null ||
  fail match_valid_eligible 'valid New to Eligible transition was not persisted'
match_ready_version="$(jq -er .versionNumber "${RESULTS}/match_valid_ready_before.json")"
api match_valid_ready PUT "/OutreachMatch/${match_eligible_id}" '{"campaignStatus":"Ready"}' "$match_ready_version"
assert_status match_valid_ready 200
api match_valid_after GET "/OutreachMatch/${match_eligible_id}"
assert_status match_valid_after 200
jq --exit-status '.campaignStatus == "Ready"' "${RESULTS}/match_valid_after.json" >/dev/null ||
  fail match_valid_ready 'valid Eligible to Ready transition was not persisted'
successful_update_count=$((successful_update_count + 2))
state_hook_count=$((state_hook_count + 1))

verify_rejected_update_unchanged \
  match_transition_skip_guard OutreachMatch "$match_eligible_id" '{"campaignStatus":"Follow-Up 2"}' \
  "SELECT CONCAT_WS('|', campaign_status, version_number, modified_at, COALESCE(modified_by_id,'')) FROM outreach_match WHERE id='${match_eligible_id}'" \
  campaignStatus

api campaign_drift_before GET "/Campaign/${campaign_id}"
assert_status campaign_drift_before 200
campaign_drift_version="$(jq -er .versionNumber "${RESULTS}/campaign_drift_before.json")"
api campaign_drift PUT "/Campaign/${campaign_id}" '{"targetMembershipProjectionState":"Drifted"}' "$campaign_drift_version"
assert_status campaign_drift 200
successful_update_count=$((successful_update_count + 1))
verify_rejected_update_unchanged \
  campaign_membership_guard Campaign "$campaign_id" '{"targetMembershipCount":99}' \
  "SELECT CONCAT_WS('|', target_membership_projection_state, target_membership_count, version_number, modified_at, COALESCE(modified_by_id,'')) FROM campaign WHERE id='${campaign_id}'" \
  targetMembershipProjectionState targetMembershipCount
api campaign_restore_before GET "/Campaign/${campaign_id}"
assert_status campaign_restore_before 200
campaign_restore_version="$(jq -er .versionNumber "${RESULTS}/campaign_restore_before.json")"
api campaign_restore PUT "/Campaign/${campaign_id}" '{"targetMembershipProjectionState":"Projected","targetMembershipCount":1}' "$campaign_restore_version"
assert_status campaign_restore 200
successful_update_count=$((successful_update_count + 1))

api outlet_update_before GET "/MediaOutlet/${outlet_id}"
assert_status outlet_update_before 200
outlet_update_version="$(jq -er .versionNumber "${RESULTS}/outlet_update_before.json")"
api outlet_update PUT "/MediaOutlet/${outlet_id}" '{"name":"API contract Outlet Updated"}' "$outlet_update_version"
assert_status outlet_update 200
jq --exit-status '.name == "API contract Outlet Updated"' "${RESULTS}/outlet_update.json" >/dev/null ||
  fail outlet_update 'legitimate MediaOutlet mutable update was not persisted'
successful_update_count=$((successful_update_count + 1))

api suppression_update_before GET "/OutreachSuppression/${suppression_id}"
assert_status suppression_update_before 200
suppression_update_version="$(jq -er .versionNumber "${RESULTS}/suppression_update_before.json")"
api suppression_update PUT "/OutreachSuppression/${suppression_id}" '{"reason":"deny_wins_verified"}' "$suppression_update_version"
assert_status suppression_update 200
jq --exit-status '.reason == "deny_wins_verified"' "${RESULTS}/suppression_update.json" >/dev/null ||
  fail suppression_update 'legitimate suppression evidence update was not persisted'
successful_update_count=$((successful_update_count + 1))

api report_update_before GET "/OutreachDailyReport/${report_id}"
assert_status report_update_before 200
report_update_version="$(jq -er .versionNumber "${RESULTS}/report_update_before.json")"
api report_update PUT "/OutreachDailyReport/${report_id}" '{"failedJobs":1}' "$report_update_version"
assert_status report_update 200
jq --exit-status '.failedJobs == 1' "${RESULTS}/report_update.json" >/dev/null ||
  fail report_update 'legitimate daily-report recomputation update was not persisted'
successful_update_count=$((successful_update_count + 1))

verify_forbidden_delete \
  target_delete_guard TargetList "$target_list_id" \
  "SELECT CONCAT_WS('|', deleted, version_number, modified_at) FROM target_list WHERE id='${target_list_id}'"
verify_forbidden_delete \
  campaign_delete_guard Campaign "$campaign_id" \
  "SELECT CONCAT_WS('|', deleted, version_number, modified_at) FROM campaign WHERE id='${campaign_id}'"
verify_forbidden_delete \
  email_delete_guard Email "$email_id" \
  "SELECT CONCAT_WS('|', deleted, version_number, modified_at) FROM email WHERE id='${email_id}'"
verify_forbidden_delete \
  opportunity_delete_guard Opportunity "$opportunity_id" \
  "SELECT CONCAT_WS('|', deleted, version_number, modified_at) FROM opportunity WHERE id='${opportunity_id}'"
verify_forbidden_delete \
  event_delete_guard OutreachEvent "$event_id" \
  "SELECT CONCAT_WS('|', deleted, version_number, modified_at) FROM outreach_event WHERE id='${event_id}'"
verify_forbidden_delete \
  suppression_delete_guard OutreachSuppression "$suppression_id" \
  "SELECT CONCAT_WS('|', deleted, version_number, modified_at) FROM outreach_suppression WHERE id='${suppression_id}'"

api role POST /Role '{"name":"API contract aggregate deny","data":{}}'
assert_status role 200
role_id="$(jq -er .id "${RESULTS}/role.json")"
restricted_password="$(openssl rand -hex 24)Aa1!"
api user POST /User "$(jq -nc --arg role "$role_id" --arg password "$restricted_password" '{userName:"api-contract-denied",firstName:"API",lastName:"Denied",type:"regular",isActive:true,password:$password,sendAccessInfo:false,rolesIds:[$role]}')"
assert_status user 200
printf 'user = "api-contract-denied:%s"\nsilent\nshow-error\n' "$restricted_password" >"${temporary_root}/restricted.curlrc"
chmod 0600 "${temporary_root}/restricted.curlrc"

call_count=$((call_count + 1))
curl \
  --config "${temporary_root}/restricted.curlrc" \
  --dump-header "${RESULTS}/aggregate_denied.headers" \
  --output "${RESULTS}/aggregate_denied.json" \
  --write-out '%{http_code}' \
  "${BASE_URL}${aggregate_endpoint}" >"${RESULTS}/aggregate_denied.status"
assert_status aggregate_denied 403

docker exec "$APPLICATION_CONTAINER" php -r '
  require "/var/www/html/bootstrap.php";
  $app = new Espo\Core\Application();
  $app->setupSystemUser();
  $services = $app->getContainer()->getByClass(Espo\Core\Record\ServiceContainer::class);
  foreach (["MusicRelease", "TargetList", "Campaign", "Opportunity", "Email", "MediaContact", "MediaOutlet", "OutreachEvent", "OutreachMatch", "OutreachSuppression", "OutreachDailyReport"] as $type) {
      $service = $services->get($type);
      if (!str_starts_with(get_class($service), "Espo\\Modules\\MarcsMusicOutreach\\Services\\")) { exit(72); }
      if ($type === "Email" && !$service instanceof Espo\Services\Email) { exit(73); }
  }
  echo "service-classmap-ok\n";
' >"${RESULTS}/service-classmap.txt" || fail app_user 'custom service classmap is incomplete'

if [ "$(<"${RESULTS}/service-classmap.txt")" != 'service-classmap-ok' ]; then
  fail app_user 'custom service classmap proof marker is absent'
fi

expected_indexes=16
actual_indexes="$(db_scalar "SELECT COUNT(DISTINCT CONCAT(table_name, '.', index_name)) FROM information_schema.statistics WHERE table_schema=DATABASE() AND non_unique=0 AND index_name IN ('UNIQ_ISRC','UNIQ_MUSIC_RELEASE','UNIQ_OUTREACH_PROJECTION_KEY','UNIQ_OUTREACH_CORRELATION_ID','UNIQ_OUTREACH_MATCH','UNIQ_SOURCE_OUTREACH_EVENT','UNIQ_FINGERPRINT','UNIQ_EXTERNAL_EVENT_ID','UNIQ_IDEMPOTENCY_KEY','UNIQ_SUBJECT_HASH','UNIQ_REPORT_DATE') AND table_name IN ('music_release','target_list','campaign','opportunity','email','media_contact','media_outlet','outreach_event','outreach_match','outreach_suppression','outreach_daily_report')")"
if [ "$actual_indexes" -ne "$expected_indexes" ]; then
  fail app_user "unique schema index contract is incomplete (${actual_indexes}/${expected_indexes})"
fi

if [ "$(db_scalar "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='media_contact' AND column_name='show_name' AND data_type='varchar' AND character_maximum_length=180")" != 1 ]; then
  fail app_user 'MediaContact showName schema contract is absent or malformed'
fi
if [ "$conflict_count" -ne 11 ]; then
  fail app_user "unique conflict coverage is incomplete (${conflict_count}/11 entity services)"
fi
if [ "$immutable_contract_count" -ne 10 ]; then
  fail app_user "immutable API coverage is incomplete (${immutable_contract_count}/10 guarded entity services)"
fi
if [ "$relationship_check_count" -ne 3 ]; then
  fail app_user "relationship coverage is incomplete (${relationship_check_count}/3 projection contracts)"
fi
if [ "$state_hook_count" -lt 20 ]; then
  fail app_user "state-hook coverage is incomplete (${state_hook_count}/20 minimum contracts)"
fi
if [ "$successful_update_count" -lt 8 ]; then
  fail app_user "legitimate mutable-update coverage is incomplete (${successful_update_count}/8 minimum transitions)"
fi
if [ "$call_count" -lt 82 ]; then
  fail app_user "live API matrix is too small (${call_count}/82 minimum requests)"
fi

printf 'API contract verification passed: %s HTTP requests.\n' "$call_count"
printf 'Coverage: 11/11 unique services, 10/10 immutable services, 3/3 relationships, %s state guards, %s accepted updates.\n' \
  "$state_hook_count" "$successful_update_count"
