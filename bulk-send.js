const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const fs = require("fs");

function readCSV(filePath) {
  const data = fs.readFileSync(filePath, "utf-8");
  const lines = data.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"(.+)"$/, "$1"));
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i];
    });
    return obj;
  });
}

function readImages() {
  return {
    email: fs.readFileSync("/Users/gustav/klieknet-website/icon-email.png").toString("base64"),
    calendar: fs.readFileSync("/Users/gustav/klieknet-website/icon-calendar.png").toString("base64"),
    lightning: fs.readFileSync("/Users/gustav/klieknet-website/icon-lightning.png").toString("base64"),
    network: fs.readFileSync("/Users/gustav/klieknet-website/icon-network.png").toString("base64"),
  };
}

function buildHTMLBody(templatePath, unsubscribeUrl) {
  let html = fs.readFileSync(templatePath, "utf-8");
  
  html = html.replace(
    /<svg class="icon-svg" width="20" height="20"[\s\S]*?<rect x="2" y="4" width="20" height="16" rx="2"\/>[\s\S]*?<path d="m2 7 10 7 10-7"\/>[\s\S]*?<\/svg>/,
    '<img src="cid:icon-email" alt="Email Sync" width="20" height="20" style="display:block;">'
  );

  html = html.replace(
    /<svg class="icon-svg" width="20" height="20"[\s\S]*?<rect x="3" y="4" width="18" height="16" rx="2"\/>[\s\S]*?<path d="M3 9h18M8 2v4m8-4v4"\/>[\s\S]*?<\/svg>/,
    '<img src="cid:icon-calendar" alt="Calendar Automation" width="20" height="20" style="display:block;">'
  );

  html = html.replace(
    /<svg class="icon-svg" width="20" height="20"[\s\S]*?<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"\/>[\s\S]*?<\/svg>/,
    '<img src="cid:icon-lightning" alt="AI Workflows" width="20" height="20" style="display:block;">'
  );

  html = html.replace(
    /<svg class="icon-svg" width="22" height="22"[\s\S]*?<\/svg>/,
    '<img src="cid:icon-network" alt="Referral" width="22" height="22" style="display:block;">'
  );

  html = html.replace("{{unsubscribe}}", unsubscribeUrl);
  
  return html;
}

function buildMIMEMessage(from, to, subject, htmlBody, images) {
  const boundary = "boundary-" + Date.now();
  
  let mime = `From: ${from}\r\n`;
  mime += `To: ${to}\r\n`;
  mime += `Subject: ${subject}\r\n`;
  mime += `MIME-Version: 1.0\r\n`;
  mime += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
  
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/html; charset=UTF-8\r\n`;
  mime += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
  mime += htmlBody + "\r\n";
  
  const imageData = [
    { cid: "icon-email", data: images.email },
    { cid: "icon-calendar", data: images.calendar },
    { cid: "icon-lightning", data: images.lightning },
    { cid: "icon-network", data: images.network },
  ];
  
  imageData.forEach(img => {
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: image/png\r\n`;
    mime += `Content-Transfer-Encoding: base64\r\n`;
    mime += `Content-ID: <${img.cid}>\r\n`;
    mime += `Content-Disposition: inline; filename="${img.cid}.png"\r\n\r\n`;
    mime += img.data + "\r\n";
  });
  
  mime += `--${boundary}--\r\n`;
  
  return Buffer.from(mime);
}

async function sendBulkEmails() {
  const client = new SESClient({ region: "eu-north-1" });
  
  try {
    console.log("📧 Starting bulk send...\n");
    
    const contacts = readCSV("/Users/gustav/klieknet-website/:tmp:bulk_send_list.csv");
    console.log(`📋 Loaded ${contacts.length} contacts\n`);
    
    const images = readImages();
    console.log("🖼️  Images loaded\n");
    
    const htmlBody = buildHTMLBody(
      "/Users/gustav/klieknet-website/klieknet-aws.html",
      "https://klieknet.com/unsubscribe?email={email}"
    );
    
    const testContact = contacts[0];
    const testEmail = "gustav@klieknet.com";
    const unsubscribeUrl = `https://klieknet.com/unsubscribe?email=${encodeURIComponent(testEmail)}`;
    const testHtmlBody = htmlBody.replace("{email}", testEmail);
    
    const mimeMessage = buildMIMEMessage(
      "gustav@klieknet.com",
      testEmail,
      "I've refocused KliekNet on AI — here's what we can do for you",
      testHtmlBody,
      images
    );
    
    const params = {
      RawMessage: {
        Data: mimeMessage,
      },
    };
    
    const command = new SendRawEmailCommand(params);
    const response = await client.send(command);
    
    console.log(`✅ Test email sent to: ${testEmail}`);
    console.log(`📨 MessageId: ${response.MessageId}\n`);
    console.log("Check your inbox. Icons should now display properly.\n");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

sendBulkEmails();