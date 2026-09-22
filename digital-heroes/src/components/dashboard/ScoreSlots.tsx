import { NumberBall } from "@/components/ui";
import { MAX_SCORES } from "@/lib/config";
import { formatDate } from "@/lib/utils";

/** Five slots, newest first. Filled slots show the score, empty ones invite the next round. */
export function ScoreSlots({ scores }: { scores: { id: string; score: number; played_on: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4">
      {Array.from({ length: MAX_SCORES }).map((_, i) => {
        const s = scores[i];
        return (
          <li key={i} className="flex flex-col items-center gap-2">
            {s ? <NumberBall n={s.score} size="lg" tone={i === 0 ? "sun" : "plain"} /> : <NumberBall n="" size="lg" tone="ghost" />}
            <span className="text-xs text-ink-soft">{s ? formatDate(s.played_on) : "Empty"}</span>
          </li>
        );
      })}
    </ul>
  );
}
