# Research Tools

Welcome to the Research Tools repository. This project is designed to provide a collection of community-created and curated research tools and links, accessible via a web interface.

## Live Site

You can access the live version of this project at [researchtools.net](https://researchtools.net).

Research resources, guides, and tool repositories are available at [Irregularpedia.org](https://irregularpedia.org).

## Getting Started

To get started with this repository, follow these steps:

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/gitayam/researchtoolspy.git
   cd researchtoolspy
   ```

2. **Create a `.env` File:**

   Create a `.env` file from the provided template example. This file should contain your environment variables, such as API keys and other configuration settings.

3. **Build and Run with Docker Compose:**

   Ensure you have Docker and Docker Compose installed. Then, build and run the application using:

   ```bash
   # Build the Docker image and run the container in detached mode
   docker compose up -d --build
   ```

   This will start the application on the default port specified in the `docker-compose.yml` file.

## Features

- **Sidebar Navigation:** Access various research tools and frameworks through an intuitive sidebar menu.
- **CSV/JSON Conversion:** Convert data formats easily.
- **Advanced Query Generation:** Use AI to generate advanced search queries.
- **Frameworks for Analysis:** Tools for structured analysis, including COG Analysis, SWOT, and more.
- **Wayback Tool:** Access archived web pages for historical research.
- **Image Search & Hashing:** Find and analyze images across various platforms.

## 📚 Public Hosting & Demo Deployment

For quick feedback and testing, you can easily make your local development instance publicly accessible using Cloudflare Tunnel:

### 🔧 Setup & Usage:

1. **Install Cloudflare Tunnel:**
   ```bash
   brew install cloudflared
   ```

2. **Create Public Tunnel:**
   ```bash
   # For the frontend (Next.js)
   cloudflared tunnel --url http://localhost:3380
   
   # For the backend API (FastAPI) 
   cloudflared tunnel --url http://localhost:8001
   ```

3. **Benefits:**
   - ✅ Instant HTTPS-enabled public URLs
   - ✅ No configuration or account setup required
   - ✅ Perfect for temporary demos and feedback collection
   - ✅ Automatically handles SSL/TLS certificates
   - ✅ Works through firewalls and NATs

The tunnel will provide you with public URLs like `https://random-name.trycloudflare.com` that you can share for immediate feedback on your research tools platform.

## Social Media Downloader Setup

To use the social media downloader, you need to set up authentication for each platform. Follow the instructions below to obtain the necessary tokens and cookies.

### Instagram

1. **Cookies**: 
   - Use a browser extension like "EditThisCookie" to export your Instagram cookies.
   - Log in to Instagram in your browser.
   - Open the extension and copy the cookies for `mid`, `ig_did`, `csrftoken`, `ds_user_id`, and `sessionid`.
   - Paste these values into the `CREDENTIALS` dictionary in your code.

### Reddit

1. **Create a Reddit App**:
   - Go to [Reddit Apps](https://www.reddit.com/prefs/apps).
   - Click "Create App" or "Create Another App".
   - Fill in the required fields. Set the app type to "script".
   - Note down the `client_id` and `client_secret`.

2. **Obtain a Refresh Token**:
   - Use a tool like [praw's quickstart](https://praw.readthedocs.io/en/latest/getting_started/authentication.html#script-application) to authenticate and obtain a refresh token.
   - Update the `CREDENTIALS` dictionary with these values.

### Twitter

1. **Create a Twitter Developer Account**:
   - Apply for a developer account at [Twitter Developer](https://developer.twitter.com/).
   - Create a new app in the developer portal.

2. **Obtain OAuth Tokens**:
   - Navigate to the "Keys and Tokens" section of your app.
   - Generate and note down the `auth_token` and `ct0`.
   - Update the `CREDENTIALS` dictionary with these values.

### YouTube

1. **Enable YouTube Data API**:
   - Go to [Google Cloud Console](https://console.developers.google.com/).
   - Create a new project and enable the YouTube Data API v3.

2. **Obtain OAuth Credentials**:
   - Navigate to "Credentials" and create an OAuth 2.0 Client ID.
   - Download the credentials JSON file.
   - Use a tool like [Google's OAuth Playground](https://developers.google.com/oauthplayground) to obtain an access token.
   - Run `pnpm run token:youtube` in your `api` folder to generate the token and update the `CREDENTIALS` dictionary.

## Contributing

We welcome contributions from the community. To contribute:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Commit your changes and push your branch to your fork.
4. Open a pull request with a detailed description of your changes.

Please ensure your code adheres to the project's coding standards and includes appropriate tests.

## Roadmap

For future plans and features, please refer to our [Roadmap](ROADMAP.md).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
