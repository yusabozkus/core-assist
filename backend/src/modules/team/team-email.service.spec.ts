import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Prisma } from '../../generated/prisma/client';
import {
  ResendEmailService,
  type EmailRequest,
} from '../notifications/resend-email.service';
import { TeamAccessLevel } from './dto/team-member-access.dto';
import { TeamEventEmailService } from './team-event-email.service';
import { TeamInvitationEmailService } from './team-invitation-email.service';

function withEmailConfiguration() {
  const previousFrom = process.env.NOTIFICATION_EMAIL_FROM;
  const previousFrontend = process.env.FRONTEND_URL;
  process.env.NOTIFICATION_EMAIL_FROM = 'Core Asistan <team@coreasistan.com>';
  process.env.FRONTEND_URL = 'https://coreasistan.com';
  return () => {
    if (previousFrom === undefined) delete process.env.NOTIFICATION_EMAIL_FROM;
    else process.env.NOTIFICATION_EMAIL_FROM = previousFrom;
    if (previousFrontend === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontend;
  };
}

void test('invitation email contains the correct recipient, role, stores and accept link', async () => {
  const restore = withEmailConfiguration();
  const staged: EmailRequest[] = [];
  const resend = {
    configured: true,
    stage: (input: EmailRequest) => {
      staged.push(input);
      return Promise.resolve({ id: 'delivery-1' });
    },
    deliverStaged: () => Promise.resolve('SENT'),
    cancelPendingInvitation: () => Promise.resolve(),
  } as unknown as ResendEmailService;

  try {
    const service = new TeamInvitationEmailService(resend);
    const invitation = {
      id: 'invite-1',
      tokenHash: 'a'.repeat(64),
      email: 'member@example.com',
      expiresAt: new Date('2026-09-30T12:00:00Z'),
      workspace: { name: 'Örnek Hesap' },
      invitedBy: { name: 'Ayşe' },
      storeAccesses: [{ store: { name: '<script>Mağaza</script>' } }],
    };
    const key = await service.stage(
      {} as Prisma.TransactionClient,
      invitation,
      'private-token',
      TeamAccessLevel.AGENT,
    );
    assert.equal(key, `team-invite:invite-1:${invitation.tokenHash}`);
    assert.equal(staged.length, 1);
    assert.equal(staged[0].recipientEmail, invitation.email);
    assert.equal(staged[0].sensitive, true);
    assert.ok(
      staged[0].html.includes('https://coreasistan.com/invite/private-token'),
    );
    assert.ok(staged[0].html.includes('Temsilci'));
    assert.ok(staged[0].html.includes('&lt;script&gt;Mağaza&lt;/script&gt;'));
    assert.ok(!staged[0].html.includes('<script>Mağaza</script>'));
    assert.equal(await service.deliver(key), 'SENT');
  } finally {
    restore();
  }
});

void test('accepted invitation email is staged once per distinct manager', async () => {
  const restore = withEmailConfiguration();
  const staged: EmailRequest[] = [];
  const resend = {
    configured: true,
    stage: (input: EmailRequest) => {
      staged.push(input);
      return Promise.resolve({ id: `delivery-${staged.length}` });
    },
  } as unknown as ResendEmailService;
  const transaction = {
    workspace: {
      findUnique: () => Promise.resolve({ name: 'Örnek Hesap' }),
    },
    user: {
      findMany: () =>
        Promise.resolve([
          { id: 'manager-1', name: 'Ayşe', email: 'ayse@example.com' },
          { id: 'manager-2', name: 'Mehmet', email: 'mehmet@example.com' },
        ]),
    },
  } as unknown as Prisma.TransactionClient;

  try {
    const service = new TeamEventEmailService(resend);
    const keys = await service.stage(transaction, {
      workspaceId: 'workspace-1',
      recipientUserIds: ['manager-1', 'manager-1', 'manager-2'],
      eventKey: 'invitation-accepted:invite-1',
      event: { kind: 'ACCEPTED', memberName: 'Zeynep' },
    });
    assert.equal(keys.length, 2);
    assert.equal(new Set(keys).size, 2);
    assert.deepEqual(staged.map((email) => email.recipientEmail).sort(), [
      'ayse@example.com',
      'mehmet@example.com',
    ]);
    assert.ok(staged.every((email) => email.html.includes('Zeynep')));
    assert.ok(staged.every((email) => email.sensitive));
  } finally {
    restore();
  }
});
