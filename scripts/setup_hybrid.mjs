import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\x1b[36m%s\x1b[0m", "=== Hybrid Deployment Linker ===");
console.log("This tool will link your Shared Hosting (Frontend) to your VPS (Backend).\n");

rl.question('1. What is your main website domain? (e.g., ahiajoku.im.gov.ng): ', (domain) => {
  // Remove protocol or slashes if user pasted them
  domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  rl.question('2. What is your VPS IP address? (e.g., 192.168.1.1): ', (ip) => {
    
    const apiDomain = `api.${domain}`;
    const apiUrl = `https://${apiDomain}`;
    
    console.log(`\n\x1b[33mConfiguring Link:\x1b[0m`);
    console.log(`Frontend (WhoGoHost) -> will look for -> ${apiUrl}`);
    console.log(`Backend (VPS at ${ip}) -> will accept -> ${domain}`);

    // 1. Create .env.production for Frontend
    // This tells the React app where to find the API
    const envContent = `VITE_API_URL=${apiUrl}\n`;
    fs.writeFileSync(path.join(rootDir, '.env.production'), envContent);
    console.log("\n✅ \x1b[32mCREATED: .env.production\x1b[0m (Frontend is now linked to VPS)");

    // 2. Create vps-setup.sh for Backend
    // This automates the VPS setup
    const setupScript = `#!/bin/bash
# Auto-generated setup script for ${domain}

echo "--- 1. Updating System ---"
sudo apt update && sudo apt upgrade -y

echo "--- 2. Installing Node.js & PM2 ---"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

echo "--- 3. Installing Caddy (Automatic HTTPS) ---"
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

echo "--- 4. configuring HTTPS Link ---"
# Create Caddyfile
# This tells the VPS to accept traffic for ${apiDomain} and send it to our Node app
cat <<EOF > Caddyfile
${apiDomain} {
    reverse_proxy localhost:8787
}
EOF
sudo mv Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

echo "--- 5. Setup Complete! ---"
echo "To start your app, run: pm2 start server/index.js --name api"
`;
    fs.writeFileSync(path.join(rootDir, 'vps-setup.sh'), setupScript);
    console.log("✅ \x1b[32mCREATED: vps-setup.sh\x1b[0m (Script to set up VPS automatically)");

    console.log("\n\x1b[36m=== FINAL STEPS TO LINK THEM ===\x1b[0m");
    console.log("1. \x1b[1mDNS\x1b[0m: Go to WhoGoHost Zone Editor. Add an 'A Record' for 'api' pointing to " + ip);
    console.log("2. \x1b[1mFRONTEND\x1b[0m: Run 'npm run build'. Upload the 'dist' folder to WhoGoHost.");
    console.log("3. \x1b[1mBACKEND\x1b[0m: Upload 'vps-setup.sh' and 'server' folder to VPS. Run 'bash vps-setup.sh'.");
    
    rl.close();
  });
});
