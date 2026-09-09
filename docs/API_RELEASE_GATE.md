# API release verification before web merge and deployment

Task: `SC-AUDIO-ACCEPTANCE-20260909`

The web release binds to one reviewed API commit through
`frontend/src/constants/analyzerIdentity.mjs`. Every web workflow runs
`verify-api` after its build passes, including pull requests, main pushes and
manual runs. This job checks that production serves the candidate's exact API
commit. Pages deployment requires successful `build` and `verify-api` jobs and
is restricted to non-PR runs on main. A skipped, failed or cancelled API check
cannot allow deployment. The PR check remains required before merge under the
delivery workflow, and main repeats it before deploying the merged candidate.

The check belongs to the web repository. The API's Render configuration uses
`autoDeployTrigger: checksPass`, which waits for all API repository CI checks.
A live API verifier attached to the API commit immediately after its tests
could wait for a deployment that is waiting for that verifier. Keep the API's
live verifier manual and run it only after deployment; do not replace this web
gate with an API `workflow_run` observer. See
[Render's CI integration contract](https://render.com/docs/deploys#integrating-with-ci).

## Release order

1. Merge the reviewed API change after its required checks pass.
2. Confirm the exact API merge commit passes merged-main `Test`.
3. Prepare the web release binding to that API merge commit. The web PR's
   `build` and `verify-api` jobs must both succeed on the reviewed candidate.
4. The API gate waits for Render to serve the exact API commit and checks the
   existing public health, readiness, HARRY capability and runtime self-test,
   provider/payment gates, application-root privacy, composition compatibility,
   and six-feature inventory contracts. It also checks the OpenAPI methods for
   the V35 diagnostic POST and HARRY self-test, privacy and provider-gate GETs.
5. Merge the web PR only after those checks pass. The main workflow builds and
   repeats the API gate, then checks deployment bytes, deploys Pages, and
   verifies the exact web and API releases together. A manual run on main uses
   the same order; a manual run on another branch cannot deploy.

The API job needs Node 20 only, uses no provider credential or authentication
token, submits no audio, and performs only the existing public read-only API
probes. It makes no web-page or Clerk requests. Each API request times out after
10 seconds; the workflow allows 30 attempts with 10 seconds between attempts
and a 15-minute job limit. A stale API, unavailable endpoint or failed contract
keeps the gate failed.

Recording identity readiness must be affirmative in this API release gate;
lyric candidate discovery may remain unavailable. The full web maintenance
probe retains its existing readiness interpretation.

`ANALYZER_API_RUNTIME_PROJECTION` pins the application manifest digest, file
count and byte count produced by the API's canonical
`runtime_privacy.expected_source_application_manifest` helper. Validate these
three values against the final API merge tree before publishing the web
binding. The gate validates the pin's shape and compares all three live values
exactly, using the same privacy response as the HARRY check. No extra privacy
request is made, and the receipt includes only these known projection fields.

The same command can be run in a permitted network environment:

```bash
node frontend/scripts/probe-deployment.mjs --api-only --attempts 30 --interval-ms 10000 --output api-release-verification.json
```

The `sonic-check-api-release-gate` artifact records expected/verified API commit,
capture time, validator outcomes and retry count. It omits raw response bodies
and exception messages. Its existing `API_RELEASE_BEFORE_WEB_MERGE` scope label
and schema are retained for compatibility; the same API-only check now also
runs before main/manual deployment. It does not prove web deployment, an authenticated
audio acceptance scan, whole-container identity, scanner accuracy or catalogue
source authority. Those retain their separate acceptance evidence. Public paid
traffic and checkout remain closed.

Both retry modes emit a progress record to stderr when each attempt starts and
finishes. Finished records name failed checks, report the next retry delay and
show only a validated public API commit SHA when one was observed. The observed
SHA is separate from the verified SHA, so a stale release remains a failed
check. Progress contains no response bodies, exception messages or arbitrary
response keys. Stdout and the output artifact retain the existing single final
JSON receipt; progress makes a pending workflow diagnosable without changing
its pass/fail criteria or making extra API requests.

`npm run test:ops` covers API-only request scope, every reused contract's failure
path, recording readiness, required routes, exact source projection, stale
release retry/exhaustion, sanitized receipts and workflow ordering for PR,
main push and manual runs. Regression tests also exercise stderr progress,
hostile diagnostic values and unchanged final receipt serialization.
The existing full production verifier keeps its required web commit check.
