const express = require("express");
const { Resend } = require("resend");
const { simpleParser } = require("mailparser");
const { v4: uuidv4 } = require("uuid");
const { ImapFlow } = require("imapflow");
const dotenv = require("dotenv");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");
const fs = require("fs");
const http = require("http");
const url = require("url");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Database setup
let db;
async function setupDatabase() {
  const dbPath = process.env.SQLITE_DB_PATH || "emails.db";

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      uuid TEXT PRIMARY KEY,
      subject TEXT,
      from_address TEXT,
      to_address TEXT,
      html TEXT,
      text_content TEXT,
      date TEXT
    )
  `);
  console.log(`Database initialized at ${dbPath}`);
}

// Initialize email client - Resend for sending emails
const resend = new Resend(process.env.RESEND_API_KEY);

// OAuth 2.0 configuration
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Token path for storing OAuth tokens
const TOKEN_PATH = "gmail-token.json";

// Function to get Gmail OAuth2 token
async function getAccessToken(oauth2Client) {
  return new Promise((resolve, reject) => {
    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://mail.google.com/"],
      prompt: "consent",
    });

    console.log("Authorize this app by visiting this url:", authUrl);

    // Open browser for authentication using dynamic import
    (async () => {
      const open = await import("open");
      await open.default(authUrl, { wait: false });
    })().catch((err) => {
      console.error("Error opening browser:", err);
      console.log("Please open the URL manually in your browser.");
    });

    // Find an available port starting from 3001
    const findAvailablePort = (startPort) => {
      return new Promise((resolve) => {
        const testServer = http.createServer();
        testServer.on("error", () => {
          // Port is in use, try the next one
          resolve(findAvailablePort(startPort + 1));
        });
        testServer.listen(startPort, () => {
          testServer.close(() => resolve(startPort));
        });
      });
    };

    // Create a temporary server to handle the OAuth callback
    (async () => {
      try {
        const port = await findAvailablePort(3001);
        const server = http
          .createServer(async (req, res) => {
            try {
              const parsedUrl = new url.URL(req.url, `http://localhost:${port}`);
              const qs = parsedUrl.searchParams;

              // Check if this is the correct callback path
              if (parsedUrl.pathname === "/oauth2callback" || parsedUrl.pathname === "/") {
                const code = qs.get("code");

                if (code) {
                  // Close the response
                  res.end("Authentication successful! You can close this window.");

                  // Get the access token
                  const { tokens } = await oauth2Client.getToken(code);
                  oauth2Client.setCredentials(tokens);

                  // Save token to file for future use
                  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
                  console.log("Token stored to", TOKEN_PATH);

                  // Close server and resolve
                  server.close(() => {
                    console.log("Temporary authentication server closed");
                    resolve(oauth2Client);
                  });
                } else {
                  res.end("Authentication failed. Please try again.");
                  server.close(() => {
                    console.log("Temporary authentication server closed after failed authentication");
                    reject(new Error("Authentication failed"));
                  });
                }
              } else {
                res.writeHead(404);
                res.end("Not found");
              }
            } catch (error) {
              console.error("Error during authentication:", error);
              res.end("Error during authentication. Please try again.");
              server.close(() => {
                console.log("Temporary authentication server closed after error");
                reject(error);
              });
            }
          })
          .listen(port, () => {
            console.log(`Temporary authentication server listening on port ${port}`);
          });

        // Ensure server closes on process termination
        process.on("SIGINT", () => {
          server.close(() => {
            console.log("Temporary authentication server closed due to app termination");
            process.exit(0);
          });
        });
      } catch (err) {
        console.error("Error setting up temporary server:", err);
        reject(err);
      }
    })();
  });
}

