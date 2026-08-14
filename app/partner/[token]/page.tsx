import { notFound } from 'next/navigation';
import PartnerView from './PartnerView';

export default async function PartnerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const validToken = process.env.PARTNER_TOKEN;
  const clientId = process.env.PARTNER_CLIENT_ID;

  if (!validToken || !clientId || token !== validToken) {
    notFound();
  }

  return <PartnerView clientId={clientId} />;
}
