# Resume–Job Matcher

A web-based AI-powered resume and job matching application that uses OpenRouter AI models to analyze resume text against job listings and provide intelligent matching scores.

## Overview

Resume–Job Matcher is a full-stack web application that helps recruiters and job seekers find the best matches between resumes and job listings. The application uses AI to extract and analyze job details from PDF/DOCX files, then matches them against uploaded resumes using advanced natural language processing.

## Key Features

### Resume Processing

- Extract text from PDF and DOCX files using specialized parsers
- Support for both PDF (via pdf-parse) and DOCX (via mammoth) formats
- Text extraction with error handling and validation

### Job Listing Extraction

- AI-powered job extraction using OpenRouter models
- Fallback to regex-based extraction for robustness
- Chunked processing for large job files (3KB chunks)
- Deduplication of extracted jobs

### Intelligent Matching

- LLM-based scoring using OpenRouter AI models
- Batched processing (8 jobs per batch) to stay within token limits
- Detailed strengths and gaps analysis for each match
- Scoring from 0-100 with percentile ranking

### Web Interface

- Modern, responsive UI with Tailwind CSS
- Real-time progress indicators
- Status tracking for jobs (New, Email Sent, Waiting Reply, Interviewing, Offer Received, Ignored)
- Detailed match results with sortable tables
- Email agent functionality for outreach

### Data Management

- Persistent storage using JSON files
- Resume and job data persistence across sessions
- Status tracking and history management
- File upload and management

## Technology Stack

### Frontend

- **HTML5** - Semantic markup and structure
- **Tailwind CSS** - Modern, responsive styling
- **JavaScript** - Client-side interactivity and API calls

### Backend

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Multer** - File upload handling
- **Nodemailer** - Email functionality

### AI/ML

- **OpenRouter API** - LLM integration for job extraction and scoring
- **pdf-parse** - PDF text extraction
- **mammoth** - DOCX text extraction

### Data Storage

- **JSON files** - Persistent data storage
- **File system** - Upload and file management

## Setup and Installation

### Prerequisites

- Node.js 18+ installed
- OpenRouter API key (required for AI features)
- Gmail credentials (optional, for email functionality)

### Installation Steps

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd resume-parser
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:
   Create or edit `.env` file with your OpenRouter API key:

   ```env
   OPENROUTER_API_KEY=your_api_key_here
   OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
   OPENROUTER_MAX_TOKENS=4096
   ```

4. Start the application:
   ```bash
   npm start
   ```

The application will be available at `http://localhost:5000`

## Usage

### Basic Workflow

1. **Upload Resume**
   - Click "Upload" button or drag-and-drop
   - Supported formats: PDF, DOCX
   - Maximum file size: 50MB

2. **Upload Job Listings**
   - Upload multiple PDF/DOCX files containing job listings
   - System will extract and parse all jobs
   - Jobs are deduplicated and stored

3. **Run Matching**
   - Click "Find Matches" button
   - System will analyze resume against all jobs
   - Results displayed in ranked order (highest score first)

4. **Review Results**
   - View match scores, strengths, and gaps
   - Filter jobs by status (New, Sent, Waiting, etc.)
   - Click on job rows for detailed information
   - Update job status as needed

### API Endpoints

#### Resume Operations

- `POST /api/upload-resume` - Upload and parse resume
- `GET /api/resume` - Get resume text
- `POST /api/upload-resume-attachment` - Upload resume for agent

#### Job Operations

- `POST /api/upload-jobs` - Upload and parse job listings
- `GET /api/jobs` - Get all jobs with optional status filter
- `PATCH /api/jobs/:index/status` - Update job status
- `DELETE /api/jobs/:index` - Delete single job
- `DELETE /api/jobs` - Delete all jobs

#### Matching

- `POST /api/match` - Run matching against all jobs

#### Status and Utilities

- `GET /api/status` - Get system status
- `POST /api/clear` - Clear all data
- `POST /api/send-email` - Send email to job contact
- `POST /api/verify-gmail` - Verify Gmail credentials

### File Upload Requirements

#### Resume Files

- **Formats**: PDF (.pdf), DOCX (.docx)
- **Size**: Maximum 50MB
- **Content**: Plain text extractable from documents

#### Job Listing Files

- **Formats**: PDF (.pdf), DOCX (.docx)
- **Size**: Multiple files supported, each up to 50MB
- **Content**: Job descriptions, requirements, contact information

## Project Structure

