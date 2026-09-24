import { escapeEmailHtml, renderEmailLayout } from './email-layout';

export type SecurityEmailEvent =
  | { kind: 'PROVIDER_LINKED'; provider: string }
  | { kind: 'PROVIDER_REMOVED'; provider: string }
  | { kind: 'OTHER_SESSIONS_REVOKED' };

export function renderSecurityEmail(input: {
  recipientName: string;
  actionUrl: string;
  event: SecurityEmailEvent;
}) {
  const { event } = input;
  const sessionsRevoked = event.kind === 'OTHER_SESSIONS_REVOKED';
  const providerRemoved = event.kind === 'PROVIDER_REMOVED';
  const subject = sessionsRevoked
    ? 'Diğer oturumlar sonlandırıldı'
    : providerRemoved
      ? 'Giriş yöntemi kaldırıldı'
      : 'Yeni giriş yöntemi bağlandı';
  const message = sessionsRevoked
    ? 'Hesabınızın diğer cihazlardaki aktif oturumları kapatıldı.'
    : providerRemoved
      ? `${event.provider} hesabı Core Asistan profilinizden kaldırıldı.`
      : `${event.provider} hesabı Core Asistan profilinize bağlandı.`;
  const eventLabel = sessionsRevoked ? 'Oturum güvenliği' : 'Giriş yöntemi';
  const eventValue = sessionsRevoked
    ? 'Diğer cihazlardaki oturumlar'
    : event.provider;
  const stateLabel = sessionsRevoked
    ? 'Sonlandırıldı'
    : providerRemoved
      ? 'Hesaptan kaldırıldı'
      : 'Hesaba bağlandı';
  const warning = sessionsRevoked
    ? 'Açık oturumlarınızı ve giriş yöntemlerinizi kontrol edin.'
    : 'Bağlı giriş yöntemlerinizi ve açık oturumlarınızı hemen kontrol edin.';

  const detailsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 19px;background:#f7f9f7;border:1px solid #e5ebe6;border-radius:8px"><tr><td style="padding:16px 19px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr><td style="padding:0 0 10px;color:#68756b;font-size:12px">${eventLabel}</td><td align="right" style="padding:0 0 10px;color:#26382c;font-size:13px;font-weight:700">${escapeEmailHtml(eventValue)}</td></tr>
        <tr><td style="padding:10px 0 0;border-top:1px solid #e7ece8;color:#68756b;font-size:12px">Durum</td><td align="right" style="padding:10px 0 0;border-top:1px solid #e7ece8;color:#26382c;font-size:13px;font-weight:700">${stateLabel}</td></tr>
      </table>
    </td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 27px;background:#faf8f4;border:1px solid #eee7dc;border-radius:8px"><tr><td style="padding:16px 19px">
      <p style="margin:0 0 6px;color:#775e3d;font-size:12px;font-weight:700;line-height:1.4">Bu işlemi siz yapmadıysanız</p>
      <p style="margin:0;color:#5f5d54;font-size:12px;line-height:1.6">${warning}</p>
    </td></tr></table>`;

  return {
    subject,
    html: renderEmailLayout({
      category: 'Hesap güvenliği',
      eyebrow: 'Hesap hareketi',
      preheader: message,
      title: subject,
      recipientName: input.recipientName,
      message,
      detailsHtml,
      actionUrl: input.actionUrl,
      actionLabel: 'Hesap güvenliğini görüntüle',
      footer:
        'Bu e-posta hesap güvenliğiniz için otomatik olarak gönderilmiştir.',
    }),
  };
}
