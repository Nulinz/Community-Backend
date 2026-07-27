import fs from "fs/promises";
import path from "path";
import handlebars from "handlebars";
import puppeteer from "puppeteer";

/**
 * Compiles HTML template with certificate data and renders a PDF Buffer via Puppeteer.
 * @param {Object} data - Certificate data (name, course, issuedDate, certificateId)
 * @returns {Promise<Buffer>} PDF Buffer
 */
export const generateCertificatePDFBuffer = async (data) => {
  const templatePath = path.resolve(process.cwd(), "templates", "certificateTemplate.html");
  const templateContent = await fs.readFile(templatePath, "utf8");

  // Compile Handlebars template
  const compiledTemplate = handlebars.compile(templateContent);
  const htmlContent = compiledTemplate(data);

  // Launch Puppeteer headless browser instance
  const browser = await puppeteer.launch({
    headless: "shell",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set HTML content and wait until network is idle
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    // Render A4 Portrait PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};
