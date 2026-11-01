#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { lookup as dnsLookup, Resolver } from "node:dns/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REGION = process.env.HOSTED_MAIL_AWS_REGION ?? "us-east-1";
const NAME = "rodge-mail";
const CONVEX_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../services/convex",
);
const CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL ?? "https://dazzling-dog-633.convex.site";
const WEBHOOK_PATH = "/providers/hosted/sns";
const MAIL_FROM_SUBDOMAIN = "bounce";
const SPF = "v=spf1 include:amazonses.com ~all";
const DMARC = "v=DMARC1; p=quarantine; adkim=r; aspf=r";

const usage = `Usage:
  node scripts/hosted-mail.mjs bootstrap
  node scripts/hosted-mail.mjs connect
  node scripts/hosted-mail.mjs add-domain <domain> [--force]
  node scripts/hosted-mail.mjs add-address <address> [--name <display name>] [--alias-of <address>]
  node scripts/hosted-mail.mjs send-test <from> <to> [--reply-to <message-id>]
  node scripts/hosted-mail.mjs status [domain]
  node scripts/hosted-mail.mjs import <source address> <hosted address>
  node scripts/hosted-mail.mjs import-status [hosted address]`;

const [command, ...rest] = process.argv.slice(2);
const options = parseOptions(rest);

