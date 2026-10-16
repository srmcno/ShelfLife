// Where this copy of the game hands shelves to, or takes them from, when the
// game changes address. scripts/build_site.py fills these in from
// SHELFLIFE_MOVE_TO (the old address's build: the base URL of the new home)
// and SHELFLIFE_MOVE_FROM (the new address's build: the old base URLs, comma
// separated). Both empty means no move: the game stays where it is.
export const MOVE_TO = '';
export const MOVE_FROM = [];
