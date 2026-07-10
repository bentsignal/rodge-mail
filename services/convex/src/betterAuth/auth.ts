import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth/minimal";

export const auth = betterAuth({ plugins: [passkey()] });
