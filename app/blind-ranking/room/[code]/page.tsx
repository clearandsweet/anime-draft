import BlindRankingRoomClient from "./roomClient";

export default async function BlindRankingRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <BlindRankingRoomClient code={code} />;
}