try {
  if (command === "bootstrap") await bootstrap();
  else if (command === "connect") connect();
  else if (command === "add-domain") await addDomain(options._[0]);
  else if (command === "add-address") addAddress(options._[0]);
  else if (command === "send-test") sendTest(options._[0], options._[1]);
  else if (command === "status") status(options._[0]);
  else if (command === "import") importMail(options._[0], options._[1]);
  else if (command === "import-status") importStatus(options._[0]);
  else {
    console.log(usage);
    process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

async function bootstrap() {
  const accountId = aws(["sts", "get-caller-identity"]).Account;
  const bucket = `${NAME}-${accountId}-${REGION}`;
  const ruleSetArn = `arn:aws:ses:${REGION}:${accountId}:receipt-rule-set/${NAME}:receipt-rule/*`;

  step(`S3 bucket ${bucket}`);
  awsAllowing(
    ["s3api", "create-bucket", "--bucket", bucket],
    ["BucketAlreadyOwnedByYou"],
  );
  aws([
    "s3api",
    "put-public-access-block",
    "--bucket",
    bucket,
    "--public-access-block-configuration",
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
  ]);
  aws([
    "s3api",
    "put-bucket-policy",
    "--bucket",
    bucket,
    "--policy",
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowSesInboundWrites",
          Effect: "Allow",
          Principal: { Service: "ses.amazonaws.com" },
          Action: "s3:PutObject",
          Resource: `arn:aws:s3:::${bucket}/inbound/*`,
          Condition: {
            StringEquals: { "AWS:SourceAccount": accountId },
            ArnLike: { "AWS:SourceArn": ruleSetArn },
          },
        },
      ],
    }),
  ]);

  step("SNS topics");
  const topics = {};
  for (const suffix of ["inbound", "events"]) {
    const topicArn = aws([
      "sns",
      "create-topic",
      "--name",
      `${NAME}-${suffix}`,
    ]).TopicArn;
    aws([
      "sns",
      "set-topic-attributes",
      "--topic-arn",
      topicArn,
      "--attribute-name",
      "Policy",
      "--attribute-value",
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowSesPublish",
            Effect: "Allow",
            Principal: { Service: "ses.amazonaws.com" },
            Action: "sns:Publish",
            Resource: topicArn,
            Condition: { StringEquals: { "AWS:SourceAccount": accountId } },
          },
        ],
      }),
    ]);
    topics[suffix] = topicArn;
  }

  step("SES receipt rule set");
  awsAllowing(
    ["ses", "create-receipt-rule-set", "--rule-set-name", NAME],
    ["AlreadyExists"],
  );
  const rule = {
    Name: "hosted-domains",
    Enabled: true,
    TlsPolicy: "Optional",
    ScanEnabled: true,
    Actions: [
      {
        S3Action: {
          BucketName: bucket,
          ObjectKeyPrefix: "inbound/",
          TopicArn: topics.inbound,
        },
      },
    ],
  };
  const existingRules =
    aws(["ses", "describe-receipt-rule-set", "--rule-set-name", NAME]).Rules ??
    [];
  aws([
    "ses",
    existingRules.some((item) => item.Name === rule.Name)
      ? "update-receipt-rule"
      : "create-receipt-rule",
    "--rule-set-name",
    NAME,
    "--rule",
    JSON.stringify(rule),
  ]);
  aws(["ses", "set-active-receipt-rule-set", "--rule-set-name", NAME]);

  step("SES configuration set");
  awsAllowing(
    [
      "sesv2",
      "create-configuration-set",
      "--configuration-set-name",
      NAME,
      "--reputation-options",
      "ReputationMetricsEnabled=true",
    ],
    ["AlreadyExists"],
  );
  const destination = {
    Enabled: true,
    MatchingEventTypes: [
      "BOUNCE",
      "COMPLAINT",
      "DELIVERY",
      "DELIVERY_DELAY",
      "REJECT",
    ],
    SnsDestination: { TopicArn: topics.events },
  };
  const destinations =
    aws([
      "sesv2",
      "get-configuration-set-event-destinations",
      "--configuration-set-name",
      NAME,
    ]).EventDestinations ?? [];
  const hasDestination = destinations.some(
    (item) => item.Name === "convex-events",
  );
  aws([
    "sesv2",
    hasDestination
      ? "update-configuration-set-event-destination"
      : "create-configuration-set-event-destination",
    "--configuration-set-name",
    NAME,
    "--event-destination-name",
    "convex-events",
    "--event-destination",
    JSON.stringify(destination),
  ]);

  step("IAM user for Convex");
  const userName = `${NAME}-convex`;
  awsAllowing(
    ["iam", "create-user", "--user-name", userName],
    ["EntityAlreadyExists"],
  );
  aws([
    "iam",
    "put-user-policy",
    "--user-name",
    userName,
    "--policy-name",
    `${NAME}-convex`,
    "--policy-document",
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "ReadAndArchiveRawMail",
          Effect: "Allow",
          Action: ["s3:GetObject", "s3:PutObject"],
          Resource: `arn:aws:s3:::${bucket}/*`,
        },
        {
          Sid: "SendFromVerifiedIdentities",
          Effect: "Allow",
          Action: ["ses:SendEmail", "ses:SendRawEmail"],
          Resource: [
            `arn:aws:ses:${REGION}:${accountId}:identity/*`,
            `arn:aws:ses:${REGION}:${accountId}:configuration-set/${NAME}`,
          ],
        },
      ],
    }),
  ]);
  const keys =
    aws(["iam", "list-access-keys", "--user-name", userName])
      .AccessKeyMetadata ?? [];
  if (keys.length === 0) {
    const key = aws([
      "iam",
      "create-access-key",
      "--user-name",
      userName,
    ]).AccessKey;
    convexEnvSet("HOSTED_MAIL_AWS_ACCESS_KEY_ID", key.AccessKeyId);
    convexEnvSet("HOSTED_MAIL_AWS_SECRET_ACCESS_KEY", key.SecretAccessKey);
    console.log("  stored a new access key in Convex");
  } else {
    console.log(
      "  access key already exists; leaving Convex credentials as-is",
    );
  }

  step("Convex environment");
  convexEnvSet("HOSTED_MAIL_AWS_REGION", REGION);
  convexEnvSet("HOSTED_MAIL_BUCKET", bucket);
  convexEnvSet("HOSTED_MAIL_CONFIGURATION_SET", NAME);
  convexEnvSet(
    "HOSTED_MAIL_TOPIC_ARNS",
    [topics.inbound, topics.events].join(","),
  );
  if (!convexEnvGet("HOSTED_MAIL_WEBHOOK_TOKEN")) {
    convexEnvSet(
      "HOSTED_MAIL_WEBHOOK_TOKEN",
      randomBytes(32).toString("base64url"),
    );
  }
  console.log("\n✓ Bootstrap complete. Deploy Convex, then run `connect`.");
}

