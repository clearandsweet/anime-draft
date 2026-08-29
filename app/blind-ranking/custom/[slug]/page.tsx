import CustomRankingPlayer from "./player";

export default async function CustomRankingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <CustomRankingPlayer slug={(await params).slug} />;
}
