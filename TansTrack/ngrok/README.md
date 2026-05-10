# ngrok Setup Instructions

## Prerequisites
1. Download ngrok from https://ngrok.com/download
2. Create a free account at https://ngrok.com/
3. Get your auth token from the ngrok dashboard

## Installation Steps

### 1. Install ngrok
- Download the ngrok executable for Windows
- Extract it to a folder (e.g., `C:\ngrok\`)
- Add the ngrok folder to your Windows PATH environment variable

### 2. Configure Authentication
```bash
# Set your auth token (replace with your actual token)
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 3. Using the Configuration File
```bash
# Use the custom config file in this folder
ngrok start --config ./ngrok.yml ionic-dev

# Or start multiple tunnels
ngrok start --config ./ngrok.yml ionic-dev laravel-api
```

## Common Commands

### Start Ionic Development Server Tunnel
```bash
# First start your Ionic app
ionic serve

# Then in another terminal, start ngrok
ngrok start --config ./ngrok.yml ionic-dev
```

### Start Simple HTTP Tunnel (without config file)
```bash
# For Ionic (port 8100)
ngrok http 8100

# For Angular (port 4200)  
ngrok http 4200

# For Laravel (port 8000)
ngrok http 8000
```

### Start HTTPS Tunnel
```bash
ngrok http --scheme=https 8100
```

## Configuration Notes

1. **Update ngrok.yml**:
   - Replace `YOUR_AUTH_TOKEN` with your actual token
   - Change subdomain names to match your project
   - Adjust ports if your apps run on different ports

2. **Subdomain Requirements**:
   - Free accounts get random URLs
   - Paid accounts can use custom subdomains
   - Remove `subdomain` lines if using free account

3. **Region Setting**:
   - Change `region: us` to your closest region
   - Options: us, eu, ap, au, sa, jp, in

## Troubleshooting

- **Port already in use**: Make sure your app is running first
- **Auth token error**: Double-check your token from ngrok dashboard  
- **Subdomain unavailable**: Remove subdomain line or choose different name
- **Connection refused**: Verify your app is running on the specified port

## Security Notes

- Don't commit your actual auth token to git
- Use environment variables for sensitive data
- Be careful with exposing development servers publicly