function connect() {
  const token = convexEnvGet("HOSTED_MAIL_WEBHOOK_TOKEN");
  const topicArns = convexEnvGet("HOSTED_MAIL_TOPIC_ARNS")?.split(",") ?? [];
  if (!token || topicArns.length === 0) {
    throw new Error("Run bootstrap before connect");
  }
  const endpoint = `${CONVEX_SITE_URL}${WEBHOOK_PATH}?token=${token}`;
  for (const topicArn of topicArns) {
    const subscriptions =
      aws(["sns", "list-subscriptions-by-topic", "--topic-arn", topicArn])
        .Subscriptions ?? [];
    const existing = subscriptions.find((item) => item.Endpoint === endpoint);
    if (existing && existing.SubscriptionArn !== "PendingConfirmation") {
      console.log(`✓ ${topicArn} is already confirmed`);
      continue;
    }
    aws([
      "sns",
      "subscribe",
      "--topic-arn",
      topicArn,
      "--protocol",
      "https",
      "--notification-endpoint",
      endpoint,
      "--attributes",
      JSON.stringify({ RawMessageDelivery: "false" }),
    ]);
    console.log(`→ subscribed ${topicArn}; Convex confirms it automatically`);
  }
}

async function addDomain(rawDomain) {
  const domain = normalizeDomain(rawDomain);
  const accountId = aws(["sts", "get-caller-identity"]).Account;
  const mailFrom = `${MAIL_FROM_SUBDOMAIN}.${domain}`;

  step(`SES identity ${domain}`);
  awsAllowing(
    ["sesv2", "create-email-identity", "--email-identity", domain],
    ["AlreadyExists"],
  );
  aws([
    "sesv2",
    "put-email-identity-mail-from-attributes",
    "--email-identity",
    domain,
    "--mail-from-domain",
    mailFrom,
    "--behavior-on-mx-failure",
    "USE_DEFAULT_VALUE",
  ]);
  aws([
    "sesv2",
    "put-email-identity-configuration-set-attributes",
    "--email-identity",
    domain,
    "--configuration-set-name",
    NAME,
  ]);
  const identity = aws([
    "sesv2",
    "get-email-identity",
    "--email-identity",
    domain,
  ]);

  const records = [
    ...identity.DkimAttributes.Tokens.map((token) => ({
      name: `${token}._domainkey`,
      type: "CNAME",
      value: `${token}.dkim.amazonses.com`,
    })),
    {
      name: "@",
      type: "MX",
      value: `inbound-smtp.${REGION}.amazonaws.com`,
      priority: 10,
    },
    { name: "@", type: "TXT", value: SPF },
    {
      name: MAIL_FROM_SUBDOMAIN,
      type: "MX",
      value: `feedback-smtp.${REGION}.amazonses.com`,
      priority: 10,
    },
    { name: MAIL_FROM_SUBDOMAIN, type: "TXT", value: SPF },
    { name: "_dmarc", type: "TXT", value: DMARC },
  ];

  step("DNS records");
  const nameservers = await new Resolver().resolveNs(domain).catch(() => []);
  const onVercel = nameservers.some((ns) => ns.endsWith("vercel-dns.com"));
  const resolver = new Resolver();
  if (onVercel) resolver.setServers([await firstAddress(nameservers[0])]);
  const conflicts = [];
  for (const record of records) {
    const fqdn = record.name === "@" ? domain : `${record.name}.${domain}`;
    const existing = await lookup(resolver, fqdn, record.type);
    if (existing.some((value) => sameRecord(value, record))) {
      console.log(`  ✓ ${record.type} ${fqdn}`);
      continue;
    }
    const conflicting = conflictingRecords(existing, record);
    if (conflicting.length > 0 && !options.force) {
      conflicts.push(`${record.type} ${fqdn}: ${conflicting.join(", ")}`);
      continue;
    }
    if (!onVercel) {
      const verb = conflicting.length > 0 ? "replace with" : "add";
      console.log(
        `  ! ${verb} ${record.type} ${fqdn} ${record.priority ?? ""} ${record.value}`,
      );
      continue;
    }
    if (conflicting.length > 0) {
      removeVercelRecords(domain, record, conflicting);
    }
    run("vercel", [
      "dns",
      "add",
      domain,
      record.name,
      record.type,
      record.value,
      ...(record.priority ? [String(record.priority)] : []),
    ]);
    console.log(`  + ${record.type} ${fqdn}`);
  }
  if (conflicts.length > 0) {
    throw new Error(
      `Existing mail records would be replaced. Remove them or pass --force:\n  ${conflicts.join("\n  ")}`,
    );
  }

  step("Waiting for SES verification");
  const deadline = Date.now() + 10 * 60 * 1000;
  let current = identity;
  while (Date.now() < deadline) {
    current = aws(["sesv2", "get-email-identity", "--email-identity", domain]);
    if (
      current.VerifiedForSendingStatus &&
      current.MailFromAttributes?.MailFromDomainStatus === "SUCCESS"
    ) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  console.log(
    `  DKIM ${current.DkimAttributes.Status}, MAIL FROM ${current.MailFromAttributes?.MailFromDomainStatus}`,
  );

  step("Convex registration");
  convexRun("providers/hosted/admin:registerDomain", { domain });
  console.log(
    `\n✓ ${domain} is ${current.VerifiedForSendingStatus ? "ready" : "pending verification"} (account ${accountId}).`,
  );
}

function addAddress(rawAddress) {
  const address = rawAddress?.trim().toLowerCase();
  if (!address?.includes("@"))
    throw new Error("A full email address is required");
  const result = convexRun("providers/hosted/admin:createAddress", {
    address,
    ...(options.name ? { displayName: options.name } : {}),
    ...(options["alias-of"]
      ? { aliasOf: options["alias-of"].toLowerCase() }
      : {}),
  });
  console.log(result);
}

function sendTest(from, to) {
  if (!from || !to) throw new Error("send-test needs <from> and <to>");
  console.log(
    convexRun("providers/hosted/admin:sendTestMessage", {
      from,
      to,
      ...(options["reply-to"]
        ? { replyToInternetMessageId: options["reply-to"] }
        : {}),
    }),
  );
}

function status(domain) {
  const account = aws(["sesv2", "get-account"]);
  console.log(
    `SES ${REGION}: production=${account.ProductionAccessEnabled} quota=${account.SendQuota.Max24HourSend}/day plan=${account.PricingAttributes?.CurrentPlan ?? "unknown"}`,
  );
  const identities = domain
    ? [{ IdentityName: normalizeDomain(domain) }]
    : aws(["sesv2", "list-email-identities"]).EmailIdentities;
  for (const item of identities) {
    const identity = aws([
      "sesv2",
      "get-email-identity",
      "--email-identity",
      item.IdentityName,
    ]);
    console.log(
      `${item.IdentityName}: sending=${identity.VerifiedForSendingStatus} dkim=${identity.DkimAttributes?.Status} mailFrom=${identity.MailFromAttributes?.MailFromDomainStatus}`,
    );
  }
  console.log(convexRun("providers/hosted/admin:listAddresses", {}));
}

function importMail(source, target) {
  if (!source || !target) {
    throw new Error("import needs <source address> and <hosted address>");
  }
  const result = JSON.parse(
    convexRun("providers/hosted/importJobs:start", { source, target }),
  );
  console.log(
    result.started
      ? `→ ${result.resumed ? "resumed" : "started"} import ${result.importId}`
      : `✓ import ${result.importId} is already running`,
  );
  importStatus(target);
}

function importStatus(target) {
  const rows = JSON.parse(
    convexRun("providers/hosted/importJobs:status", target ? { target } : {}),
  );
  if (rows.length === 0) console.log("No imports yet.");
  for (const row of rows) {
    const total = row.estimatedTotal ? ` of about ${row.estimatedTotal}` : "";
    console.log(`\n${row.source} → ${row.target}: ${row.status}`);
    console.log(
      `  imported ${row.imported}, skipped ${row.skipped}, failed ${row.failed}${total}`,
    );
    console.log(
      `  started ${row.startedAt}, updated ${row.updatedAt}${row.finishedAt ? `, finished ${row.finishedAt}` : ""}`,
    );
    if (row.currentFolder) console.log(`  folder: ${row.currentFolder}`);
    if (row.lastError) console.log(`  last error: ${row.lastError}`);
    for (const failure of row.recentFailures) {
      console.log(
        `  ✗ ${failure.folder}: ${failure.reason} (${failure.remoteMessageId})`,
      );
    }
  }
}

function aws(args) {
  const output = run("aws", [...args, "--region", REGION, "--output", "json"]);
  return output.trim() ? JSON.parse(output) : {};
}

function awsAllowing(args, allowedErrors) {
  try {
    return aws(args);
  } catch (error) {
    if (allowedErrors.some((code) => String(error.message).includes(code))) {
      return {};
    }
    throw error;
  }
}

function convexEnvSet(name, value) {
  run("pnpm", ["exec", "convex", "env", "set", name, value], {
    cwd: CONVEX_DIR,
  });
}

function convexEnvGet(name) {
  try {
    return run("pnpm", ["exec", "convex", "env", "get", name], {
      cwd: CONVEX_DIR,
    }).trim();
  } catch {
    return undefined;
  }
}

function convexRun(name, args) {
  return run("pnpm", ["exec", "convex", "run", name, JSON.stringify(args)], {
    cwd: CONVEX_DIR,
  }).trim();
}

function run(file, args, extra = {}) {
  try {
    return execFileSync(file, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...extra,
    });
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim();
    throw new Error(`${file} ${args.slice(0, 3).join(" ")} failed: ${detail}`);
  }
}

