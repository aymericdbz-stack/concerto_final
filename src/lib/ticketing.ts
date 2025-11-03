import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Resend } from "resend";
import { DEFAULT_CURRENCY, MAIN_EVENT } from "@/lib/constants";

interface TicketDetails {
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
  qrDataUrl: string;
  registrationId: string;
}

interface TicketEmailPayload extends TicketDetails {
  to: string;
  ticketPdf: Buffer;
}

let cachedLogoBytes: Uint8Array | null = null;

async function getLogoBytes() {
  if (cachedLogoBytes) {
    return cachedLogoBytes;
  }

  const candidatePaths = [
    path.join(process.cwd(), "Logo Concert.png"),
    path.join(process.cwd(), "logo concert.png"),
    path.join(process.cwd(), "public", "Logo Concert.png"),
    path.join(process.cwd(), "public", "logo-concert.png"),
  ];

  for (const candidate of candidatePaths) {
    try {
      const file = await fs.readFile(candidate);
      cachedLogoBytes = new Uint8Array(file);
      return cachedLogoBytes;
    } catch {
      // Essayez le chemin suivant
    }
  }

  const placeholderBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR4nGNgYGj4zwADAAEBAQGInAjiAAAAAElFTkSuQmCC";
  cachedLogoBytes = new Uint8Array(Buffer.from(placeholderBase64, "base64"));
  return cachedLogoBytes;
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:(?:.*?);base64,(.*)$/);
  const base64 = match?.[1] ?? dataUrl;
  return Buffer.from(base64, "base64");
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits: 2,
  }).format(amount);
}

export async function generateTicketPdf({
  firstName,
  lastName,
  email,
  amount,
  qrDataUrl,
  registrationId,
}: TicketDetails): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 420]);
  const { width, height } = page.getSize();

  const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const smallFont = await pdf.embedFont(StandardFonts.Helvetica);

  const backgroundColor = rgb(0.995, 0.973, 0.94);
  const accentColor = rgb(0.478, 0.157, 0.125);
  const textColor = rgb(0.267, 0.215, 0.188);

  page.drawRectangle({ x: 0, y: 0, width, height, color: backgroundColor });
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: accentColor });

  const logoBytes = await getLogoBytes();
  const logoImage = await pdf.embedPng(logoBytes);
  const logoWidth = 96;
  const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

  page.drawImage(logoImage, {
    x: 36,
    y: height - logoHeight - 46,
    width: logoWidth,
    height: logoHeight,
  });

  page.drawText("Billet d'entrée — Concerto", {
    x: 36,
    y: height - 70,
    size: 22,
    font: headingFont,
    color: rgb(1, 1, 1),
  });

  page.drawText(MAIN_EVENT.title, {
    x: 36,
    y: height - 110,
    size: 18,
    font: headingFont,
    color: accentColor,
  });

  const formattedAmount = formatCurrency(amount);

  page.drawText("Place confirmée pour le vendredi 16 janvier 2026", {
    x: 36,
    y: height - 140,
    size: 15,
    font: bodyFont,
    color: textColor,
  });

  let currentY = height - 180;
  const lineGap = 20;

  const details: string[] = [
    `Participant · ${firstName} ${lastName}`,
    `Email · ${email}`,
    `Participation · ${formattedAmount}`,
    `Date · ${MAIN_EVENT.date} · ${MAIN_EVENT.time}`,
    `Lieu · ${MAIN_EVENT.venue}`,
    `Adresse · ${MAIN_EVENT.address}`,
    `Référence · ${registrationId}`,
  ];

  details.forEach((line) => {
    page.drawText(line, {
      x: 36,
      y: currentY,
      size: 12,
      font: smallFont,
      color: textColor,
    });
    currentY -= lineGap;
  });

  page.drawText("Présente ce billet (ou ton QR code) à l'accueil pour accéder au concert.", {
    x: 36,
    y: currentY - 10,
    size: 11,
    font: bodyFont,
    color: textColor,
  });

  const qrImageBuffer = dataUrlToBuffer(qrDataUrl);
  const qrImage = await pdf.embedPng(qrImageBuffer);
  const qrWidth = 180;
  const qrHeight = (qrImage.height / qrImage.width) * qrWidth;
  const qrX = width - qrWidth - 48;
  const qrY = height / 2 - qrHeight / 2 + 10;

  page.drawRectangle({
    x: qrX - 16,
    y: qrY - 16,
    width: qrWidth + 32,
    height: qrHeight + 32,
    color: rgb(1, 1, 1),
    borderColor: accentColor,
    borderWidth: 1.5,
  });

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrWidth,
    height: qrHeight,
  });

  const pdfBytes = await pdf.save();
  return Buffer.from(pdfBytes);
}

