export type LobbyDraftType = "anime" | "pokemon";

export function getLobbyRoute(draftType: LobbyDraftType, lobbyId: string) {
  const encodedLobbyId = encodeURIComponent(lobbyId.trim());
  return draftType === "pokemon"
    ? `/pokemon-lobby/${encodedLobbyId}`
    : `/lobby/${encodedLobbyId}`;
}

export function getLobbyInviteTitle(draftType: LobbyDraftType) {
  return draftType === "pokemon"
    ? "Join my Pokémon draft"
    : "Join my anime character draft";
}

export function getLobbyInviteText(
  draftType: LobbyDraftType,
  lobbyId: string,
  hostName?: string | null
) {
  const draftLabel =
    draftType === "pokemon" ? "Pokémon draft" : "anime character draft";
  const hostPrefix = hostName?.trim()
    ? `${hostName.trim()} invited you to ${
        draftType === "anime" ? "an" : "a"
      }`
    : "Join this";

  return `${hostPrefix} ${draftLabel} in room #${lobbyId.trim()}.`;
}
