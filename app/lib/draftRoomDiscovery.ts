export type DraftRoomDiscoveryLobby = {
  id: string;
  hostName: string | null;
  status: "active" | "completed";
  preset?: "classic" | "blitz" | "chaos";
};

type DraftRoomDiscoveryOptions = {
  query?: string;
  deviceOnly?: boolean;
  deviceLobbyIds?: ReadonlySet<string>;
};

export function combineDeviceLobbyIds(
  ownedLobbyIds: ReadonlySet<string>,
  rememberedLobbyIds: ReadonlySet<string>
) {
  return new Set([...ownedLobbyIds, ...rememberedLobbyIds]);
}

export function filterDraftRooms<T extends DraftRoomDiscoveryLobby>(
  lobbies: T[],
  {
    query = "",
    deviceOnly = false,
    deviceLobbyIds = new Set<string>(),
  }: DraftRoomDiscoveryOptions = {}
) {
  const normalizedQuery = query.trim().toLowerCase();

  return lobbies.filter((lobby) => {
    if (deviceOnly && !deviceLobbyIds.has(lobby.id)) return false;
    if (!normalizedQuery) return true;

    const searchable = [
      lobby.id,
      lobby.hostName ?? "",
      lobby.status,
      lobby.status === "completed" ? "final results recap" : "live active",
      lobby.preset ?? "classic",
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  });
}

