/** Pick the Russian form that agrees with `count`: 1 штат, 2 штата, 5 штатов. */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const mod100 = Math.abs(count) % 100
  if (mod100 >= 11 && mod100 <= 14) return forms[2]
  const mod10 = mod100 % 10
  if (mod10 === 1) return forms[0]
  if (mod10 >= 2 && mod10 <= 4) return forms[1]
  return forms[2]
}
