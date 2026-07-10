import { createServerFn } from "@tanstack/react-start";

import { getToken } from "~/features/auth/lib/auth.server";

export const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});
