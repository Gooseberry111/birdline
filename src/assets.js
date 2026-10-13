// Files in /public, resolved against the base path so the game works on any host or sub folder.
export const asset = (p) => import.meta.env.BASE_URL + p
