const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const fs = require("fs");

const client = new SESClient({ region: "eu-north-1" });

let htmlTemplate = fs.readFileSync("/Users/gustav/klieknet-website/klieknet-aws.html", "utf-8");

const emailIcon = fs.readFileSync("/Users/gustav/klieknet-website/icon-email.png", "base64");
const calendarIcon = fs.readFileSync("/Users/gustav/klieknet-website/icon-calendar.png", "base64");
const lightningIcon = fs.readFileSync("/Users/gustav/klieknet-website/icon-lightning.png", "base64");
const networkIcon = fs.readFileSync("/Users/gustav/klieknet-website/icon-network.png", "base64");

htmlTemplate = htmlTemplate.replace(
  /<svg class="icon-svg" width="20" height="20"[\s\S]*?<rect x="2" y="4" width="20" height="16" rx="2"\/><path d="m2 7 10 7 10-7"\/><\/svg>/,
  `<img src="data:image/png;base64,${emailIcon}" alt="Email Sync" width="20" height="20" style="display:block;">`
);

htmlTemplate = htmlTemplate.replace(
  /<svg class="icon-svg" width="20" height="20"[\s\S]*?<rect x="3" y="4" width="18" height="16" rx="2"\/><path d="M3 9h18M8 2v4m8-4v4"\/><\/svg>/,
  `<img src="data:image/png;base64,${calendarIcon}" alt="Calendar Automation" width="20" height="20" style="display:block;">`
);

htmlTemplate = htmlTemplate.replace(
  /<svg class="icon-svg" width="20" height="20"[\s\S]*?<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"\/><\/svg>/,
  `<img src="data:image/png;base64,${lightningIcon}" alt="AI Workflows" width="20" height="20" style="display:block;">`
);

htmlTemplate = htmlTemplate.replace(
  /<svg class="icon-svg" width="22" height="22"[\s\S]*?<\/svg>/,
  `<img src="data:image/png;base64,${networkIcon}" alt="Referral" width="22" height="22" style="display:block;">`
);

const htmlBody = htmlTemplate.replace("{{unsubscribe}}", "https://klieknet.com/unsubscribe?email=gustav@klieknet.com");

const params = {
  Source: "gustav@klieknet.com",
  Destination: {
    ToAddresses: ["gustav@klieknet.com"],
  },
  Message: {
    Subject: {
      Data: "I've refocused KliekNet on AI — here's what we can do for you",
      Charset: "UTF-8",
    },
    Body: {
      Html: {
        Data: htmlBody,
        Charset: "UTF-8",
      },
    },
  },
};

const command = new SendEmailCommand(params);

client.send(command)
  .then((response) => {
    console.log("✅ Email sent successfully. MessageId:", response.MessageId);
  })
  .catch((error) => {
    console.error("❌ Error sending email:", error);
  });
