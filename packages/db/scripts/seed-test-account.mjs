/**

 * Creates demo@costmcp.test with seeded spend data that exercises every

 * dashboard surface: all period pills, budget states, allocation types,

 * project breakdown, ledger rows, org table edge cases, and chart density.

 *

 * Run: pnpm seed:test

 */

import { createClient } from "@supabase/supabase-js";



const SUPABASE_URL = process.env.SUPABASE_URL;

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;



if (!SUPABASE_URL || !SERVICE_KEY) {

  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  process.exit(1);

}



const TEST_EMAIL = "demo@costmcp.test";

const TEST_PASSWORD = "TestCostMCP2026!";

const TEST_NAME = "Demo Builder";



const admin = createClient(SUPABASE_URL, SERVICE_KEY, {

  auth: { persistSession: false, autoRefreshToken: false },

});



/** N days before today at a given UTC hour (for period filters). */

function daysAgo(n, hour = 12) {

  const d = new Date();

  d.setUTCDate(d.getUTCDate() - n);

  d.setUTCHours(hour, 0, 0, 0);

  return d.toISOString();

}



/** Day-of-current-month (1–31); clamps to today if the day hasn't occurred yet. */

function dayThisMonth(day, hour = 12) {

  const now = new Date();

  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, 0, 0, 0));

  if (d > now) {

    d.setUTCDate(now.getUTCDate());

    d.setUTCHours(hour, 0, 0, 0);

  }

  return d.toISOString();

}



async function findUserByEmail(email) {

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });

  if (error) throw error;

  return data.users.find((u) => u.email === email) ?? null;

}



