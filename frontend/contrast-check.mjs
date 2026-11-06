const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const L = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const W = '#FFFFFF', PG = '#E4EBF8'
const T = [ // [name, foreground, background, minimum ratio]
  ['ink / white', '#303B55', W, 4.5], ['ink / page', '#303B55', PG, 4.5],
  ['ink2 / white', '#46526E', W, 4.5], ['ink2 / page', '#46526E', PG, 4.5],
  ['ink3 / white', '#566280', W, 4.5], ['ink3 / page', '#566280', PG, 4.5], ['ink3 / table head', '#566280', '#F1F4FC', 4.5],
  ['white / primary button', W, '#3F5EC2', 4.5], ['white / primary hover', W, '#3350B0', 4.5],
  ['disabled text', '#4F5B77', '#DCE3F2', 4.5],
  ['ocean-ink / white', '#2B47A0', W, 4.5], ['ocean-ink / page', '#2B47A0', PG, 4.5], ['orchid-ink / page', '#6B3A94', PG, 4.5],
  ['ink / ocean tint', '#303B55', '#E1E8FB', 4.5], ['ink / lagoon tint', '#303B55', '#DDF4F1', 4.5], ['ink / orchid tint', '#303B55', '#EFE3F9', 4.5],
  ['ink / pink tint', '#303B55', '#FCE6F0', 4.5], ['ink / amber tint', '#303B55', '#FDF0D5', 4.5], ['ink / coral tint', '#303B55', '#FDE4E6', 4.5],
  ['badge blue', '#2B47A0', '#E1E8FB', 4.5], ['badge teal', '#0F5F59', '#DDF4F1', 4.5], ['badge violet', '#6B3A94', '#EFE3F9', 4.5],
  ['badge pink', '#962B61', '#FCE6F0', 4.5], ['badge amber', '#744A00', '#FDF0D5', 4.5], ['badge red', '#9E2635', '#FDE4E6', 4.5],
  ['sidebar top', W, '#3556B5', 4.5], ['sidebar mid', W, '#1F6AA8', 4.5], ['sidebar bottom', W, '#0E7C7C', 4.5],
  ['sidebar hover (bottom)', W, '#0D5F6A', 4.5], ['sidebar active pill', '#2B47A0', W, 4.5],
  ['hero start', W, '#3F5EC2', 4.5], ['hero mid', W, '#5446B8', 4.5], ['hero end', W, '#6B3A94', 4.5],
  ['chart ocean', '#5479D5', W, 3], ['chart teal', '#1F9F97', W, 3], ['chart orchid', '#9B5ECB', W, 3],
  ['chart coral', '#E0505A', W, 3], ['chart amber', '#D08400', W, 3], ['control border', '#7F8DB0', W, 3],
]
let bad = 0
for (const [n, f, b, min] of T) { const r = cr(f, b); if (r < min) bad++; console.log(`${r >= min ? 'OK  ' : 'FAIL'} ${r.toFixed(2)} (>= ${min})  ${n}`) }
console.log(bad ? `\n${bad} pair(s) below threshold` : '\nAll pairs pass')
process.exit(bad ? 1 : 0)