import { defineSchema } from "convex/server";

import { tables } from "./generatedSchema";

const schema = defineSchema({
  ...tables,
  user: tables.user.index("email", ["email"]),
  passkey: tables.passkey.index("credentialID", ["credentialID"]),
});

export default schema;
