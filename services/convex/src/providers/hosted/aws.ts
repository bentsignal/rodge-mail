import { AwsClient } from "aws4fetch";

import { requireHostedMailConfig } from "./env";
import { sesSendResponseSchema } from "./payloads";

function createClient() {
  const config = requireHostedMailConfig();
  return {
    config,
    client: new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    }),
  };
}

function objectUrl(bucket: string, region: string, key: string) {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `https://${bucket}.s3.${region}.amazonaws.com/${path}`;
}

export async function getRawMessage(key: string) {
  const { client, config } = createClient();
  const response = await client.fetch(
    objectUrl(config.bucket, config.region, key),
    { aws: { service: "s3" } },
  );
  if (!response.ok) {
    throw new Error(`S3 returned ${response.status} for a stored message`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function putRawMessage(key: string, body: Uint8Array) {
  const { client, config } = createClient();
  const response = await client.fetch(
    objectUrl(config.bucket, config.region, key),
    {
      method: "PUT",
      body: new Uint8Array(body),
      headers: { "Content-Type": "message/rfc822" },
      aws: { service: "s3" },
    },
  );
  if (!response.ok) {
    throw new Error(`S3 returned ${response.status} while archiving a message`);
  }
}

export class SesSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export async function sendRawEmail(args: {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  raw: Uint8Array;
}) {
  const { client, config } = createClient();
  const response = await client.fetch(
    `https://email.${config.region}.amazonaws.com/v2/email/outbound-emails`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      aws: { service: "ses" },
      body: JSON.stringify({
        FromEmailAddress: args.from,
        Destination: {
          ToAddresses: args.to,
          CcAddresses: args.cc,
          BccAddresses: args.bcc,
        },
        Content: { Raw: { Data: Buffer.from(args.raw).toString("base64") } },
        ...(config.configurationSet
          ? { ConfigurationSetName: config.configurationSet }
          : {}),
      }),
    },
  );
  const parsed = sesSendResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  const body = parsed.success ? parsed.data : {};
  if (!response.ok || !body.MessageId) {
    throw new SesSendError(
      `SES rejected the message (${response.status}): ${body.message ?? "unknown error"}`,
      response.status === 429 || response.status >= 500,
    );
  }
  return { sesMessageId: body.MessageId, region: config.region };
}
