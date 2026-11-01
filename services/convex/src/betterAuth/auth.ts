import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth/minimal";

import { passkeyRpIdPlugin } from "./passkeyRpIdPlugin";

export const auth = betterAuth({ plugins: [passkey(), passkeyRpIdPlugin] });
