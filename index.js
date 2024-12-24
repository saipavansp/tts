// Import required modules
const axios = require('axios');
const uuid = require('uuid');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables from a .env file
dotenv.config();

// Log formatting
const logger = {
  info: console.log,
  error: console.error,
  debug: console.debug,
};

// Get environment variables
const SPEECH_ENDPOINT = process.env.SPEECH_ENDPOINT || "https://southeastasia.api.cognitive.microsoft.com";
const PASSWORDLESS_AUTHENTICATION = false; // Set to true if using Azure Identity (passwordless authentication)
const API_VERSION = "2024-04-15-preview";

// Create a unique job ID
function createJobId() {
  return uuid.v4(); // Using uuid library to create a unique UUID
}

// Authenticate with Azure
function authenticate() {
  if (PASSWORDLESS_AUTHENTICATION) {
    // Use Azure Identity for passwordless authentication if set to true
    const { DefaultAzureCredential } = require('@azure/identity');
    const credential = new DefaultAzureCredential();
    return credential.getToken('https://cognitiveservices.azure.com/.default').then((token) => {
      return { 'Authorization': `Bearer ${token.token}` };
    });
  } else {
    // Use subscription key for authentication
    const SUBSCRIPTION_KEY = process.env.SUBSCRIPTION_KEY || 'd21a028b925c4d4f84cff3796ecad2ac';
    return { 'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY };
  }
}

// Submit avatar synthesis job
async function submitSynthesis(jobId) {
  const url = `${SPEECH_ENDPOINT}/avatar/batchsyntheses/${jobId}?api-version=${API_VERSION}`;
  const headers = {
    'Content-Type': 'application/json',
    ...await authenticate(),
  };

  const isCustomized = false; // If you have a customized avatar, set this to true
  const payload = {
    synthesisConfig: {
      voice: 'en-US-JennyMultilingualNeural',
    },
    customVoices: {},
    inputKind: 'plainText',
    inputs: [{ content: "Hi, I'm a virtual assistant created by Microsoft." }],
    avatarConfig: isCustomized ? {
      customized: isCustomized,
      talkingAvatarCharacter: 'Lisa-casual-sitting',
      videoFormat: 'mp4',
      videoCodec: 'h264',
      subtitleType: 'soft_embedded',
      backgroundColor: '#FFFFFFFF',
    } : {
      customized: isCustomized,
      talkingAvatarCharacter: 'Lisa',
      talkingAvatarStyle: 'casual-sitting',
      videoFormat: 'mp4',
      videoCodec: 'h264',
      subtitleType: 'soft_embedded',
      backgroundColor: '#FFFFFFFF',
    },
  };

  try {
    const response = await axios.put(url, payload, { headers });
    logger.info('Batch avatar synthesis job submitted successfully');
    logger.info(`Job ID: ${response.data.id}`);
    return true;
  } catch (error) {
    logger.error(`Failed to submit batch avatar synthesis job: ${error.response.status}, ${error.response.data}`);
  }
}

// Get synthesis status
async function getSynthesis(jobId) {
  const url = `${SPEECH_ENDPOINT}/avatar/batchsyntheses/${jobId}?api-version=${API_VERSION}`;
  const headers = await authenticate();

  try {
    const response = await axios.get(url, { headers });
    logger.debug('Get batch synthesis job successfully');
    logger.debug(response.data);
    if (response.data.status === 'Succeeded') {
      logger.info(`Batch synthesis job succeeded, download URL: ${response.data.outputs.result}`);
    }
    return response.data.status;
  } catch (error) {
    logger.error(`Failed to get batch synthesis job: ${error.response.data}`);
  }
}

// List all synthesis jobs
async function listSynthesisJobs(skip = 0, maxPageSize = 100) {
  const url = `${SPEECH_ENDPOINT}/avatar/batchsyntheses?api-version=${API_VERSION}&skip=${skip}&maxpagesize=${maxPageSize}`;
  const headers = await authenticate();

  try {
    const response = await axios.get(url, { headers });
    logger.info(`List batch synthesis jobs successfully, got ${response.data.values.length} jobs`);
    logger.info(response.data);
  } catch (error) {
    logger.error(`Failed to list batch synthesis jobs: ${error.response.data}`);
  }
}

// Main program flow
(async function () {
  const jobId = createJobId();
  if (await submitSynthesis(jobId)) {
    while (true) {
      const status = await getSynthesis(jobId);
      if (status === 'Succeeded') {
        logger.info('Batch avatar synthesis job succeeded');
        break;
      } else if (status === 'Failed') {
        logger.error('Batch avatar synthesis job failed');
        break;
      } else {
        logger.info(`Batch avatar synthesis job is still running, status [${status}]`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // wait for 5 seconds before checking again
      }
    }
  }
})();