// Function to get authenticated OAuth client
async function getAuthenticatedClient() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
      oauth2Client.setCredentials(token);

      // Check if token is expired and refresh if needed
      if (token.expiry_date < Date.now()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
        console.log("Token refreshed and saved");
      }

      return oauth2Client;
    } else {
      return await getAccessToken(oauth2Client);
    }
  } catch (error) {
    console.error("Error getting authenticated client:", error);

    // If token exists but is invalid, try to remove it and start fresh
    if (fs.existsSync(TOKEN_PATH)) {
      console.log("Removing invalid token file and retrying authentication");
      fs.unlinkSync(TOKEN_PATH);
    }

    return await getAccessToken(oauth2Client);
  }
}

// Create IMAP client with OAuth2
async function createImapClient() {
  try {
    const client = await getAuthenticatedClient();
    const accessToken = client.credentials.access_token;

    return new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        accessToken: accessToken,
      },
      logger: false,
    });
  } catch (error) {
    console.error("Error creating IMAP client:", error);
    throw error;
  }
}

// Function to check emails periodically
async function checkEmails() {
  let client;

  try {
    client = await createImapClient();
    await client.connect();

    // Select and lock the mailbox
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for unread messages
      const messages = await client.search({ seen: false });

      console.log(`Found ${messages.length} unread messages`);

      for (const message of messages) {
        // Fetch the full message
        const fetchedMsg = await client.fetchOne(message, { source: true });

        if (fetchedMsg && fetchedMsg.source) {
          // Parse email
          const email = await simpleParser(fetchedMsg.source);

          // Process the email
          await processEmail(email);

          // Mark as seen/read
          await client.messageFlagsAdd(message, ["\\Seen"]);
        }
      }
    } finally {
      // Always release the lock
      lock.release();
    }

    // Close the connection
    await client.logout();
  } catch (error) {
    console.error("Error checking emails:", error);
    if (client) {
      try {
        await client.logout();
      } catch (e) {
        console.error("Error logging out from IMAP:", e);
      }
    }
  }

  // Check again after 10 seconds
  setTimeout(checkEmails, 10000);
}

// Process received email
async function processEmail(email) {
  try {
    // Generate UUID for this email
    const uuid = uuidv4();

    // Extract email content
    const { subject, from, to, html, text, date } = email;

    // Save to database
    await db.run(
      `INSERT INTO emails (uuid, subject, from_address, to_address, html, text_content, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid, subject, from.value[0].address, to.value[0].address, html, text, (date || new Date()).toISOString()]
    );

    // Create public URL
    const publicUrl = `${process.env.APP_URL}/email/${uuid}`;

    // Reply to sender with the URL
    await resend.emails.send({
      from: process.env.RESEND_USER,
      to: from.value[0].address,
      subject: `Your email has been published: ${subject}`,
      html: `
        <p>Your email has been published and is now available at:</p>
        <p><a href="${publicUrl}">${publicUrl}</a></p>
        <p>Share this link instead of forwarding the email to multiple recipients.</p>
      `,
    });

    console.log(`Processed email: ${subject} - Published at: ${publicUrl}`);
  } catch (error) {
    console.error("Error processing email:", error);
  }
}

// Route to display emails
app.get("/email/:uuid", async (req, res) => {
  try {
    const email = await db.get(
      'SELECT uuid, subject, from_address as "from", to_address as "to", html, text_content as text, date FROM emails WHERE uuid = ?',
      req.params.uuid
    );

    if (!email) {
      return res.status(404).render("404", { message: "Email not found" });
    }

    res.render("email", { email });
  } catch (error) {
    console.error("Error retrieving email:", error);
    res.status(500).render("error", { message: "Server error" });
  }
});

// Optional: Add a simple homepage
app.get("/", async (req, res) => {
  try {
    const count = await db.get("SELECT COUNT(*) as count FROM emails");
    res.render("home", { emailCount: count.count });
  } catch (error) {
    console.error("Error counting emails:", error);
    res.render("home", { emailCount: 0 });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize database
  try {
    await setupDatabase();

    // Initialize OAuth and start checking emails
    await getAuthenticatedClient();
    checkEmails();
  } catch (error) {
    console.error("Failed to initialize:", error);
  }
});
