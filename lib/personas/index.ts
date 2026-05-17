import { homePersona } from "./home";
import { financePersona } from "./finance";
import type { Persona, PersonaId } from "./types";

export type { Persona, PersonaId, PersonaIconName } from "./types";

export const PERSONAS: Record<PersonaId, Persona> = {
  home: homePersona,
  finance: financePersona,
};

export const PERSONA_LIST: Persona[] = [homePersona, financePersona];

export function getPersona(id: PersonaId | string): Persona | null {
  return PERSONAS[id as PersonaId] ?? null;
}
