// Autoplay must not spend an unseen ending on a cast outside the viewport.
export function visibleSceneCandidates(candidates, boundsFor, width, height) {
  return candidates.filter(candidate => [...candidate.actorIds, ...(candidate.propId ? [candidate.propId] : [])].every(id => {
    const rect = boundsFor(id);
    return rect && rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= width && rect.top >= 60 && rect.bottom <= height - 10;
  }));
}
