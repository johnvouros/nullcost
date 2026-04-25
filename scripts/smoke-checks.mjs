#!/usr/bin/env node

import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvFile(path = ".env.local") {
  try {
    const content = readFileSync(path, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      process.env[key.trim()] ||= rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Optional local convenience only.
  }
}

loadEnvFile();

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONTRIBUTOR_PROVIDER_CANDIDATES = [
  "mailersend",
  "descope",
  "kinde",
  "workos",
  "pipedream",
  "windmill",
  "koyeb",
  "posthog",
];

function createServiceSupabaseClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for smoke checks.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchExpect(pathname, options = {}) {
  try {
    return await fetch(`${BASE_URL}${pathname}`, {
      redirect: "manual",
      ...options,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to reach ${BASE_URL}${pathname}. Start the site first. ${message}`);
  }
}

async function postJson(pathname, body, options = {}) {
  const response = await fetchExpect(pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...options,
  });

  const payload = await response.json();
  return { response, payload };
}

async function fetchJson(pathname) {
  const response = await fetchExpect(pathname);
  assert.equal(response.ok, true, `${pathname} should return 2xx, got ${response.status}`);
  return response.json();
}

function ok(message) {
  console.log(`[ok] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertObjectOmitsKeys(value, disallowedKeys, context = "payload") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertObjectOmitsKeys(item, disallowedKeys, `${context}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.ok(!disallowedKeys.includes(key), `${context} should not expose "${key}"`);
    assertObjectOmitsKeys(child, disallowedKeys, `${context}.${key}`);
  }
}

async function waitFor(fn, { attempts = 10, delayMs = 150, label = "condition" } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await fn();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  const suffix = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

async function checkSiteRoutes() {
  const home = await fetchExpect("/");
  assert.equal(home.status, 200, `/ should return 200, got ${home.status}`);
  ok("home page loads");

  const dashboard = await fetchExpect("/dashboard");
  assert.equal(dashboard.status, 307, `/dashboard should redirect when signed out, got ${dashboard.status}`);
  assert.match(dashboard.headers.get("location") ?? "", /^\/auth\?next=%2Fdashboard/, "dashboard redirect location should target auth");
  ok("dashboard redirects signed-out users to auth");

  const route = await fetchExpect("/go/vercel");
  assert.equal(route.status, 307, `/go/vercel should redirect, got ${route.status}`);
  assert.ok((route.headers.get("location") ?? "").length > 0, "router redirect should include a location");
  ok("referral router resolves vercel");

  const hiddenProviderPage = await fetchExpect("/providers/backblaze-b2");
  assert.equal(hiddenProviderPage.status, 404, `/providers/backblaze-b2 should be hidden from the public site, got ${hiddenProviderPage.status}`);
  ok("paid-only provider pages stay hidden");
}

async function checkApi() {
  const vercel = await fetchJson("/api/providers/vercel");
  assert.equal(vercel.provider.slug, "vercel", "vercel detail should return the vercel provider");
  assert.ok(vercel.bestStartingPlan, "vercel should expose a best starting plan");
  ok("provider detail API returns best starting plan");

  const workos = await fetchJson("/api/providers/workos");
  assert.equal(workos.bestStartingPlan?.name, "AuthKit Free", "workos should default to the practical starter plan");
  assert.ok(
    Array.isArray(workos.plans) &&
      workos.plans.length > 0 &&
      workos.plans.every((plan) => plan.plan_type === "free" || plan.trial_available === true),
    "provider detail should only expose free-entry plans",
  );
  ok("provider detail default plan selection is sane");

  const search = await fetchJson("/api/providers/search?q=hosting&limit=5");
  assert.ok(Array.isArray(search.providers) && search.providers.length > 0, "provider search should return results");
  assert.ok(
    search.providers.every((provider) => provider.free_tier === "yes" || provider.free_trial === "yes"),
    `provider search should only return free-entry providers, got ${search.providers
      .map((provider) => `${provider.slug}:${provider.free_tier}/${provider.free_trial}`)
      .join(", ")}`,
  );
  ok("provider search returns results");

  const hiddenProvider = await fetchExpect("/api/providers/backblaze-b2");
  assert.equal(hiddenProvider.status, 404, `/api/providers/backblaze-b2 should be hidden from the public API, got ${hiddenProvider.status}`);
  ok("paid-only providers stay hidden from the public API");
}

async function pickEmptyContributorProvider() {
  const serviceSupabase = createServiceSupabaseClient();

  for (const slug of CONTRIBUTOR_PROVIDER_CANDIDATES) {
    const directory = await fetchJson(`/api/referrals/providers/${slug}`);
    const { data, error } = await serviceSupabase
      .from("providers")
      .select("id, slug, name, category, subcategory, website, docs_url, pricing_url, signup_url")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      throw new Error(`Failed to load contributor smoke provider identity for ${slug}: ${error?.message ?? "missing row"}`);
    }

    if ((directory.stats?.activeEntries ?? 0) === 0) {
      return data;
    }
  }

  throw new Error(
    `Could not find a contributor smoke-test provider with zero live entries among ${CONTRIBUTOR_PROVIDER_CANDIDATES.join(", ")}`,
  );
}

function getExpectedFallbackUrl(provider) {
  return provider.website || provider.docs_url || provider.pricing_url || provider.signup_url || `${BASE_URL}/providers/${provider.slug}`;
}

function normalizeUrlForCompare(value) {
  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return String(value ?? "");
  }
}

async function ensureWeightedRouterMode(supabase, providerId) {
  const { data, error } = await supabase
    .from("referral_router_controls")
    .select("provider_id, mode, fallback_preference")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to inspect router control: ${error.message}`);
  }

  const previous = data
    ? {
        mode: data.mode,
        fallbackPreference: data.fallback_preference,
      }
    : null;

  if (previous?.mode !== "weighted") {
    const { error: upsertError } = await supabase.from("referral_router_controls").upsert({
      provider_id: providerId,
      mode: "weighted",
      fallback_preference: previous?.fallbackPreference ?? "official",
    });

    if (upsertError) {
      throw new Error(`Failed to set router mode: ${upsertError.message}`);
    }
  }

  return async () => {
    if (previous) {
      await supabase
        .from("referral_router_controls")
        .update({
          mode: previous.mode,
          fallback_preference: previous.fallbackPreference,
        })
        .eq("provider_id", providerId);
      return;
    }

    await supabase.from("referral_router_controls").delete().eq("provider_id", providerId);
  };
}

async function createSmokeContributor() {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `smoke-${nonce}@example.com`;
  const password = `SmokePass!${Math.random().toString(36).slice(2, 10)}A9`;
  const forwardedFor = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
  const { response, payload } = await postJson("/api/auth/sign-up", {
    email,
    password,
    displayName: "Smoke Contributor",
    nextPath: "/dashboard",
    emailRedirectTo: `${BASE_URL}/auth`,
  }, {
    headers: {
      "x-forwarded-for": forwardedFor,
    },
  });

  assert.equal(response.status, 200, `sign-up route should return 200, got ${response.status}`);
  assert.equal(payload.ok, true, "sign-up route should report success");

  return {
    email,
    password,
    displayName: "Smoke Contributor",
    forwardedFor,
  };
}

async function assertContributorCanSignIn(contributor) {
  const { response, payload } = await postJson("/api/auth/sign-in", {
    email: contributor.email,
    password: contributor.password,
    nextPath: "/dashboard",
  }, {
    headers: {
      "x-forwarded-for": contributor.forwardedFor,
    },
  });
  assert.equal(response.status, 200, `sign-in route should return 200, got ${response.status}`);
  assert.equal(payload.ok, true, "sign-in route should report success");
  assert.ok((response.headers.get("set-cookie") ?? "").includes("sb-"), "sign-in route should set a Supabase auth cookie");
}

async function waitForAccountProfile(supabase, contributor) {
  return waitFor(
    async () => {
      const { data, error } = await supabase
        .from("account_profiles")
        .select("id, email, display_name")
        .eq("email", contributor.email)
        .maybeSingle();

      if (error) {
        throw new Error(`Account profile lookup failed: ${error.message}`);
      }

      return data;
    },
    { attempts: 12, delayMs: 200, label: "account profile sync" },
  );
}

async function createContributorProfileAndEntry(supabase, contributor, provider) {
  const profileSlug = `smoke-${contributor.userId.replace(/-/g, "").slice(0, 10)}`;
  const referralUrl = `https://example.com/referrals/${provider.slug}/${profileSlug}`;
  const destinationUrl = `https://example.com/providers/${provider.slug}`;
  const title = `Smoke contributor route for ${provider.name}`;

  const { data: profile, error: profileError } = await supabase
    .from("referral_profiles")
    .insert({
      slug: profileSlug,
      display_name: `${contributor.displayName} ${provider.name}`,
      bio: "Smoke-test contributor profile",
      website: "https://example.com/smoke-contributor",
      status: "active",
    })
    .select("id, slug, display_name")
    .single();

  if (profileError || !profile) {
    throw new Error(`Failed to create smoke contributor profile: ${profileError?.message ?? "missing profile"}`);
  }

  const { error: membershipError } = await supabase.from("profile_memberships").insert({
    profile_id: profile.id,
    account_id: contributor.userId,
    role: "owner",
    status: "active",
    responded_at: new Date().toISOString(),
  });

  if (membershipError) {
    throw new Error(`Failed to create smoke contributor membership: ${membershipError.message}`);
  }

  const { error: privateError } = await supabase.from("referral_profile_private").upsert({
    profile_id: profile.id,
    contact_email: contributor.email,
    default_disclosure: "Smoke referral disclosure",
  });

  if (privateError) {
    throw new Error(`Failed to create smoke private profile settings: ${privateError.message}`);
  }

  const { data: entry, error: entryError } = await supabase
    .from("referral_entries")
    .insert({
      provider_id: provider.id,
      profile_id: profile.id,
      status: "active",
      kind: "referral_link",
      title,
      referral_url: referralUrl,
      destination_url: destinationUrl,
      disclosure: "Smoke referral disclosure",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    throw new Error(`Failed to create smoke contributor entry: ${entryError?.message ?? "missing entry"}`);
  }

  return {
    profileId: profile.id,
    profileSlug: profile.slug,
    entryId: entry.id,
    title,
    referralUrl,
    destinationUrl,
  };
}

async function createSmokeProfileOnly(supabase, contributor, label) {
  const profileSlug = `smoke-${label}-${Math.random().toString(36).slice(2, 8)}`;
  const { data: profile, error: profileError } = await supabase
    .from("referral_profiles")
    .insert({
      slug: profileSlug,
      display_name: `${contributor.displayName} ${label}`,
      bio: "Smoke-test profile",
      website: "https://example.com/smoke-secondary",
      status: "active",
    })
    .select("id, slug")
    .single();

  if (profileError || !profile) {
    throw new Error(`Failed to create smoke-only profile: ${profileError?.message ?? "missing profile"}`);
  }

  const { error: membershipError } = await supabase.from("profile_memberships").insert({
    profile_id: profile.id,
    account_id: contributor.userId,
    role: "owner",
    status: "active",
    responded_at: new Date().toISOString(),
  });

  if (membershipError) {
    throw new Error(`Failed to attach smoke-only membership: ${membershipError.message}`);
  }

  return profile;
}

async function assertDuplicateCodeRejected(supabase, contributor, provider) {
  const secondProfile = await createSmokeProfileOnly(supabase, contributor, "duplicate");

  const { error } = await supabase.from("referral_entries").insert({
    provider_id: provider.id,
    profile_id: secondProfile.id,
    status: "draft",
    kind: "coupon_code",
    referral_code: "SECOND-CODE",
    disclosure: "Duplicate smoke test",
  });

  assert.ok(error, "duplicate provider code should be rejected");
  assert.match(
    error.message,
    /already have a code for this provider/i,
    "duplicate provider code rejection should explain the account-level uniqueness rule",
  );

  return secondProfile.id;
}

async function checkAuthRateLimit() {
  const email = `smoke-auth-rate-${Date.now()}@example.com`;
  const forwardedFor = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
  let invalidAttempts = 0;

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const { response, payload } = await postJson("/api/auth/sign-in", {
      email,
      password: "definitely-wrong-password",
      nextPath: "/dashboard",
    }, {
      headers: {
        "x-forwarded-for": forwardedFor,
      },
    });

    if (response.status === 400) {
      invalidAttempts += 1;
      assert.ok(payload.error, `invalid sign-in attempt ${attempt} should return an auth error`);
      continue;
    }

    assert.equal(response.status, 429, "repeated invalid sign-ins should eventually hit the auth rate limit");
    assert.ok(invalidAttempts >= 1, "the auth rate-limit check should observe at least one normal auth failure before 429");
    assert.equal(payload.code, "rate_limited", "rate-limited auth response should return the public rate-limit code");
    assert.ok(Number(payload.retryAfterSeconds) > 0, "rate-limited auth response should include a retry delay");
    ok("auth rate limiting returns a public 429 after repeated failures");
    return;
  }

  assert.fail("repeated invalid sign-ins should hit the auth rate limit within the smoke window");
}

async function checkContributorFlow() {
  const serviceSupabase = createServiceSupabaseClient();
  const cleanupProfileIds = [];
  let cleanupUserId = null;
  let restoreRouterMode = null;

  try {
    const provider = await pickEmptyContributorProvider();
    restoreRouterMode = await ensureWeightedRouterMode(serviceSupabase, provider.id);
    const contributor = await createSmokeContributor();

    const fallbackResponse = await fetchExpect(`/go/${provider.slug}`);
    assert.equal(fallbackResponse.status, 307, `/go/${provider.slug} should redirect for an empty provider`);
    assert.equal(
      normalizeUrlForCompare(fallbackResponse.headers.get("location")),
      normalizeUrlForCompare(getExpectedFallbackUrl(provider)),
      "empty-provider routing should fall back to the official provider target",
    );
    ok("empty-provider routing falls back to the official provider target");

    await assertContributorCanSignIn(contributor);
    ok("site auth accepts a new contributor account");

    const accountProfile = await waitForAccountProfile(serviceSupabase, contributor);
    cleanupUserId = accountProfile.id;
    assert.equal(accountProfile.email, contributor.email, "account profile should sync auth email");
    ok("account profile sync runs for new auth users");

    const created = await createContributorProfileAndEntry(
      serviceSupabase,
      {
        ...contributor,
        userId: accountProfile.id,
      },
      provider,
    );
    cleanupProfileIds.push(created.profileId);

    const duplicateProfileId = await assertDuplicateCodeRejected(
      serviceSupabase,
      {
        ...contributor,
        userId: accountProfile.id,
      },
      provider,
    );
    cleanupProfileIds.push(duplicateProfileId);
    ok("duplicate provider codes are rejected for the same account");

    const providerDirectory = await fetchJson(`/api/referrals/providers/${provider.slug}`);
    assert.equal(providerDirectory.stats.activeEntries, 1, "provider directory should expose one live contributor entry");
    assert.ok(
      providerDirectory.entries.some(
        (entry) => entry.profile?.slug === created.profileSlug && entry.title === created.title,
      ),
      "provider directory should expose the smoke contributor entry",
    );
    assertObjectOmitsKeys(providerDirectory, ["id", "providerId", "profileId", "entryId", "metadata", "notes", "reviewNote", "contactEmail"], "provider directory");
    ok("provider referral directory exposes the live contributor code");

    const profileDirectory = await fetchJson(`/api/referrals/profiles/${created.profileSlug}`);
    assert.equal(profileDirectory.stats.activeEntries, 1, "profile directory should expose one live contributor entry");
    assert.ok(
      profileDirectory.entries.some((entry) => entry.provider?.slug === provider.slug && entry.title === created.title),
      "profile directory should expose the provider entry",
    );
    assertObjectOmitsKeys(profileDirectory, ["id", "providerId", "profileId", "entryId", "metadata", "notes", "reviewNote", "contactEmail"], "profile directory");
    ok("public contributor profile exposes the live provider code");

    const resolutionPayload = await fetchJson(`/api/referrals/providers/${provider.slug}/resolve?source=smoke`);
    assert.equal(
      resolutionPayload.resolution?.entry?.resolvedUrl,
      created.referralUrl,
      "referral resolve should pick the smoke contributor link",
    );
    assert.equal(
      resolutionPayload.resolution?.entry?.profile?.slug,
      created.profileSlug,
      "referral resolve should attribute the smoke contributor profile",
    );
    assertObjectOmitsKeys(resolutionPayload, ["id", "providerId", "profileId", "entryId", "metadata", "notes", "reviewNote", "contactEmail"], "referral resolution");
    ok("referral resolver picks the contributor link");

    const redirectResponse = await fetchExpect(`/go/${provider.slug}`);
    assert.equal(redirectResponse.status, 307, `/go/${provider.slug} should redirect for the contributor flow`);
    assert.equal(
      redirectResponse.headers.get("location"),
      created.referralUrl,
      "router redirect should use the contributor referral link",
    );
    ok("referral router redirects to the contributor link");

    const clickResponse = await fetchExpect(`/api/referrals/rotations/${resolutionPayload.resolution.rotationId}/click`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        metadata: {
          source: "smoke",
        },
      }),
    });
    assert.equal(clickResponse.status, 200, "rotation click endpoint should record a redirect event");
    const clickPayload = await clickResponse.json();
    assert.equal(clickPayload.redirectEvent?.recorded, true, "rotation click endpoint should mark the event recorded");
    assertObjectOmitsKeys(clickPayload, ["id", "providerId", "profileId", "entryId", "metadata", "notes", "reviewNote", "contactEmail"], "redirect event");

    const providerDirectoryAfterTraffic = await fetchJson(`/api/referrals/providers/${provider.slug}`);
    assert.ok(
      (providerDirectoryAfterTraffic.stats?.totalCloudbrokerSelections ?? 0) >= 1,
      "provider directory should reflect recorded Nullcost selections",
    );
    assert.ok(
      (providerDirectoryAfterTraffic.stats?.totalCloudbrokerRedirects ?? 0) >= 1,
      "provider directory should reflect recorded Nullcost redirects",
    );
    ok("contributor metrics update after routed traffic");

    await checkAuthRateLimit();
  } finally {
    if (cleanupProfileIds.length > 0) {
      await serviceSupabase.from("referral_profiles").delete().in("id", cleanupProfileIds);
    }

    if (cleanupUserId) {
      await serviceSupabase.auth.admin.deleteUser(cleanupUserId);
    }

    if (restoreRouterMode) {
      await restoreRouterMode();
    }
  }
}

