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

## Acknowledgments

Special thanks to all contributors and the open-source community for their support and collaboration.
