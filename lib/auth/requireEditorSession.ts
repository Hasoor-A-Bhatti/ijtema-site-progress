import { cookies } from "next/headers";

import {
  EDITOR_COOKIE_NAME,
  verifyEditorSession,
} from "@/lib/auth/editorSession";

export async function hasValidEditorSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(EDITOR_COOKIE_NAME)?.value;

  return verifyEditorSession(token).valid;
}