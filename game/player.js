export function createPlayer(id, name) {
  return {
    id,
    name,
    score: 0,
    ready: false,
    hasGuessed: false,
  };
}
