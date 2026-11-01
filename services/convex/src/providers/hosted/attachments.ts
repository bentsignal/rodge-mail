"use node";

import type { Doc } from "../../_generated/dataModel";
import { hostedObjectKey, parseHostedAttachmentIndex } from "./addresses";
import { getRawMessage } from "./aws";
import { parseRawMessage } from "./normalize";

export async function fetchHostedAttachment(
  message: Parameters<typeof hostedObjectKey>[0],
  attachment: Pick<Doc<"attachments">, "remoteAttachmentId">,
) {
  const parsed = await parseRawMessage(
    await getRawMessage(hostedObjectKey(message)),
  );
  const content = parsed.attachments.at(
    parseHostedAttachmentIndex(attachment.remoteAttachmentId),
  )?.content;
  if (!content) throw new Error("Hosted attachment is unavailable");
  return new Uint8Array(content);
}
