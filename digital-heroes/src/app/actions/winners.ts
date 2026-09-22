"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

/** Winner uploads a screenshot of their scores from the golf platform. */
export async function uploadProof(winnerId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a screenshot to upload." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "The proof must be an image (PNG or JPG)." };
  if (file.size > MAX_BYTES) return { ok: false, message: "That image is over 5 MB. Try a smaller screenshot." };

  // RLS only returns this row if it belongs to the logged-in user.
  const { data: winner } = await supabase
    .from("winners")
    .select("id, verification_status, payment_status")
    .eq("id", winnerId)
    .maybeSingle();
  if (!winner) return { ok: false, message: "Winning entry not found." };
  if (winner.verification_status === "approved") return { ok: false, message: "This win is already approved." };

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${user.id}/${winnerId}-${Date.now()}.${ext}`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage.from("proofs").upload(path, file, { contentType: file.type });
  if (uploadError) return { ok: false, message: "Upload failed. Please try again." };

  await admin.from("winners").update({ proof_path: path, verification_status: "pending" }).eq("id", winnerId);

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Proof uploaded. We'll review it shortly." };
}
