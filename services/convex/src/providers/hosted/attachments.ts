"use node";

import type { Doc } from "../../_generated/dataModel";
import { hostedObjectKey, parseHostedAttachmentIndex } from "./addresses";
import { getRawMessage } from "./aws";
import { parseRawMessage } from "./normalize";

export async function fetchHostedAttachment(
  message: Pick<Doc<"messages">, "direction" | "remoteMessageId">,
  attachment: Pick<Doc<"attachments">, "remoteAttachmentId">,
) {
  const parsed = await parseRawMessage(
    await getRawMessage(
      hostedObjectKey(message.remoteMessageId, message.direction),
    ),
  );
  const content = parsed.attachments.at(
    parseHostedAttachmentIndex(attachment.remoteAttachmentId),
  )?.content;
  if (!content) throw new Error("Hosted attachment is unavailable");
  return new Uint8Array(content);
}
