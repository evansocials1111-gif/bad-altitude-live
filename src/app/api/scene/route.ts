import { findSceneClips, getActiveCharacters } from "@/lib/server/characters";
import { route } from "@/lib/server/http";

export const GET = route(async () => ({ clips: findSceneClips((await getActiveCharacters()).map((c) => c.id)) }));