async function lookup(resolver, fqdn, type) {
  try {
    if (type === "TXT") {
      return (await resolver.resolveTxt(fqdn)).map((parts) => parts.join(""));
    }
    if (type === "MX") {
      return (await resolver.resolveMx(fqdn)).map(
        (record) => `${record.priority} ${record.exchange}`,
      );
    }
    return await resolver.resolveCname(fqdn);
  } catch {
    return [];
  }
}

function sameRecord(existing, record) {
  if (record.type === "MX") {
    return existing === `${record.priority} ${record.value}`;
  }
  return existing.replace(/\.$/u, "") === record.value;
}

function conflictingRecords(existing, record) {
  if (record.type === "MX") return existing;
  if (record.type === "TXT" && record.value.startsWith("v=spf1")) {
    return existing.filter((value) => value.startsWith("v=spf1"));
  }
  if (record.type === "TXT" && record.value.startsWith("v=DMARC1")) {
    return existing.filter((value) => value.startsWith("v=DMARC1"));
  }
  return existing;
}

function removeVercelRecords(domain, record, conflicting) {
  const name = record.name === "@" ? "" : record.name;
  // --paginate returns the records of every page as one array.
  const records = JSON.parse(
    run("vercel", [
      "api",
      `/v4/domains/${domain}/records?limit=100`,
      "--paginate",
      "--raw",
    ]),
  );
  const stale = records.filter(
    (item) =>
      item.type === record.type &&
      item.name === name &&
      conflicting.some((value) =>
        value.includes(item.value.replace(/\.$/u, "")),
      ),
  );
  if (stale.length !== conflicting.length) {
    throw new Error(
      `Found ${stale.length} of ${conflicting.length} ${record.type} records to replace on ${domain} in Vercel; fix them by hand`,
    );
  }
  for (const item of stale) {
    run("vercel", ["dns", "rm", item.id, "--yes"]);
    console.log(`  - ${record.type} ${item.name || domain} ${item.value}`);
  }
}

async function firstAddress(hostname) {
  return (await dnsLookup(hostname, { family: 4 })).address;
}

function normalizeDomain(value) {
  const domain = value?.trim().toLowerCase().replace(/\.$/u, "");
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/u.test(domain)) {
    throw new Error("A valid domain is required");
  }
  return domain;
}

function parseOptions(args) {
  const parsed = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function step(label) {
  console.log(`\n▸ ${label}`);
}
