import { after } from 'next/server';
import { handle, ok, readJson } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { signupDecisionSchema } from '@/lib/validation/platform';
import { decideSignup } from '@/modules/platform/clients';
import { notifyOwnerOfDecision } from '@/modules/auth/signup-emails';

/** PearlSolutions approves or rejects a business that signed up by itself. */
export const POST = handle(async (request, { params }) => {
  const admin = await requirePlatformApi(request);
  const { id } = await params;
  const { decision } = signupDecisionSchema.parse(await readJson(request));
  const client = await decideSignup(admin, id, decision);
  if (client.owner) {
    after(() => notifyOwnerOfDecision({ to: client.owner.email, name: client.owner.name, businessName: client.name, approved: decision === 'approve' }));
  }
  return ok(client);
});
