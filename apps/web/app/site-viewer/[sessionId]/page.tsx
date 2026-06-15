import SiteViewerClient from '@/components/site-viewer/SiteViewerClient';

export default async function SiteViewerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <SiteViewerClient sessionId={sessionId} />;
}
