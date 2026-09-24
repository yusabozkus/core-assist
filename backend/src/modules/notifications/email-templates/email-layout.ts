export function escapeEmailHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderEmailLayout(input: {
  category: string;
  eyebrow: string;
  preheader: string;
  title: string;
  recipientName: string;
  message: string;
  detailsHtml: string;
  actionUrl: string;
  actionLabel: string;
  footer: string;
  preferencesUrl?: string;
}) {
  return `<!doctype html>
    <html lang="tr">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
      <body style="margin:0;padding:0;background:#f5f7f5;font-family:Arial,Helvetica,sans-serif;color:#202b24">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(input.preheader)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f5f7f5">
          <tr><td align="center" style="padding:32px 14px 36px">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #e3e8e4;border-radius:12px;overflow:hidden">
              <tr><td style="padding:25px 32px 24px;border-bottom:1px solid #edf0ed">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
                  <td align="left" style="vertical-align:middle"><img src="https://coreasistan.com/logo/text.png" width="124" alt="Core Asistan" style="display:block;width:124px;height:auto;border:0;outline:none;text-decoration:none"></td>
                  <td align="right" style="vertical-align:middle;color:#7a857c;font-size:11px">${escapeEmailHtml(input.category)}</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:29px 32px 32px">
                <p style="margin:0 0 8px;color:#557260;font-size:12px;font-weight:700;line-height:1.4">${escapeEmailHtml(input.eyebrow)}</p>
                <h1 style="margin:0 0 19px;color:#1f3026;font-size:23px;font-weight:700;line-height:1.35;letter-spacing:-.01em">${escapeEmailHtml(input.title)}</h1>
                <p style="margin:0 0 9px;color:#26382c;font-size:14px;line-height:1.7">Merhaba ${escapeEmailHtml(input.recipientName)},</p>
                <p style="margin:0 0 23px;color:#536158;font-size:14px;line-height:1.7">${escapeEmailHtml(input.message)}</p>
                ${input.detailsHtml}
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0"><tr><td bgcolor="#174b38" style="padding:12px 18px;border-radius:6px;background:#174b38"><a href="${escapeEmailHtml(input.actionUrl)}" style="color:#fff;font-size:13px;font-weight:700;line-height:1.4;text-decoration:none">${escapeEmailHtml(input.actionLabel)}</a></td></tr></table>
              </td></tr>
            </table>
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse"><tr><td style="padding:19px 8px 0;text-align:center;color:#88928b;font-size:11px;line-height:1.7">${escapeEmailHtml(input.footer)}${input.preferencesUrl ? `<br>Bu tür e-postaları almak istemiyorsanız <a href="${escapeEmailHtml(input.preferencesUrl)}" style="color:#2563a6;text-decoration:underline">bildirim tercihlerinizi yönetin</a>.` : ''}</td></tr></table>
          </td></tr>
        </table>
      </body>
    </html>`;
}