```
resume-parser/
├── .env                    # Environment variables
├── .gitignore              # Git ignore rules
├── package.json            # Node.js package configuration
├── server.js               # Express.js backend
├── parser.js               # Job extraction and parsing
├── openrouter.js           # OpenRouter API integration
├── README.md               # This documentation
├── public/                 # Static files
│   ├── index.html          # Main application
│   └── ...                 # Other static assets
├── templates/              # HTML templates
│   ├── index.html          # Main page template
│   └── agent.html          # Agent page template
├── uploads/                # Uploaded files
├── data.json               # Persistent data storage
├── models.json             # AI model configurations
└── ...                     # Other project files
```

## Configuration

### Environment Variables

#### Required

- `OPENROUTER_API_KEY`: Your OpenRouter API key
- `OPENROUTER_MODEL`: Model to use for AI tasks (default: nvidia/nemotron-3-super-120b-a12b:free)
- `OPENROUTER_MAX_TOKENS`: Maximum tokens per API call (default: 4096)

#### Optional

- `LLM_PROVIDER`: AI provider (default: openrouter)
- `OMNIROUTE_BASE`: OmniRoute base URL (if using OmniRoute)
- `OMNIROUTE_API_KEY`: OmniRoute API key (if using OmniRoute)
- `OMNIROUTE_MODEL`: OmniRoute model (if using OmniRoute)
- `OMNIROUTE_MAX_TOKENS`: OmniRoute max tokens (if using OmniRoute)
- `PORT`: Server port (default: 5000)

### AI Model Configuration

The application uses OpenRouter to access various AI models. The default model (`nvidia/nemotron-3-super-120b-a12b:free`) is a free model suitable for job matching and extraction.

For better performance, consider using:

- `deepseek/deepseek-chat-v3-0324` for job extraction
- `tencent/hy3:free` for scoring

## Development

### Running in Development Mode

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open browser and navigate to `http://localhost:5000`

### Testing

The application includes basic error handling and validation. For more comprehensive testing, consider:

1. **Unit Tests**: Test individual functions (parser, scoring, etc.)
2. **Integration Tests**: Test API endpoints
3. **E2E Tests**: Test the full user workflow

### Code Quality

- **JavaScript**: ES6+ syntax
- **Code Style**: Consistent with Express.js conventions
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Logging**: Console logging for debugging and monitoring

## Deployment

### Production Deployment

1. Set up environment variables in production environment
2. Configure firewall to allow port 5000
3. Set up process management (PM2, systemd, etc.)
4. Configure SSL/TLS for secure connections
5. Set up monitoring and logging

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Contributing

### Code Contributions

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Bug Reports

1. Open an issue in the repository
2. Provide detailed steps to reproduce
3. Include any relevant logs or error messages

### Feature Requests

1. Open an issue in the repository
2. Describe the desired functionality
3. Provide use cases and examples

## Troubleshooting

### Common Issues

#### "No job listings" Error

- **Cause**: No job files uploaded or parsing failed
- **Solution**: Upload valid job listing files (PDF/DOCX)

#### "No resume uploaded" Error

- **Cause**: No resume file uploaded or parsing failed
- **Solution**: Upload a valid resume file (PDF/DOCX)

#### API Key Errors

- **Cause**: Invalid or missing OpenRouter API key
- **Solution**: Check `.env` file and ensure valid API key

#### Token Limit Errors

- **Cause**: Large job files exceeding token limits
- **Solution**: The application automatically chunks large files

### Getting Logs

The application logs to the console:

- Job extraction progress
- AI model usage
- Error messages
- System status

## Support

### Documentation

- This README.md file
- Inline code comments
- API documentation in code

### Community

- GitHub repository issues
- Stack Overflow (tag with project name)

### Contact

For direct support, please contact the project maintainer.

## License

This project is licensed under the MIT License. See `LICENSE` file for details.

## Acknowledgements

- **OpenRouter**: AI model integration
- **Tailwind CSS**: Modern styling
- **Express.js**: Web framework
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX text extraction
- **Multer**: File upload handling
- **Nodemailer**: Email functionality

## Changelog

### Version 1.0.0

- Initial release
- Basic resume and job matching functionality
- AI-powered job extraction and scoring
- Web interface with real-time updates

## Future Enhancements

### Planned Features

1. **Advanced Filtering**: Filter jobs by skills, experience, location
2. **User Accounts**: Save resumes and job searches
3. **Advanced Analytics**: Match statistics and trends
4. **Integration**: LinkedIn, Indeed API integration
5. **Mobile App**: Native mobile applications
6. **Dashboard**: Admin dashboard for system monitoring

### Performance Improvements

1. **Caching**: Cache AI model responses
2. **Indexing**: Index resumes and jobs for faster matching
3. **Parallel Processing**: Parallel processing of multiple files
4. **Optimization**: Optimize AI model usage

## Disclaimer

This application uses third-party AI services (OpenRouter) which may have usage limits and costs associated. Users are responsible for complying with all applicable laws and regulations when using this application.

---

_Last updated: July 20, 2026_
