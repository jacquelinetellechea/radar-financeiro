/**
 * Utilitário de geração de PDF via Puppeteer + Chromium do sistema.
 * Em produção (Render), o Chromium é instalado via apt no build command.
 * Em desenvolvimento, usa /usr/bin/chromium se disponível.
 */

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/local/bin/chromium',
  '/snap/bin/chromium',
];

function findChrome() {
  const fs = require('fs');
  for (const p of CHROME_PATHS) {
    try {
      if (p && fs.existsSync(p)) {
        console.log('[pdf] Chromium encontrado em:', p);
        return p;
      }
    } catch (_) {}
  }
  console.warn('[pdf] Chromium não encontrado. Paths testados:', CHROME_PATHS.filter(Boolean));
  return null;
}

/**
 * Converte uma string HTML em Buffer PDF (A4, print-color-adjust: exact).
 * @param {string} html - HTML completo da página
 * @returns {Promise<Buffer>}
 */
async function htmlToPdf(html) {
  const puppeteer = require('puppeteer-core');
  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error('Chromium não encontrado no servidor. Verifique a variável CHROME_PATH.');
  }

  const browser = await puppeteer.launch({
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
    headless: true,
    timeout: 30000,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    console.log('[pdf] PDF gerado com sucesso:', pdf.length, 'bytes');
    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { htmlToPdf };
