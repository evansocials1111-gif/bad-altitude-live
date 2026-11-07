import { getActiveCharacters, publicCharacter } from "@/lib/server/characters";
import { route } from "@/lib/server/http";

export const GET = route(async () => ({ characters: (await getActiveCharacters()).map(publicCharacter) }));
