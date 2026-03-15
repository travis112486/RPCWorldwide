import type { Metadata } from 'next';
import { PresentationViewer } from '@/components/public/presentation-viewer';

export const metadata: Metadata = {
  title: 'Presentation | RPC Worldwide',
  description: 'View talent selections for this casting project.',
};

export default async function PublicPresentationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <PresentationViewer token={token} />;
}