async function withCatalogClient(fn) {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./mcp/referiate-provider-server.mjs"],
    cwd: process.cwd(),
    stderr: "pipe",
  });

  if (transport.stderr) {
    transport.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
  }

  const client = new Client({
    name: "nullcost-smoke",
    version: "0.1.0",
  });

  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    await transport.close();
  }
}

async function callTool(client, name, args) {
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    },
    CallToolResultSchema,
  );

  return result.structuredContent;
}

async function checkMcp() {
  await withCatalogClient(async (client) => {
    const detail = await callTool(client, "get_provider_detail", { id: "workos" });
    assert.equal(detail.provider?.bestStartingPlan?.name, "AuthKit Free", "MCP detail should return the sane starter plan for WorkOS");
    ok("MCP detail returns plan-aware provider detail");

    const workflow = await callTool(client, "recommend_providers", {
      useCase: "workflow engine for a small production team",
      limit: 5,
    });
    const workflowTop = workflow.recommendations?.[0]?.slug ?? "";
    assert.ok(["pipedream", "windmill", "n8n", "n8n-cloud"].includes(workflowTop), `workflow query should return a workflow vendor first, got ${workflowTop}`);
    ok("MCP workflow recommendation stays on-category");

    const email = await callTool(client, "recommend_providers", {
      useCase: "email api for a solo project",
      limit: 3,
    });
    const emailTop = email.recommendations?.[0]?.slug ?? "";
    assert.ok(["resend", "mailgun", "mailersend"].includes(emailTop), `solo email query should favor plan-backed email APIs, got ${emailTop}`);
    ok("MCP solo email recommendation favors practical winners");

    const postgres = await callTool(client, "recommend_providers", {
      useCase: "free tier postgres for a small nextjs saas",
      limit: 5,
      preferFreeTier: true,
      preferLowFriction: true,
      preferSelfServe: true,
    });
    const postgresTop = postgres.recommendations?.[0]?.slug ?? "";
    const postgresTopThree = Array.isArray(postgres.recommendations) ? postgres.recommendations.slice(0, 3) : [];
    assert.ok(["neon", "supabase", "xata", "aiven", "nhost"].includes(postgresTop), `postgres query should return a practical data vendor first, got ${postgresTop}`);
    assert.ok(
      postgresTopThree.every((provider) => provider.category === "data"),
      `postgres query top 3 should stay in data, got ${postgresTopThree.map((provider) => `${provider.slug}:${provider.category}`).join(", ")}`,
    );
    ok("MCP free-tier postgres recommendation stays in the database lane");

    const hosting = await callTool(client, "recommend_providers", {
      useCase: "cheap hosting service with a real free tier for a small saas",
      limit: 3,
      preferFreeTier: true,
      preferLowFriction: true,
      preferSelfServe: true,
    });
    const hostingTop = hosting.recommendations?.[0]?.slug ?? "";
    assert.ok(["vercel", "netlify", "railway", "render", "zeabur", "koyeb"].includes(hostingTop), `hosting query should return a practical app platform first, got ${hostingTop}`);
    ok("MCP free-tier hosting recommendation stays in the hosting lane");

    const stack = await callTool(client, "recommend_stack", {
      useCase: "I am a solo developer shipping a small Next.js SaaS. I need hosting, auth, postgres, and transactional email. Prioritize real free tiers or the best value starter plans.",
      limitPerSlot: 2,
      mode: "fast",
    });
    assert.deepEqual(stack.stack, ["hosting", "auth", "postgres", "email"], "stack recommendation should infer the core SaaS stack");
    const authWinner = stack.winners?.find((slot) => slot.key === "auth")?.winner?.slug ?? "";
    const emailWinner = stack.winners?.find((slot) => slot.key === "email")?.winner?.slug ?? "";
    assert.ok(["clerk", "kinde", "descope", "workos"].includes(authWinner), `stack auth winner should stay in-category, got ${authWinner}`);
    assert.ok(["resend", "mailgun", "mailersend", "postmark"].includes(emailWinner), `stack email winner should stay in-category, got ${emailWinner}`);
    ok("MCP stack recommendation handles a common SaaS stack in one call");
  });
}

async function main() {
  console.log(`Running Nullcost smoke checks against ${BASE_URL}`);
  await checkSiteRoutes();
  await checkApi();
  await checkContributorFlow();
  await checkMcp();
  console.log("Smoke checks passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
