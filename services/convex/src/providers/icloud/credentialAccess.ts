import type { EncryptedEnvelope } from "../crypto";
import { credentialAdditionalData, decryptProviderSecret } from "../crypto";

export interface ICloudCredential {
  imapUsername: string;
  password: string;
}

export async function decryptICloudCredential(args: {
  ownerId: string;
  accountId: string;
  encryptedCredential: EncryptedEnvelope;
}) {
  return await decryptProviderSecret<ICloudCredential>(
    args.encryptedCredential,
    credentialAdditionalData(args.ownerId, args.accountId, "icloud"),
  );
}
