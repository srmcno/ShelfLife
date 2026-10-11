/* Every finished game is graded in stars, one to three, with the points as the
   small print. A run that ends always earned the first star: nobody gets a zero
   for turning up. Pure and DOM-free. */

// The arcade grades a run by how many of its three score thresholds it passed (0 to 3).
// Passing none still earns one star; passing all three earns three.
export const starsForTier = tier => Math.max(1, Math.min(3, Math.floor(Number.isFinite(tier) ? tier : 0)));

// An expedition grades its trip by relic tier (0 to 2): a quiet survey, a good haul, the full route.
export const starsForTrip = tier => Math.max(1, Math.min(3, Math.floor(Number.isFinite(tier) ? tier : 0) + 1));

export function starsMarkup(n, max = 3, className = 'result-stars') {
  const earned = Math.max(0, Math.min(max, Math.floor(n) || 0));
  return '<span class="' + className + '" role="img" aria-label="' + earned + ' of ' + max + ' stars">' +
    Array.from({ length: max }, (_, i) => '<i class="' + (i < earned ? 'on' : '') + '" aria-hidden="true">★</i>').join('') + '</span>';
}