async function main() {

  let user = await findUserByEmail(TEST_EMAIL);



  if (user) {

    console.log("Removing existing test user…");

    await admin.auth.admin.deleteUser(user.id);

    await new Promise((r) => setTimeout(r, 500));

  }



  const { data: created, error: createError } = await admin.auth.admin.createUser({

    email: TEST_EMAIL,

    password: TEST_PASSWORD,

    email_confirm: true,

    user_metadata: { display_name: TEST_NAME },

  });

  if (createError) throw createError;

  user = created.user;

  console.log("Created user:", user.id);



  await new Promise((r) => setTimeout(r, 800));



  const { data: profile, error: profileError } = await admin

    .from("profiles")

    .select("default_workspace_id")

    .eq("id", user.id)

    .single();

  if (profileError) throw profileError;



  const workspaceId = profile.default_workspace_id;

  if (!workspaceId) throw new Error("No default workspace");



  // Stable slug for docs / bookmarks (avoid demo-builder-xxxx from signup collision)
  await admin
    .from("workspaces")
    .update({ slug: `retired-${Date.now()}` })
    .eq("slug", "demo-builder")
    .neq("id", workspaceId);

  await admin
    .from("workspaces")
    .update({ name: "Demo Builder", slug: "demo-builder", type: "personal" })
    .eq("id", workspaceId);



  const { data: workspace } = await admin

    .from("workspaces")

    .select("id, slug, name")

    .eq("id", workspaceId)

    .single();



  console.log("Workspace:", workspace?.name, workspace?.slug);



  const { data: collections } = await admin

    .from("collections")

    .select("id, slug")

    .eq("workspace_id", workspaceId);



  const productionId = collections?.find((c) => c.slug === "production")?.id ?? null;

  const experimentsId = collections?.find((c) => c.slug === "experiments")?.id ?? null;



  // Empty collection — org table "No projects" row

  await admin.from("collections").upsert(

    {

      workspace_id: workspaceId,

      name: "Archived",

      slug: "archived",

      description: "Retired projects (empty)",

      sort_order: 2,

    },

    { onConflict: "workspace_id,slug" },

  );



  const projectDefs = [

    {

      slug: "slideshow-studio",

      name: "Slideshow Studio",

      collection_id: productionId,

      budget: 200,

      environment: "production",

    },

    {

      slug: "progressgoat",

      name: "ProgressGoat",

      collection_id: productionId,

      budget: 100,

      environment: "production",

    },

    {

      slug: "youtube-pipeline",

      name: "YouTube Pipeline",

      collection_id: productionId,

      budget: 150,

      environment: "staging",

    },

    {

      slug: "ai-experiments",

      name: "AI Experiments",

      collection_id: experimentsId,

      budget: 50,

      environment: "development",

    },

    {

      slug: "content-hub",

      name: "Content Hub",

      collection_id: experimentsId,

      budget: 75,

      environment: "staging",

    },

    {

      slug: "internal-tools",

      name: "Internal Tools",

      collection_id: null,

      budget: null,

      environment: "other",

    },

  ];



  const projectIds = {};

  const projectEnvs = {};

  for (const p of projectDefs) {

    const { data, error } = await admin

      .from("projects")

      .upsert(

        {

          workspace_id: workspaceId,

          slug: p.slug,

          name: p.name,

          collection_id: p.collection_id,

          budget: p.budget,

          environment: p.environment,

        },

        { onConflict: "workspace_id,slug" },

      )

      .select("id, slug")

      .single();

    if (error) throw error;

    projectIds[p.slug] = data.id;

    projectEnvs[p.slug] = p.environment;

  }



  // Vendors — each category maps to a distinct org color in the dashboard

  const vendorDefs = [

    { slug: "openai", name: "OpenAI", category: "llm" },

    { slug: "anthropic", name: "Anthropic", category: "llm" },

    { slug: "elevenlabs", name: "ElevenLabs", category: "voice" },

    { slug: "fish", name: "Fish Audio", category: "voice" },

    { slug: "kling", name: "Kling", category: "video" },

    { slug: "runway", name: "Runway", category: "video" },

    { slug: "cursor", name: "Cursor", category: "ide" },

    { slug: "modal", name: "Modal", category: "gpu" },

    { slug: "notion", name: "Notion", category: "saas" },

  ];

  for (const v of vendorDefs) {

    await admin.from("vendors").upsert(

      { workspace_id: workspaceId, slug: v.slug, name: v.name, category: v.category },

      { onConflict: "workspace_id,slug" },

    );

  }



  const { data: categories } = await admin

    .from("cost_categories")

    .select("id, slug")

    .eq("workspace_id", workspaceId);

  const categoryBySlug = Object.fromEntries((categories ?? []).map((c) => [c.slug, c.id]));



  function resolveCategory(message) {

    if (message.category) return categoryBySlug[message.category] ?? null;

    if (message.type === "subscription") return categoryBySlug.subscriptions ?? null;

    if (message.type === "expense") return categoryBySlug.other ?? null;

    if (message.feature?.includes("voice")) return categoryBySlug["voice-audio"] ?? null;

    if (message.feature?.includes("video") || message.feature?.includes("thumbnail")) {

      return categoryBySlug["image-generation"] ?? null;

    }

    return categoryBySlug["llm-tokens"] ?? null;

  }



  await admin.from("cost_messages").delete().eq("workspace_id", workspaceId);



  /**

   * Message seed plan:

   * - `when`: ISO timestamp

   * - Covers: usage / subscription / expense types

   * - Covers: 1D (today), 1W, 1M (this month days 1–6), YTD/All (older)

   * - Covers: all 6 projects + one unassigned row

   */

  const messages = [

    // ── This month (Jul 1–6) — month / quarter / week / day views ──

    { project: "slideshow-studio", type: "usage", amount: 0.04, when: dayThisMonth(1, 9), feature: "slide_generation", provider: "openai", model: "gpt-image-2", category: "image-generation", tags: ["production", "images"], description: "Hero slide batch for launch deck" },

    { project: "slideshow-studio", type: "usage", amount: 0.12, when: dayThisMonth(1, 15), feature: "slide_generation", provider: "openai", model: "gpt-image-2", description: "Follow-up variants for A/B test" },

    { project: "progressgoat", type: "usage", amount: 1.24, when: dayThisMonth(2, 10), feature: "chat", provider: "openai", model: "gpt-4o", description: "Onboarding copy iteration with product team" },

    { project: "progressgoat", type: "usage", amount: 0.89, when: dayThisMonth(2, 16), feature: "chat", provider: "openai", model: "gpt-4o-mini", description: "Support macro suggestions for help center" },

    { project: "youtube-pipeline", type: "usage", amount: 3.5, when: dayThisMonth(3, 11), feature: "video_gen", provider: "kling", description: "B-roll clips for June product recap" },

    { project: "youtube-pipeline", type: "usage", amount: 2.8, when: dayThisMonth(3, 17), feature: "video_gen", provider: "kling", description: "Short-form teaser for social cutdowns" },

    { project: "youtube-pipeline", type: "expense", amount: 49.0, when: dayThisMonth(3, 18), provider: "elevenlabs", description: "Starter plan credit top-up for YouTube voiceovers" },

    { project: "ai-experiments", type: "usage", amount: 0.22, when: dayThisMonth(4, 9), feature: "prototype", provider: "openai", model: "gpt-4o-mini", description: "RAG prompt tuning for internal wiki bot" },

    { project: "ai-experiments", type: "usage", amount: 0.18, when: dayThisMonth(4, 14), feature: "prototype", provider: "openai", model: "gpt-4o-mini", description: "Second-pass eval on retrieval quality" },

    { project: "content-hub", type: "usage", amount: 0.55, when: dayThisMonth(4, 16), feature: "drafting", provider: "anthropic", model: "claude-sonnet", description: "Long-form blog draft for launch announcement" },

    { project: "content-hub", type: "usage", amount: 0.41, when: dayThisMonth(5, 10), feature: "drafting", provider: "anthropic", model: "claude-haiku", description: "Newsletter outline and subject line variants" },

    { project: "slideshow-studio", type: "usage", amount: 0.08, when: dayThisMonth(5, 13), feature: "voiceover", provider: "elevenlabs", description: "Narration pass for investor deck video" },

    { project: "slideshow-studio", type: "usage", amount: 0.06, when: dayThisMonth(5, 17), feature: "slide_generation", provider: "openai", model: "gpt-4o-mini", description: "Caption text cleanup for export" },

    { project: "progressgoat", type: "usage", amount: 2.15, when: dayThisMonth(6, 8), feature: "embeddings", provider: "openai", description: "Re-indexed help docs after taxonomy change" },

    { project: "progressgoat", type: "usage", amount: 0.45, when: dayThisMonth(6, 11), feature: "chat", provider: "anthropic", model: "claude-sonnet", description: "Escalation triage assistant for support queue" },

    { project: "internal-tools", type: "usage", amount: 0.33, when: dayThisMonth(6, 13), feature: "lint_bot", provider: "openai", model: "gpt-4o-mini", description: "PR review comments on shared component library" },

    { project: "youtube-pipeline", type: "usage", amount: 1.9, when: dayThisMonth(6, 14), feature: "thumbnail", provider: "openai", model: "gpt-image-2", description: "Thumbnail concepts for weekly upload series" },

    { project: "ai-experiments", type: "expense", amount: 15.0, when: dayThisMonth(6, 15), provider: "modal", description: "GPU runtime credits for overnight eval jobs" },

    // Subscriptions — allocation bar segment

    { project: "slideshow-studio", type: "subscription", amount: 20.0, when: dayThisMonth(1, 8), provider: "cursor", description: "Pro seat for slideshow-studio maintainers" },

    { project: "progressgoat", type: "subscription", amount: 20.0, when: dayThisMonth(1, 8), provider: "cursor", description: "Pro seat shared across progressgoat squad" },

    { project: "content-hub", type: "subscription", amount: 12.0, when: dayThisMonth(1, 8), provider: "notion", description: "Notion AI add-on for editorial workflow" },

    // Today only — 1D pill

    { project: "slideshow-studio", type: "usage", amount: 0.15, when: daysAgo(0, 9), feature: "slide_generation", provider: "openai", model: "gpt-image-2", description: "Final polish pass on Q3 roadmap slides" },

    { project: "progressgoat", type: "usage", amount: 1.02, when: daysAgo(0, 14), feature: "chat", provider: "openai", model: "gpt-4o", description: "Live chat summarization for standup notes" },

    { project: "content-hub", type: "usage", amount: 0.28, when: daysAgo(0, 16), feature: "seo_scan", provider: "openai", model: "gpt-4o-mini", description: "Weekly keyword gap scan for pillar pages" },

    // Unassigned — ledger + breakdown "Unassigned"

    { project: null, type: "usage", amount: 0.05, when: daysAgo(0, 17), feature: "orphan_call", provider: "openai", model: "gpt-4o-mini", description: "Ad-hoc API call before project tag was added" },



    // ── Prior months — YTD / All period pills ──

    { project: "slideshow-studio", type: "usage", amount: 0.11, when: daysAgo(25, 12), feature: "slide_generation", provider: "openai", model: "gpt-image-2", description: "Template refresh for customer stories deck" },

    { project: "progressgoat", type: "usage", amount: 0.67, when: daysAgo(25, 14), feature: "chat", provider: "openai", model: "gpt-4o-mini", description: "FAQ expansion for billing help articles" },

    { project: "youtube-pipeline", type: "usage", amount: 4.2, when: daysAgo(40, 10), feature: "video_gen", provider: "kling", description: "Launch recap montage for YouTube main channel" },

    { project: "youtube-pipeline", type: "expense", amount: 29.0, when: daysAgo(40, 11), provider: "runway", description: "One-time video gen credits for spring campaign" },

    { project: "ai-experiments", type: "usage", amount: 0.31, when: daysAgo(55, 10), feature: "rag_test", provider: "openai", description: "Baseline retrieval benchmark on wiki corpus" },

    { project: "content-hub", type: "usage", amount: 0.19, when: daysAgo(55, 12), feature: "drafting", provider: "anthropic", model: "claude-haiku", description: "Short social copy for feature launch thread" },

    { project: "slideshow-studio", type: "subscription", amount: 20.0, when: daysAgo(60, 8), provider: "cursor", description: "May billing cycle — slideshow-studio seat" },

    { project: "progressgoat", type: "subscription", amount: 20.0, when: daysAgo(60, 8), provider: "cursor", description: "May billing cycle — progressgoat seat" },

    { project: "internal-tools", type: "usage", amount: 0.12, when: daysAgo(75, 11), feature: "lint_bot", provider: "openai", model: "gpt-4o-mini", description: "Style guide enforcement on docs site PRs" },

    { project: "youtube-pipeline", type: "usage", amount: 1.75, when: daysAgo(90, 10), feature: "video_gen", provider: "kling", description: "Tutorial series intro animations" },

    { project: "ai-experiments", type: "expense", amount: 10.0, when: daysAgo(90, 11), provider: "modal", description: "Sandbox GPU credits for model comparison runs" },

    { project: "slideshow-studio", type: "usage", amount: 0.09, when: daysAgo(120, 10), feature: "voiceover", provider: "fish", description: "Alternate voice take for product demo clip" },

    { project: "progressgoat", type: "usage", amount: 0.38, when: daysAgo(120, 12), feature: "chat", provider: "anthropic", model: "claude-sonnet", description: "Churn-risk outreach email drafts" },

    { project: "content-hub", type: "usage", amount: 0.24, when: daysAgo(150, 10), feature: "drafting", provider: "openai", model: "gpt-4o-mini", description: "Case study outline for enterprise customer" },

    { project: "youtube-pipeline", type: "subscription", amount: 15.0, when: daysAgo(150, 8), provider: "kling", description: "Monthly Kling plan for pipeline automation" },

  ];



  const providerNames = Object.fromEntries(vendorDefs.map((v) => [v.slug, v.name]));



  function buildMetadata(m) {

    const base = { seeded: true };

    if (m.type === "usage") {

      return {

        ...base,

        provider: m.provider ?? null,

        model: m.model ?? null,

        ...(m.description ? { notes: m.description } : {}),

      };

    }

    if (m.type === "expense") {

      return {

        ...base,

        vendor: providerNames[m.provider] ?? m.provider ?? "Unknown",

        expense_type: m.expense_type ?? "one_time_purchase",

        ...(m.category ? { category: m.category } : {}),

        ...(m.description ? { notes: m.description } : {}),

      };

    }

    if (m.type === "subscription") {

      return {

        ...base,

        vendor: providerNames[m.provider] ?? m.provider ?? "Unknown",

        interval: m.interval ?? "monthly",

        status: m.status ?? "active",

        ...(m.category ? { category: m.category } : {}),

        ...(m.description ? { notes: m.description } : {}),

      };

    }

    return base;

  }



  const rows = messages.map((m, i) => ({

    workspace_id: workspaceId,

    project_id: m.project ? projectIds[m.project] : null,

    message_type: m.type,

    amount_usd: m.amount,

    currency: "USD",

    feature: m.feature ?? null,

    environment: m.project ? projectEnvs[m.project] : "production",

    source: "api",

    metadata: buildMetadata(m),

    cost_category_id: resolveCategory(m),

    tags: m.tags ?? (m.provider ? [m.provider, m.type] : [m.type]),

    created_at: m.when,

    idempotency_key: `seed-${workspaceId}-${i}`,

  }));



  const { error: insertError } = await admin.from("cost_messages").insert(rows);

  if (insertError) throw insertError;



  // Over-budget cap — danger state on monthly view (~$128 spent vs $115 cap)

  await admin

    .from("budgets")

    .update({ amount: 115, name: "Monthly spend" })

    .eq("workspace_id", workspaceId)

    .eq("scope_type", "global");



  const monthStart = new Date();

  monthStart.setUTCDate(1);

  monthStart.setUTCHours(0, 0, 0, 0);

  const monthRows = rows.filter((r) => new Date(r.created_at) >= monthStart);

  const monthTotal = monthRows.reduce((s, r) => s + r.amount_usd, 0);

  const allTotal = rows.reduce((s, r) => s + r.amount_usd, 0);



  console.log("\n✅ Test account ready\n");

  console.log("  Email:       ", TEST_EMAIL);

  console.log("  Password:    ", TEST_PASSWORD);

  console.log("  Workspace:   ", workspace?.slug);

  console.log("  Messages:    ", rows.length, "total,", monthRows.length, "this month");

  console.log("  Month total: ", `$${monthTotal.toFixed(2)}`, "(budget $115 → over budget)");

  console.log("  All-time:    ", `$${allTotal.toFixed(2)}`);

  console.log("\n  Display coverage:");

  console.log("    • Period pills: 1D / 1W / 1M / 3M / YTD / All");

  console.log("    • Allocation: usage + subscription + expense");

  console.log("    • Budget: over-budget (danger) on monthly view");

  console.log("    • Projects: 6 ranked + 1 unassigned charge");

  console.log("    • Org: 2 collections w/ projects, 1 empty, 1 ungrouped");

  console.log("    • Environments: production, staging, development, other");

  console.log("    • Vendors: 9 across llm / voice / video / ide / gpu / saas");

  console.log("    • Ledger: 20+ rows with colored type + project labels");

  console.log("    • Descriptions: notes on usage, expense, and subscription rows");

  console.log("\n  Login:       http://localhost:3001/login");

  console.log(`  Dashboard:   http://localhost:3001/dashboard/${workspace?.slug}`);

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});


