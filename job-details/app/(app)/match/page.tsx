import { redirect } from "next/navigation";

/** Old route — keep so bookmarks / cache still land on Score Jobs. */
export default function MatchRedirectPage() {
  redirect("/score");
}
