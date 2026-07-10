import { passkey } from "@better-auth/passkey";
import { createApi } from "@convex-dev/better-auth";

import schema from "./schema";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, () => ({ plugins: [passkey()] }));
