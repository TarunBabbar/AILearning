/**
 * Client-safe job board branding from NEXT_PUBLIC_* env vars.
 * Never hardcode the board host in UI — set values in .env.
 */
export function getJobBoardPublic() {
  const name =
    process.env.NEXT_PUBLIC_JOB_BOARD_NAME?.trim() || "job board";
  const url = (process.env.NEXT_PUBLIC_JOB_BOARD_URL || "").replace(/\/$/, "");
  return { name, url };
}
