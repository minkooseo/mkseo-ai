// Pick round items at random, spread evenly across voices or groups.
import { groupBy } from "../group-by.ts";

/**
 * Take up to `itemLimit` candidates, one from each spread group in turn,
 * so every group gets about the same number. Returns them shuffled.
 */
export function spreadPick<T>({
  candidates,
  spreadBy,
  itemLimit,
  random,
}: {
  readonly candidates: readonly T[];
  readonly spreadBy: (candidate: T) => string;
  readonly itemLimit: number;
  readonly random: () => number;
}): T[] {
  const groups = shuffle(
    [...groupBy(candidates, spreadBy).values()].map((group) =>
      shuffle(group, random),
    ),
    random,
  );
  const picked: T[] = [];
  for (let pass = 0; picked.length < itemLimit; pass += 1) {
    const taken = groups.flatMap((group) => group.slice(pass, pass + 1));
    if (taken.length === 0) break;
    picked.push(...taken.slice(0, itemLimit - picked.length));
  }
  return shuffle(picked, random);
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const remaining = [...items];
  const shuffled: T[] = [];
  while (remaining.length > 0) {
    const index = Math.floor(random() * remaining.length);
    shuffled.push(...remaining.splice(index, 1));
  }
  return shuffled;
}