export async function sendTicketEmail({
  to,
  firstName,
  lastName,
  email,
  amount,
  qrDataUrl,
  ticketPdf,
  registrationId,
}: TicketEmailPayload) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const formattedAmount = formatCurrency(amount);

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: `Ta place pour ${MAIN_EVENT.title}`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;background-color:#f9f6f0;padding:32px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 12px 32px rgba(76,32,14,0.08);">
              <tr>
                <td style="padding:32px 32px 16px 32px;">
                  <p style="margin:0;font-size:22px;font-weight:600;color:#5a2417;">Bonjour ${firstName} ${lastName},</p>
                  <p style="margin:16px 0 0 0;font-size:16px;color:#4a3b35;line-height:1.6;">
                    Merci pour ton inscription à notre concert <strong>${MAIN_EVENT.title}</strong> au ${MAIN_EVENT.venue}.
                  </p>
                  <p style="margin:12px 0 0 0;font-size:16px;color:#4a3b35;line-height:1.6;">
                    Nous avons bien reçu ta participation de <strong>${formattedAmount}</strong>.
                  </p>
                  <p style="margin:12px 0 0 0;font-size:15px;color:#4a3b35;line-height:1.6;">
                    Adresse de contact confirmée&nbsp;: <strong>${email}</strong>
                  </p>
                  <p style="margin:12px 0 0 0;font-size:15px;color:#4a3b35;line-height:1.6;">
                    Ton billet PDF est en pièce jointe avec ton QR code personnel (référence <strong>${registrationId}</strong>).
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 32px 32px;">
                  <div style="background:#f4ece0;padding:24px;border-radius:10px;border:1px solid #e0d4c3;">
                    <h2 style="margin:0;font-size:18px;color:#5a2417;text-transform:uppercase;letter-spacing:2px;">Ton QR Code</h2>
                    <p style="margin:12px 0 20px 0;font-size:15px;color:#4a3b35;line-height:1.6;">
                      Présente-le à l'entrée du ${MAIN_EVENT.venue} pour accéder à ta place.
                    </p>
                    <div style="text-align:center;">
                      <img src="${qrDataUrl}" alt="QR Code – ${MAIN_EVENT.title}" width="220" height="220" style="display:inline-block;border-radius:12px;border:4px solid #fff;box-shadow:0 8px 20px rgba(0,0,0,0.08);" />
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 32px 32px;">
                  <div style="background:#fff5ea;padding:20px;border-radius:10px;border:1px solid #f1dfc8;">
                    <p style="margin:0;font-size:15px;color:#4a3b35;line-height:1.6;">
                      <strong>Date :</strong> ${MAIN_EVENT.date} · ${MAIN_EVENT.time}<br/>
                      <strong>Lieu :</strong> ${MAIN_EVENT.venue}<br/>
                      <strong>Adresse :</strong> ${MAIN_EVENT.address}
                    </p>
                    <p style="margin:16px 0 0 0;">
                      <a href="${MAIN_EVENT.googleMapsUrl}" style="color:#8f3b20;text-decoration:none;font-weight:600;">Voir l'itinéraire sur Google Maps →</a>
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 32px 32px;">
                  <p style="margin:0;font-size:14px;color:#85746a;line-height:1.6;">
                    Une copie de ce QR code est également disponible dans ton espace abonné Concerto.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
    attachments: [
      {
        filename: `concerto-billet-${registrationId}.pdf`,
        content: ticketPdf.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });
}
